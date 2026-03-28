import { v4 as uuid } from 'uuid'
import fs from 'fs'
import path from 'path'
import { getDb } from '../../db'
import { config } from '../../env'

// 生成一个简单的灰色测试图片（PNG）用 Buffer 手动构造太复杂，
// 这里用一个 1x1 灰色像素的最小 JPEG 作为 mock
const MOCK_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCACWASwDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYI4Q/SFhSRFJiNELwJMCAVEzBESTw/9oADAMBAAIRAxEAPwD0CiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//2Q==',
  'base64'
)

function ensureScansDir() {
  const dir = path.join(path.resolve(config.dataDir), 'scans')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export async function mockStartScan(options: {
  dpi?: number
  colorMode?: string
  paperSize?: string
  format?: string
}) {
  const db = getDb()
  const jobId = uuid()
  const fileId = uuid()
  const format = options.format || 'jpeg'
  const ext = format === 'jpeg' ? '.jpg' : `.${format}`
  const filename = `scan_${fileId}${ext}`
  const mimeType = format === 'pdf' ? 'application/pdf' : `image/${format}`

  // 写入 mock 文件
  const scansDir = ensureScansDir()
  const filePath = path.join(scansDir, filename)
  fs.writeFileSync(filePath, MOCK_JPEG)

  // 保存文件记录
  db.prepare(
    `INSERT INTO files (id, original_name, stored_path, mime_type, size)
     VALUES (?, ?, ?, ?, ?)`
  ).run(fileId, filename, `scans/${filename}`, mimeType, MOCK_JPEG.length)

  // 保存扫描记录
  db.prepare(
    `INSERT INTO scan_jobs (id, file_id, type, status, dpi, color_mode, paper_size, format)
     VALUES (?, ?, 'single', 'completed', ?, ?, ?, ?)`
  ).run(
    jobId,
    fileId,
    options.dpi || 300,
    options.colorMode || 'gray',
    options.paperSize || 'A4',
    format
  )

  return { jobId, fileId }
}

export async function mockMergeScanPages(fileIds: string[]) {
  // Mock: 返回第一个文件作为"合并结果"
  const db = getDb()
  const fileId = uuid()
  const filename = `merged_${fileId}.pdf`

  const scansDir = ensureScansDir()
  fs.writeFileSync(path.join(scansDir, filename), MOCK_JPEG)

  db.prepare(
    `INSERT INTO files (id, original_name, stored_path, mime_type, size)
     VALUES (?, ?, ?, ?, ?)`
  ).run(fileId, filename, `scans/${filename}`, 'application/pdf', MOCK_JPEG.length)

  return { fileId }
}

export async function mockIdCardScan(side: 'front' | 'back') {
  return mockStartScan({ format: 'jpeg', dpi: 300, colorMode: 'color' })
}
