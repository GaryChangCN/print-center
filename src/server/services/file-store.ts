import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { config } from '../env'
import { getDb } from '../db'

const uploadsDir = () => {
  const dir = path.join(path.resolve(config.dataDir), 'uploads')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

const scansDir = () => {
  const dir = path.join(path.resolve(config.dataDir), 'scans')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export interface StoredFile {
  id: string
  originalName: string
  storedPath: string
  mimeType: string
  size: number
}

export function saveUploadedFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): StoredFile {
  const id = uuid()
  const ext = path.extname(originalName) || '.bin'
  const filename = `${id}${ext}`
  const storedPath = path.join('uploads', filename)
  const fullPath = path.join(uploadsDir(), filename)
  fs.writeFileSync(fullPath, buffer)

  const db = getDb()
  db.prepare(
    `INSERT INTO files (id, original_name, stored_path, mime_type, size)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, originalName, storedPath, mimeType, buffer.length)

  return { id, originalName: originalName, storedPath, mimeType, size: buffer.length }
}

export function saveScanFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): StoredFile {
  const id = uuid()
  const storedPath = path.join('scans', filename)
  const fullPath = path.join(scansDir(), filename)
  fs.writeFileSync(fullPath, buffer)

  const db = getDb()
  db.prepare(
    `INSERT INTO files (id, original_name, stored_path, mime_type, size)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, filename, storedPath, mimeType, buffer.length)

  return { id, originalName: filename, storedPath, mimeType, size: buffer.length }
}

export function getFilePath(fileId: string): string | null {
  const db = getDb()
  const row = db.prepare('SELECT stored_path FROM files WHERE id = ?').get(fileId) as
    | { stored_path: string }
    | undefined
  if (!row) return null
  return path.join(path.resolve(config.dataDir), row.stored_path)
}

export function getFileInfo(fileId: string) {
  const db = getDb()
  return db.prepare('SELECT * FROM files WHERE id = ?').get(fileId) as
    | { id: string; original_name: string; stored_path: string; mime_type: string; size: number; created_at: string }
    | undefined
}

export function deleteFile(fileId: string): boolean {
  const filePath = getFilePath(fileId)
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
  const db = getDb()
  const result = db.prepare('DELETE FROM files WHERE id = ?').run(fileId)
  return result.changes > 0
}
