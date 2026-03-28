import { exec, execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { acquireUSBLock, releaseUSBLock, isUSBBusy } from './usb-lock'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

import os from 'os'

/** ARM 上通过 QEMU 运行 x86_64 的 scanimage */
const IS_ARM = os.arch() === 'arm64' || os.arch() === 'aarch64'
const QEMU_PREFIX = IS_ARM ? 'qemu-x86_64-static ' : ''
const SCANIMAGE = `${QEMU_PREFIX}scanimage`
const BRSANECONFIG = `${QEMU_PREFIX}brsaneconfig4`

/** 查询扫描设备是否正在工作（包括被打印占用） */
export function isScannerBusy(): boolean {
  return isUSBBusy().busy
}

// A4/A5/Letter 尺寸（mm），SANE 需要用 mm
const PAPER_SIZES: Record<string, { x: number; y: number }> = {
  A4: { x: 210, y: 297 },
  A5: { x: 148, y: 210 },
  Letter: { x: 215.9, y: 279.4 },
  B5: { x: 176, y: 250 },
}

export interface ScanOptions {
  dpi?: number
  colorMode?: 'gray' | 'color'
  paperSize?: string
  format?: 'jpeg' | 'png' | 'pdf'
}

/** 自动检测 SANE 设备名（Brother brscan4） */
async function detectDevice(): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`${SCANIMAGE} -L 2>/dev/null`, { timeout: 15000 })
    // 优先找 brother4 设备
    const brotherMatch = stdout.match(/device `(brother4:[^']+)'/i)
    if (brotherMatch) return brotherMatch[1]
    // 找任意设备
    const anyMatch = stdout.match(/device `([^']+)'/i)
    return anyMatch ? anyMatch[1] : null
  } catch {
    return null
  }
}

/** 执行一次扫描，返回图片 Buffer（自动获取/释放设备锁） */
export async function scanOnce(options: ScanOptions = {}): Promise<Buffer> {
  await acquireUSBLock('scan')

  const dpi = options.dpi ?? 300
  const mode = options.colorMode === 'color' ? 'Color' : 'Gray'
  const paper = PAPER_SIZES[options.paperSize ?? 'A4'] ?? PAPER_SIZES.A4
  const imgFormat = options.format === 'png' ? 'png' : 'jpeg'
  const tmpFile = path.join('/tmp', `scan_${uuid()}.${imgFormat}`)

  try {
    const device = await detectDevice()
    const deviceArg = device ? `--device-name="${device}"` : ''

    const cmd = [
      SCANIMAGE,
      deviceArg,
      `--resolution=${dpi}`,
      `--mode=${mode}`,
      `-x ${paper.x}`,
      `-y ${paper.y}`,
      `--format=${imgFormat}`,
      `--output-file="${tmpFile}"`,
    ].filter(Boolean).join(' ')

    await execAsync(cmd, { timeout: 60000 })

    if (!fs.existsSync(tmpFile)) {
      throw new Error('scanimage 未生成输出文件')
    }

    const buffer = fs.readFileSync(tmpFile)
    fs.unlinkSync(tmpFile)
    return buffer
  } catch (err) {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
    throw err
  } finally {
    releaseUSBLock()
  }
}

/** 身份证双面合成：将正面和反面图片排版到 A4 */
export async function composeIdCard(
  frontBuffer: Buffer,
  backBuffer: Buffer
): Promise<Buffer> {
  // 动态 import sharp（避免在 mock 模式下也加载）
  const sharp = (await import('sharp')).default

  // A4 at 300 DPI: 2480 × 3508 px
  const A4_W = 2480
  const A4_H = 3508
  const MARGIN = 80   // 页边距 px
  const GAP = 60      // 正反面间距 px
  const CARD_W = A4_W - MARGIN * 2
  const CARD_H = Math.floor((A4_H - MARGIN * 2 - GAP) / 2)

  // 缩放两张图到同等宽度
  const frontResized = await sharp(frontBuffer)
    .resize(CARD_W, CARD_H, { fit: 'inside', withoutEnlargement: false })
    .jpeg({ quality: 90 })
    .toBuffer()

  const backResized = await sharp(backBuffer)
    .resize(CARD_W, CARD_H, { fit: 'inside', withoutEnlargement: false })
    .jpeg({ quality: 90 })
    .toBuffer()

  const frontMeta = await sharp(frontResized).metadata()
  const backMeta = await sharp(backResized).metadata()

  // 合成到白色 A4 画布
  const composed = await sharp({
    create: {
      width: A4_W,
      height: A4_H,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      {
        input: frontResized,
        left: MARGIN + Math.floor((CARD_W - (frontMeta.width ?? CARD_W)) / 2),
        top: MARGIN,
      },
      {
        input: backResized,
        left: MARGIN + Math.floor((CARD_W - (backMeta.width ?? CARD_W)) / 2),
        top: MARGIN + CARD_H + GAP,
      },
    ])
    .jpeg({ quality: 92 })
    .toBuffer()

  return composed
}
