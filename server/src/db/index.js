import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '..', '..', 'data');
const dbPath = process.env.MEDIAGENDA_DB || path.join(dataDir, 'mediagenda.db');

fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

/** Executa uma função dentro de uma transação (rollback automático em erro). */
export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (erro) {
    try { db.exec('ROLLBACK'); } catch { /* ignora */ }
    throw erro;
  }
}

export const nowIso = () => new Date().toISOString();
export { dbPath };
