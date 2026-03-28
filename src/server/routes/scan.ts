import { Hono } from 'hono'
import { PDFDocument } from 'pdf-lib'
import { config } from '../env'
import { saveScanFile, getFilePath, getFileInfo } from '../services/file-store'
import { getDb } from '../db'
import { v4 as uuid } from 'uuid'
import { mockStartScan, mockMergeScanPages, mockIdCardScan } from '../services/mock/mock-scanner'
import { scanOnce, composeIdCard, isScannerBusy } from '../services/scanner'
import fs from 'fs'

const app = new Hono()

// GET /api/scan/status — 扫描设备状态
app.get('/status', (c) => {
  return c.json({ busy: config.mockMode ? false : isScannerBusy() })
})

// POST /api/scan/start — 开始扫描一页
app.post('/start', async (c) => {
  const body = await c.req.json()
  const { dpi = 300, colorMode = 'gray', paperSize = 'A4', format = 'jpeg' } = body

  if (config.mockMode) {
    return c.json(await mockStartScan({ dpi, colorMode, paperSize, format }))
  }

  // 检查扫描设备是否繁忙
  if (isScannerBusy()) {
    return c.json({ error: '扫描设备正忙，请稍后再试' }, 429)
  }

  const db = getDb()
  const jobId = uuid()
  db.prepare(
    `INSERT INTO scan_jobs (id, type, status, dpi, color_mode, paper_size, format)
     VALUES (?, 'single', 'scanning', ?, ?, ?, ?)`
  ).run(jobId, dpi, colorMode, paperSize, format)

  try {
    // 真实扫描
    const imgFormat = format === 'png' ? 'png' : 'jpeg'
    const buffer = await scanOnce({ dpi, colorMode, paperSize, format: imgFormat })
    const mimeType = imgFormat === 'png' ? 'image/png' : 'image/jpeg'
    const filename = `scan_${jobId}.${imgFormat}`
    const stored = saveScanFile(buffer, filename, mimeType)

    db.prepare(
      `UPDATE scan_jobs SET file_id = ?, status = 'completed' WHERE id = ?`
    ).run(stored.id, jobId)

    return c.json({ jobId, fileId: stored.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '扫描失败'
    db.prepare(`UPDATE scan_jobs SET status = 'failed' WHERE id = ?`).run(jobId)
    return c.json({ error: msg }, 500)
  }
})

// POST /api/scan/merge — 多页图片合并为 PDF
app.post('/merge', async (c) => {
  const body = await c.req.json()
  const { fileIds } = body

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return c.json({ error: '请提供要合并的文件' }, 400)
  }

  if (config.mockMode) {
    return c.json(await mockMergeScanPages(fileIds))
  }

  try {
    const pdfDoc = await PDFDocument.create()

    for (const fileId of fileIds) {
      const filePath = getFilePath(fileId)
      if (!filePath || !fs.existsSync(filePath)) {
        return c.json({ error: `文件 ${fileId} 不存在` }, 404)
      }

      const imgBuffer = fs.readFileSync(filePath)
      const info = getFileInfo(fileId)
      const mimeType = info?.mime_type ?? 'image/jpeg'

      let pdfImage
      if (mimeType === 'image/png') {
        pdfImage = await pdfDoc.embedPng(imgBuffer)
      } else {
        pdfImage = await pdfDoc.embedJpg(imgBuffer)
      }

      // A4 尺寸（pt：1pt = 1/72 inch，A4 = 595×842pt）
      const page = pdfDoc.addPage([595, 842])
      const { width, height } = pdfImage.scaleToFit(595, 842)
      page.drawImage(pdfImage, {
        x: (595 - width) / 2,
        y: (842 - height) / 2,
        width,
        height,
      })
    }

    const pdfBytes = await pdfDoc.save()
    const buffer = Buffer.from(pdfBytes)
    const filename = `merged_${uuid()}.pdf`
    const stored = saveScanFile(buffer, filename, 'application/pdf')

    return c.json({ fileId: stored.id })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : '合并失败' }, 500)
  }
})

// POST /api/scan/idcard — 身份证扫描（正面或反面）
app.post('/idcard', async (c) => {
  const body = await c.req.json()
  const { side } = body

  if (!side || !['front', 'back'].includes(side)) {
    return c.json({ error: '请指定扫描面 (front/back)' }, 400)
  }

  if (config.mockMode) {
    return c.json(await mockIdCardScan(side))
  }

  if (isScannerBusy()) {
    return c.json({ error: '扫描设备正忙，请稍后再试' }, 429)
  }

  const db = getDb()
  const jobId = uuid()
  db.prepare(
    `INSERT INTO scan_jobs (id, type, status, dpi, color_mode, paper_size, format)
     VALUES (?, 'idcard', 'scanning', 300, 'color', 'A4', 'jpeg')`
  ).run(jobId)

  try {
    const buffer = await scanOnce({ dpi: 300, colorMode: 'color', paperSize: 'A4', format: 'jpeg' })
    const filename = `idcard_${side}_${jobId}.jpg`
    const stored = saveScanFile(buffer, filename, 'image/jpeg')

    db.prepare(
      `UPDATE scan_jobs SET file_id = ?, status = 'completed' WHERE id = ?`
    ).run(stored.id, jobId)

    return c.json({ jobId, fileId: stored.id })
  } catch (err) {
    db.prepare(`UPDATE scan_jobs SET status = 'failed' WHERE id = ?`).run(jobId)
    return c.json({ error: err instanceof Error ? err.message : '扫描失败' }, 500)
  }
})

// POST /api/scan/idcard/compose — 合成身份证正反面到 A4
app.post('/idcard/compose', async (c) => {
  const body = await c.req.json()
  const { frontFileId, backFileId } = body

  if (!frontFileId || !backFileId) {
    return c.json({ error: '请提供正反面文件 ID' }, 400)
  }

  try {
    const frontPath = getFilePath(frontFileId)
    const backPath = getFilePath(backFileId)
    if (!frontPath || !backPath) return c.json({ error: '文件不存在' }, 404)

    const frontBuffer = fs.readFileSync(frontPath)
    const backBuffer = fs.readFileSync(backPath)

    const composed = await composeIdCard(frontBuffer, backBuffer)
    const filename = `idcard_composed_${uuid()}.jpg`
    const stored = saveScanFile(composed, filename, 'image/jpeg')

    return c.json({ fileId: stored.id })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : '合成失败' }, 500)
  }
})

export default app
