import type { Db } from '../db/driver';
import type { SyncTable } from '../db/migrations/m002_sync';
import type { Row, SyncBackend } from './backend';
import { PUSH_ORDER } from './push';

/**
 * Rebuild a phone from the server.
 *
 * This is the half that makes the backend worth having: replication without a
 * restore path is theatre. It runs on a fresh install (new phone, or after
 * clearing app data), not continuously.
 *
 * Two ordering requirements, both enforced by real constraints rather than
 * hope:
 *
 *  1. Parents before children - PUSH_ORDER already encodes the FK order, and
 *     `PRAGMA foreign_keys = ON` is set on every connection, so getting this
 *     wrong fails loudly instead of producing an orphaned ledger.
 *  2. Inside `stock_movements`, ordered by `recorded_at` - a REVERSAL carries a
 *     `reverses_id` FK to the movement it reverses, and it is always recorded
 *     after it. Restoring in write order therefore satisfies the self-reference
 *     without deferring constraints.
 */

export interface RestoreReport {
  perTable: Record<string, number>;
  total: number;
}

/** Column list straight from the local schema, so an extra server column is ignored. */
async function localColumns(db: Db, table: SyncTable): Promise<Set<string>> {
  const cols = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
  return new Set(cols.map((c) => c.name));
}

export async function restoreFromServer(
  db: Db,
  backend: SyncBackend,
  now: number = Date.now(),
): Promise<RestoreReport> {
  const perTable: Record<string, number> = {};
  let total = 0;

  for (const table of PUSH_ORDER) {
    const rows = await backend.pullAll(table);
    if (!rows.length) {
      perTable[table] = 0;
      continue;
    }

    const allowed = await localColumns(db, table);
    const ordered =
      table === 'stock_movements'
        ? [...rows].sort((a, b) => Number(a.recorded_at ?? 0) - Number(b.recorded_at ?? 0))
        : rows;

    let n = 0;
    await db.tx(async (tx) => {
      for (const raw of ordered) {
        const row: Row = {};
        for (const [k, v] of Object.entries(raw)) if (allowed.has(k)) row[k] = v;
        // These came FROM the server, so they are already replicated.
        row.dirty = 0;
        row.last_synced_at = now;

        const keys = Object.keys(row);
        const sql =
          `INSERT OR IGNORE INTO ${table} (${keys.join(',')}) ` +
          `VALUES (${keys.map(() => '?').join(',')})`;
        const res = await tx.run(sql, keys.map((k) => row[k]));
        n += res.changes;
      }
    });

    perTable[table] = n;
    total += n;
  }

  return { perTable, total };
}

/**
 * What the server holds, for the confirmation screen. Restore must show real
 * numbers before it touches anything - the same rule the zip restore follows.
 */
export async function previewServer(backend: SyncBackend): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of PUSH_ORDER) {
    counts[table] = (await backend.pullAll(table)).length;
  }
  return counts;
}
