import fs from 'fs'
import http from 'http'
import { URL } from 'url'
import { config } from '../env'
import { getDb } from '../db'
import { v4 as uuid } from 'uuid'
import { getFilePath } from './file-store'

export interface PrintJobOptions {
  copies?: number
  paperSize?: string
  orientation?: string
  pageRange?: string
  duplex?: string
}

/** 通过 IPP 协议向远程 CUPS 提交打印任务 */
export async function submitPrintJob(
  fileId: string,
  options: PrintJobOptions = {}
): Promise<{ jobId: string; cupsJobId: number | null }> {
  const db = getDb()
  const filePath = getFilePath(fileId)
  if (!filePath) throw new Error('文件不存在')
  if (!fs.existsSync(filePath)) throw new Error('文件不存在于磁盘')

  const jobId = uuid()

  db.prepare(
    `INSERT INTO print_jobs (id, file_id, status, copies, paper_size, orientation, page_range, duplex)
     VALUES (?, ?, 'queued', ?, ?, ?, ?, ?)`
  ).run(
    jobId, fileId,
    options.copies ?? 1,
    options.paperSize ?? 'A4',
    options.orientation ?? 'portrait',
    options.pageRange ?? null,
    options.duplex ?? 'off',
  )

  // 异步提交（不阻塞 HTTP 响应）
  submitViaIPP(jobId, filePath, options, db)

  return { jobId, cupsJobId: null }
}

async function submitViaIPP(
  jobId: string,
  filePath: string,
  options: PrintJobOptions,
  db: ReturnType<typeof getDb>
) {
  try {
    db.prepare(
      `UPDATE print_jobs SET status = 'printing', updated_at = datetime('now') WHERE id = ?`
    ).run(jobId)

    const fileBuffer = fs.readFileSync(filePath)
    const mimeType = detectMimeType(filePath)
    const printerUri = `${config.cupsServer}/printers/${config.printerName}`

    // 手动构建 IPP Print-Job 请求
    const ippPayload = buildPrintJobRequest(printerUri, fileBuffer, mimeType, options, jobId)

    const cupsJobId = await sendIPP(printerUri, ippPayload)

    db.prepare(
      `UPDATE print_jobs SET status = 'completed', cups_job_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(cupsJobId, jobId)

    console.log(`✅ 打印任务 ${jobId} 已提交到 CUPS (job-id: ${cupsJobId})`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`❌ 打印任务 ${jobId} 失败:`, msg)
    db.prepare(
      `UPDATE print_jobs SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(msg, jobId)
  }
}

// ─── IPP 二进制协议构建 ───

const IPP_VERSION = [0x02, 0x00] // IPP 2.0
const PRINT_JOB = 0x0002
const TAG_OPERATION = 0x01
const TAG_JOB = 0x02
const TAG_END = 0x03

// IPP 值类型
const VALUE_INTEGER = 0x21
const VALUE_BOOLEAN = 0x22
const VALUE_ENUM = 0x23
const VALUE_KEYWORD = 0x44
const VALUE_URI = 0x45
const VALUE_CHARSET = 0x47
const VALUE_NATURAL_LANG = 0x48
const VALUE_NAME = 0x42
const VALUE_MIMETYPE = 0x49

function writeAttribute(parts: Buffer[], tag: number, name: string, value: Buffer) {
  const nameBuf = Buffer.from(name, 'utf-8')
  const header = Buffer.alloc(1 + 2 + nameBuf.length + 2 + value.length)
  let offset = 0
  header.writeUInt8(tag, offset++)
  header.writeUInt16BE(nameBuf.length, offset); offset += 2
  nameBuf.copy(header, offset); offset += nameBuf.length
  header.writeUInt16BE(value.length, offset)
  value.copy(header, offset + 2)
  parts.push(header)
}

function strVal(s: string): Buffer { return Buffer.from(s, 'utf-8') }
function intVal(n: number): Buffer { const b = Buffer.alloc(4); b.writeInt32BE(n); return b }
function enumVal(n: number): Buffer { return intVal(n) }

function buildPrintJobRequest(
  printerUri: string,
  fileData: Buffer,
  mimeType: string,
  options: PrintJobOptions,
  jobId: string
): Buffer {
  const parts: Buffer[] = []

  // IPP 头：版本(2) + 操作码(2) + 请求ID(4)
  const header = Buffer.alloc(8)
  header[0] = IPP_VERSION[0]
  header[1] = IPP_VERSION[1]
  header.writeUInt16BE(PRINT_JOB, 2)
  header.writeInt32BE(1, 4) // request-id
  parts.push(header)

  // ── Operation attributes ──
  parts.push(Buffer.from([TAG_OPERATION]))
  writeAttribute(parts, VALUE_CHARSET, 'attributes-charset', strVal('utf-8'))
  writeAttribute(parts, VALUE_NATURAL_LANG, 'attributes-natural-language', strVal('zh-cn'))
  writeAttribute(parts, VALUE_URI, 'printer-uri', strVal(printerUri))
  writeAttribute(parts, VALUE_NAME, 'requesting-user-name', strVal('printer-admin'))
  writeAttribute(parts, VALUE_NAME, 'job-name', strVal(`job-${jobId.slice(0, 8)}`))
  writeAttribute(parts, VALUE_MIMETYPE, 'document-format', strVal(mimeType))

  // ── Job attributes ──
  parts.push(Buffer.from([TAG_JOB]))

  // 份数
  const copies = options.copies ?? 1
  if (copies > 1) {
    writeAttribute(parts, VALUE_INTEGER, 'copies', intVal(copies))
  }

  // 纸张
  const mediaSizes: Record<string, string> = {
    A4: 'iso_a4_210x297mm',
    A5: 'iso_a5_148x210mm',
    B5: 'iso_b5_176x250mm',
    Letter: 'na_letter_8.5x11in',
  }
  const media = mediaSizes[options.paperSize ?? ''] ?? 'iso_a4_210x297mm'
  writeAttribute(parts, VALUE_KEYWORD, 'media', strVal(media))

  // 方向: 3=portrait, 4=landscape
  if (options.orientation === 'landscape') {
    writeAttribute(parts, VALUE_ENUM, 'orientation-requested', enumVal(4))
  }

  // 结束标记
  parts.push(Buffer.from([TAG_END]))

  // 文件数据紧跟 IPP 消息之后
  parts.push(fileData)

  return Buffer.concat(parts)
}

/** 发送 IPP 请求到 CUPS，返回 job-id */
function sendIPP(printerUri: string, payload: Buffer): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const url = new URL(printerUri)

    const reqOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 631,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/ipp',
        'Content-Length': payload.length,
      },
    }

    const req = http.request(reqOptions, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks)
        if (body.length < 8) {
          reject(new Error(`IPP 响应过短 (${body.length} bytes), HTTP ${res.statusCode}`))
          return
        }

        // 解析 IPP 响应：版本(2) + 状态码(2) + 请求ID(4)
        const statusCode = body.readUInt16BE(2)
        if (statusCode > 0x00ff) {
          // 错误状态码
          const errorMsg = tryExtractStatusMessage(body) || `IPP error 0x${statusCode.toString(16)}`
          reject(new Error(errorMsg))
          return
        }

        // 尝试提取 job-id
        const cupsJobId = tryExtractJobId(body)
        resolve(cupsJobId)
      })
    })

    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy(new Error('IPP 请求超时 (30s)'))
    })
    req.write(payload)
    req.end()
  })
}

