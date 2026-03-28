import { Hono } from 'hono'
import { getDb } from '../db'
import { deleteFile } from '../services/file-store'

const app = new Hono()

// GET /api/history/print — 打印历史
app.get('/print', (c) => {
  const page = Number(c.req.query('page') || 1)
  const limit = Math.min(Number(c.req.query('limit') || 20), 100)
  const offset = (page - 1) * limit

  const db = getDb()
  const items = db.prepare(`
    SELECT p.*, f.original_name as file_name, f.mime_type
    FROM print_jobs p
    LEFT JOIN files f ON p.file_id = f.id
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset)

  const total = (db.prepare('SELECT COUNT(*) as count FROM print_jobs').get() as { count: number }).count

  return c.json({ items, total, page, limit })
})

// GET /api/history/scan — 扫描历史
app.get('/scan', (c) => {
  const page = Number(c.req.query('page') || 1)
  const limit = Math.min(Number(c.req.query('limit') || 20), 100)
  const offset = (page - 1) * limit

  const db = getDb()
  const items = db.prepare(`
    SELECT s.*, f.original_name as file_name, f.mime_type
    FROM scan_jobs s
    LEFT JOIN files f ON s.file_id = f.id
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset)

  const total = (db.prepare('SELECT COUNT(*) as count FROM scan_jobs').get() as { count: number }).count

  return c.json({ items, total, page, limit })
})

// DELETE /api/history/:id — 删除历史记录
app.delete('/:id', (c) => {
  const id = c.req.param('id')
  const db = getDb()

  // 尝试删除打印记录
  const printJob = db.prepare('SELECT file_id FROM print_jobs WHERE id = ?').get(id) as { file_id: string } | undefined
  if (printJob) {
    db.prepare('DELETE FROM print_jobs WHERE id = ?').run(id)
    deleteFile(printJob.file_id)
    return c.json({ success: true })
  }

  // 尝试删除扫描记录
  const scanJob = db.prepare('SELECT file_id FROM scan_jobs WHERE id = ?').get(id) as { file_id: string } | undefined
  if (scanJob) {
    db.prepare('DELETE FROM scan_jobs WHERE id = ?').run(id)
    if (scanJob.file_id) deleteFile(scanJob.file_id)
    return c.json({ success: true })
  }

  return c.json({ error: '记录不存在' }, 404)
})

// POST /api/history/reprint/:id — 重新打印
app.post('/reprint/:id', (c) => {
  const id = c.req.param('id')
  const db = getDb()

  const job = db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!job) return c.json({ error: '打印记录不存在' }, 404)

  // 创建新的打印任务（复用原文件）
  const { mockSubmitPrint } = require('../services/mock/mock-cups')
  const result = mockSubmitPrint(job.file_id as string, {
    copies: job.copies as number,
    paperSize: job.paper_size as string,
    orientation: job.orientation as string,
    pageRange: job.page_range as string,
    duplex: job.duplex as string,
  })

  return c.json(result)
})

export default app
