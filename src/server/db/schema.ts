import type Database from 'better-sqlite3'

export function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS print_jobs (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL REFERENCES files(id),
      status TEXT NOT NULL DEFAULT 'queued',
      cups_job_id INTEGER,
      copies INTEGER DEFAULT 1,
      paper_size TEXT DEFAULT 'A4',
      orientation TEXT DEFAULT 'portrait',
      page_range TEXT,
      duplex TEXT DEFAULT 'off',
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scan_jobs (
      id TEXT PRIMARY KEY,
      file_id TEXT REFERENCES files(id),
      type TEXT NOT NULL DEFAULT 'single',
      status TEXT NOT NULL DEFAULT 'scanning',
      dpi INTEGER DEFAULT 300,
      color_mode TEXT DEFAULT 'gray',
      paper_size TEXT DEFAULT 'A4',
      format TEXT DEFAULT 'pdf',
      page_count INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)
}