/** 从 IPP 响应中提取 job-id (integer 属性) */
function tryExtractJobId(buf: Buffer): number | null {
  // 简单扫描：找 'job-id' 字符串，前面是 VALUE_INTEGER(0x21)
  const jobIdStr = 'job-id'
  for (let i = 8; i < buf.length - 10; i++) {
    if (buf[i] === VALUE_INTEGER) {
      const nameLen = buf.readUInt16BE(i + 1)
      if (nameLen === jobIdStr.length) {
        const name = buf.toString('utf-8', i + 3, i + 3 + nameLen)
        if (name === jobIdStr) {
          const valLen = buf.readUInt16BE(i + 3 + nameLen)
          if (valLen === 4) {
            return buf.readInt32BE(i + 3 + nameLen + 2)
          }
        }
      }
    }
  }
  return null
}

/** 从 IPP 响应中提取状态消息 */
function tryExtractStatusMessage(buf: Buffer): string | null {
  const marker = 'status-message'
  const idx = buf.indexOf(marker)
  if (idx === -1) return null
  try {
    const valLenOffset = idx + marker.length
    const valLen = buf.readUInt16BE(valLenOffset)
    return buf.toString('utf-8', valLenOffset + 2, valLenOffset + 2 + valLen)
  } catch {
    return null
  }
}

/** 根据文件扩展名推断 MIME 类型 */
function detectMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  return mimeMap[ext ?? ''] ?? 'application/octet-stream'
}
