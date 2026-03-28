import { Hono } from 'hono'
import fs from 'fs'
import { getFilePath, getFileInfo, saveUploadedFile } from '../services/file-store'
import { reorderPages, deletePages, mergeDocuments, splitDocument, cropPages, getPageCount } from '../services/pdf-service'

const app = new Hono()

function readPdfBuffer(fileId: string): Buffer | null {
  const filePath = getFilePath(fileId)
  if (!filePath || !fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath)
}

// POST /api/pdf/reorder — 重排页面
app.post('/reorder', async (c) => {
  const { fileId, pageOrder } = await c.req.json()
  const buffer = readPdfBuffer(fileId)
  if (!buffer) return c.json({ error: '文件不存在' }, 404)

  const result = await reorderPages(buffer, pageOrder)
  const info = getFileInfo(fileId)
  const stored = saveUploadedFile(result, info?.original_name || 'reordered.pdf', 'application/pdf')
  return c.json({ fileId: stored.id })
})

// POST /api/pdf/delete-pages — 删除页面
app.post('/delete-pages', async (c) => {
  const { fileId, pages } = await c.req.json()
  const buffer = readPdfBuffer(fileId)
  if (!buffer) return c.json({ error: '文件不存在' }, 404)

  const result = await deletePages(buffer, pages)
  const info = getFileInfo(fileId)
  const stored = saveUploadedFile(result, info?.original_name || 'edited.pdf', 'application/pdf')
  return c.json({ fileId: stored.id })
})

// POST /api/pdf/merge — 合并多个 PDF
app.post('/merge', async (c) => {
  const { fileIds } = await c.req.json()
  if (!Array.isArray(fileIds) || fileIds.length < 2) {
    return c.json({ error: '请提供至少两个文件' }, 400)
  }

  const buffers: Buffer[] = []
  for (const fid of fileIds) {
    const buf = readPdfBuffer(fid)
    if (!buf) return c.json({ error: `文件 ${fid} 不存在` }, 404)
    buffers.push(buf)
  }

  const result = await mergeDocuments(buffers)
  const stored = saveUploadedFile(result, 'merged.pdf', 'application/pdf')
  return c.json({ fileId: stored.id })
})

// POST /api/pdf/split — 拆分 PDF
app.post('/split', async (c) => {
  const { fileId, ranges } = await c.req.json()
  const buffer = readPdfBuffer(fileId)
  if (!buffer) return c.json({ error: '文件不存在' }, 404)

  const results = await splitDocument(buffer, ranges)
  const fileIds: string[] = []
  for (let i = 0; i < results.length; i++) {
    const stored = saveUploadedFile(results[i], `split_${i + 1}.pdf`, 'application/pdf')
    fileIds.push(stored.id)
  }
  return c.json({ fileIds })
})

// POST /api/pdf/crop — 裁剪页面
app.post('/crop', async (c) => {
  const { fileId, crop, pages } = await c.req.json()
  const buffer = readPdfBuffer(fileId)
  if (!buffer) return c.json({ error: '文件不存在' }, 404)

  const result = await cropPages(buffer, crop, pages)
  const info = getFileInfo(fileId)
  const stored = saveUploadedFile(result, info?.original_name || 'cropped.pdf', 'application/pdf')
  return c.json({ fileId: stored.id })
})

// GET /api/pdf/info/:id — 获取 PDF 信息
app.get('/info/:id', async (c) => {
  const fileId = c.req.param('id')
  const buffer = readPdfBuffer(fileId)
  if (!buffer) return c.json({ error: '文件不存在' }, 404)

  const pageCount = await getPageCount(buffer)
  const info = getFileInfo(fileId)
  return c.json({
    fileId,
    fileName: info?.original_name,
    pageCount,
    size: info?.size,
  })
})

export default app
