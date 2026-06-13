import Database from 'better-sqlite3-multiple-ciphers'
import { join } from 'path'

export type DB = Database.Database

let db: DB | null = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'page',
  title TEXT NOT NULL DEFAULT '',
  icon TEXT,
  position REAL NOT NULL DEFAULT 0,
  content TEXT,
  trashed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id);

CREATE TABLE IF NOT EXISTS db_props (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '[]',
  position REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_props_db ON db_props(database_id);

CREATE TABLE IF NOT EXISTS db_rows (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  vals TEXT NOT NULL DEFAULT '{}',
  position REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rows_db ON db_rows(database_id);
CREATE INDEX IF NOT EXISTS idx_rows_page ON db_rows(page_id);

CREATE TABLE IF NOT EXISTS views (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  position REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_views_db ON views(database_id);

CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(page_id UNINDEXED, title, body);
`

export function openDatabase(dataDir: string, mek: Buffer): DB {
  closeDatabase()
  const handle = new Database(join(dataDir, 'boardy.db'))
  handle.pragma(`cipher='chacha20'`)
  handle.pragma(`key="x'${mek.toString('hex')}'"`)
  handle.pragma('journal_mode = WAL')
  handle.pragma('foreign_keys = ON')
  // throws SQLITE_NOTADB here if the key is wrong
  handle.exec(SCHEMA)
  db = handle
  return handle
}

export function getDb(): DB {
  if (!db) throw new Error('Database is locked')
  return db
}

export function isOpen(): boolean {
  return db !== null
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
