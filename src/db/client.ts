import Database from 'better-sqlite3';
import { DB_PATH } from '@config';
import { structuredLog } from '@utils/logger';

let db: Database.Database | null = null;

export const getDb = (): Database.Database => {
  if (!db) {
    structuredLog('info', 'Opening SQLite database', { path: DB_PATH });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
};

export const closeDb = () => {
  if (db) {
    db.close();
    db = null;
  }
};
