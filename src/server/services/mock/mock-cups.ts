import { v4 as uuid } from 'uuid'
import { getDb } from '../../db'

const jobTimers = new Map<string, NodeJS.Timeout>()

export function mockSubmitPrint(
  fileId: string,
  options: {
    copies?: number
    paperSize?: string
    orientation?: string
    pageRange?: string
    duplex?: string
  }
) {
  const db = getDb()
  const jobId = uuid()

  db.prepare(
    `INSERT INTO print_jobs (id, file_id, status, copies, paper_size, orientation, page_range, duplex)
     VALUES (?, ?, 'queued', ?, ?, ?, ?, ?)`
  ).run(
    jobId,
    fileId,
    options.copies || 1,
    options.paperSize || 'A4',
    options.orientation || 'portrait',
    options.pageRange || null,
    options.duplex || 'off'
  )

  // 模拟状态流转: queued -> printing (1s) -> completed (3s)
  const t1 = setTimeout(() => {
    db.prepare(`UPDATE print_jobs SET status = 'printing', updated_at = datetime('now') WHERE id = ?`).run(jobId)
  }, 1000)

  const t2 = setTimeout(() => {
    db.prepare(`UPDATE print_jobs SET status = 'completed', updated_at = datetime('now') WHERE id = ?`).run(jobId)
    jobTimers.delete(jobId)
  }, 3000)

  jobTimers.set(jobId, t2)

  return { jobId }
}

export function mockGetPrintStatus(jobId: string) {
  const db = getDb()
  const row = db.prepare(
    'SELECT status, error_message FROM print_jobs WHERE id = ?'
  ).get(jobId) as { status: string; error_message: string | null } | undefined

  if (!row) return null
  return { status: row.status, errorMessage: row.error_message }
}
