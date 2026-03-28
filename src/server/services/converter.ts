import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execFileAsync = promisify(execFile)

/**
 * 使用 LibreOffice 将 Office 文档 (docx, xlsx) 转换为 PDF
 */
export async function convertToPdf(inputPath: string): Promise<string> {
  const dir = path.dirname(inputPath)
  const baseName = path.basename(inputPath, path.extname(inputPath))
  const outputPath = path.join(dir, `${baseName}.pdf`)

  await execFileAsync('libreoffice', [
    '--headless',
    '--norestore',
    '--convert-to', 'pdf',
    '--outdir', dir,
    inputPath,
  ], { timeout: 60000 })

  if (!fs.existsSync(outputPath)) {
    throw new Error('文档转换失败')
  }

  return outputPath
}

/**
 * 判断文件 MIME 类型是否需要转换为 PDF
 */
export function needsConversion(mimeType: string): boolean {
  return [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel',
  ].includes(mimeType)
}
