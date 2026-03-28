import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { config } from '../env'
import { initSchema } from './schema'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    const dbDir = path.resolve(config.dataDir)
    fs.mkdirSync(dbDir, { recursive: true })
    const dbPath = path.join(dbDir, 'history.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}
