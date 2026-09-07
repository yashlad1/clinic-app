import { DatabaseSync } from 'node:sqlite';
import type { Db, RunResult } from './driver';

/**
 * Test-only adapter over Node 25's built-in node:sqlite. Chosen over
 * better-sqlite3 because it needs no native prebuild for Node 25's ABI, for
 * identical SQLite semantics.
 *
 * Suppress the experimental warning with:
 *   NODE_OPTIONS=--disable-warning=ExperimentalWarning
 */
function wrap(raw: DatabaseSync, inTx: boolean): Db {
  const db: Db = {
    async exec(sql) {
      raw.exec(sql);
    },
    async run(sql, params = []) {
      const r = raw.prepare(sql).run(...(params as never[]));
      return {
        changes: Number(r.changes),
        lastInsertRowId: Number(r.lastInsertRowid),
      } satisfies RunResult;
    },
    async all<T>(sql: string, params: unknown[] = []) {
      return raw.prepare(sql).all(...(params as never[])) as T[];
    },
    async first<T>(sql: string, params: unknown[] = []) {
      return (raw.prepare(sql).get(...(params as never[])) as T | undefined) ?? null;
    },
    async tx<R>(fn: (tx: Db) => Promise<R>): Promise<R> {
      // SQLite has no real nested transactions; reuse the outer one.
      if (inTx) return fn(db);
      raw.exec('BEGIN IMMEDIATE');
      try {
        const out = await fn(wrap(raw, true));
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        try {
          raw.exec('ROLLBACK');
        } catch {
          /* already rolled back */
        }
        throw e;
      }
    },
  };
  return db;
}

export function openNodeDb(path = ':memory:'): Db {
  const raw = new DatabaseSync(path);
  return wrap(raw, false);
}
