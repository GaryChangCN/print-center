import { Hono } from 'hono'
import { config } from '../env'
import { getDb } from '../db'
import { getFileInfo, getFilePath, saveUploadedFile } from '../services/file-store'
import { mockSubmitPrint, mockGetPrintStatus } from '../services/mock/mock-cups'
import { submitPrintJob } from '../services/cups'
import { convertToPdf, needsConversion } from '../services/converter'

const app = new Hono()

// POST /api/print/submit — 提交打印任务
app.post('/submit', async (c) => {
  const body = await c.req.json()
  const { fileId, copies, paperSize, orientation, pageRange, duplex, nup } = body

  if (!fileId) return c.json({ error: '请先上传文件' }, 400)
  const fileInfo = getFileInfo(fileId)
  if (!fileInfo) return c.json({ error: '文件不存在' }, 404)

  // 如果是 Office 文档，先转换为 PDF
  let actualFileId = fileId
  let overrideMimeType: string | undefined
  if (needsConversion(fileInfo.mime_type)) {
    try {
      const filePath = getFilePath(fileId)
      if (!filePath) return c.json({ error: '文件不存在' }, 404)
      const pdfPath = await convertToPdf(filePath)
      // 读取转换后的 PDF 并保存为新文件
      const fs = await import('fs')
      const pdfBuffer = fs.readFileSync(pdfPath)
      const stored = saveUploadedFile(pdfBuffer, fileInfo.original_name.replace(/\.\w+$/, '.pdf'), 'application/pdf')
      actualFileId = stored.id
      overrideMimeType = 'application/pdf'
      // 清理临时转换文件
      try { fs.unlinkSync(pdfPath) } catch {}
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : '文档转换失败' }, 500)
    }
  }

  if (config.mockMode) {
    return c.json(mockSubmitPrint(actualFileId, { copies, paperSize, orientation, pageRange, duplex }))
  }

  try {
    const result = await submitPrintJob(actualFileId, { copies, paperSize, orientation, pageRange, duplex, nup, mimeType: overrideMimeType })
    return c.json(result)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : '打印失败' }, 500)
  }
})

// GET /api/print/status/:id — 查询打印状态
app.get('/status/:id', (c) => {
  const jobId = c.req.param('id')
  const db = getDb()
  const row = db.prepare(
    'SELECT status, error_message FROM print_jobs WHERE id = ?'
  ).get(jobId) as { status: string; error_message: string | null } | undefined

  if (!row) return c.json({ error: '任务不存在' }, 404)
  return c.json({ status: row.status, errorMessage: row.error_message })
})

// GET /api/print/options — 打印选项
app.get('/options', (c) => {
  return c.json({
    paperSizes: ['A4', 'A5', 'B5', 'Letter'],
    orientations: ['portrait', 'landscape'],
    duplex: ['off', 'long-edge', 'short-edge'],
    maxCopies: 99,
    supportedFormats: ['pdf', 'jpeg', 'png', 'docx', 'xlsx'],
  })
})

// POST /api/print/upload — 上传并打印（一步完成）
app.post('/upload', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']
  if (!file || !(file instanceof File)) return c.json({ error: '请上传文件' }, 400)
  if (file.size > config.maxFileSize) return c.json({ error: '文件大小超过限制' }, 400)

  const buffer = Buffer.from(await file.arrayBuffer())
  const stored = saveUploadedFile(buffer, file.name, file.type || 'application/octet-stream')

  const copies = Number(body['copies']) || 1
  const paperSize = (body['paperSize'] as string) || 'A4'
  const orientation = (body['orientation'] as string) || 'portrait'
  const pageRange = (body['pageRange'] as string) || ''
  const duplex = (body['duplex'] as string) || 'off'
  const nup = Number(body['nup']) || 1

  // 如果是 Office 文档，先转换为 PDF
  let actualStored = stored
  let overrideMimeType: string | undefined
  if (needsConversion(stored.mimeType)) {
    try {
      const filePath = getFilePath(stored.id)
      if (!filePath) return c.json({ error: '文件不存在' }, 500)
      const pdfPath = await convertToPdf(filePath)
      const fs = await import('fs')
      const pdfBuffer = fs.readFileSync(pdfPath)
      actualStored = saveUploadedFile(pdfBuffer, stored.originalName.replace(/\.\w+$/, '.pdf'), 'application/pdf')
      overrideMimeType = 'application/pdf'
      try { fs.unlinkSync(pdfPath) } catch {}
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : '文档转换失败' }, 500)
    }
  }

  if (config.mockMode) {
    const result = mockSubmitPrint(actualStored.id, { copies, paperSize, orientation, pageRange, duplex })
    return c.json({ ...result, fileId: actualStored.id, fileName: actualStored.originalName })
  }

  try {
    const result = await submitPrintJob(actualStored.id, { copies, paperSize, orientation, pageRange, duplex, nup, mimeType: overrideMimeType })
    return c.json({ ...result, fileId: actualStored.id, fileName: actualStored.originalName })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : '打印失败' }, 500)
  }
})

export default app
