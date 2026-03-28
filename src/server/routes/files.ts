import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import fs from 'fs'
import path from 'path'
import { config } from '../env'
import { saveUploadedFile, getFilePath, getFileInfo } from '../services/file-store'

const app = new Hono()

// POST /api/files/upload — 通用文件上传
app.post('/upload', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']
  if (!file || !(file instanceof File)) {
    return c.json({ error: '请上传文件' }, 400)
  }

  if (file.size > config.maxFileSize) {
    return c.json({ error: `文件大小超过限制 (${config.maxFileSize / 1024 / 1024}MB)` }, 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const stored = saveUploadedFile(buffer, file.name, file.type || 'application/octet-stream')

  return c.json({
    id: stored.id,
    name: stored.originalName,
    size: stored.size,
    mimeType: stored.mimeType,
  })
})

// GET /api/files/:id — 下载/获取文件
app.get('/:id', (c) => {
  const fileId = c.req.param('id')
  const info = getFileInfo(fileId)
  if (!info) return c.json({ error: '文件不存在' }, 404)

  const fullPath = path.join(path.resolve(config.dataDir), info.stored_path)
  if (!fs.existsSync(fullPath)) return c.json({ error: '文件不存在' }, 404)

  const fileBuffer = fs.readFileSync(fullPath)
  c.header('Content-Type', info.mime_type)
  c.header('Content-Disposition', `inline; filename="${encodeURIComponent(info.original_name)}"`)
  return c.body(fileBuffer)
})

// POST /api/files/:id/save-edited — 保存编辑后的图片
app.post('/:id/save-edited', async (c) => {
  const fileId = c.req.param('id')
  const info = getFileInfo(fileId)
  if (!info) return c.json({ error: '文件不存在' }, 404)

  const body = await c.req.parseBody()
  const file = body['file']
  if (!file || !(file instanceof File)) {
    return c.json({ error: '请上传编辑后的文件' }, 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const fullPath = path.join(path.resolve(config.dataDir), info.stored_path)
  fs.writeFileSync(fullPath, buffer)

  return c.json({ success: true })
})

export default app
