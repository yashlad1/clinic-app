import type { Db } from '../driver';

/**
 * Migration 002 - sync bookkeeping.
 *
 * CLAUDE.md section 6 deferred these on purpose: "add what cannot be
 * backfilled, defer what can." `dirty` and `last_synced_at` are exactly the
 * deferrable kind, and this is the moment they are needed.
 *
 * Additive only, per the migration rules: two ADD COLUMNs per table with
 * defaults, plus partial indexes so "what still needs uploading" is an index
 * scan rather than a table scan on every app foreground.
 *
 * Every row is born `dirty = 1`, INCLUDING the rows already on the phone. That
 * is the point of the DEFAULT: after this migration the existing ledger is
 * queued for upload without a backfill statement, so the first sync carries
 * the whole history rather than only what happens next.
 */

/** The tables that are replicated. `settings` is deliberately NOT one of them. */
export const SYNC_TABLES = [
  'vaccines',
  'lots',
  'patients',
  'staff',
  'stock_movements',
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

export const m002 = {
  to: 2,
  name: 'sync',
  up: async (tx: Db) => {
    for (const table of SYNC_TABLES) {
      // DEFAULT 1 queues everything already recorded on this phone.
      await tx.exec(`ALTER TABLE ${table} ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1`);
      await tx.exec(`ALTER TABLE ${table} ADD COLUMN last_synced_at INTEGER`);
      await tx.exec(
        `CREATE INDEX ix_${table}_dirty ON ${table} (updated_at) WHERE dirty = 1`,
      );
    }

    // Re-dirty on every real edit, in the DATABASE rather than in the eight
    // call sites that currently issue an UPDATE.
    //
    // The condition is `updated_at` changing, which every mutation in this
    // codebase already sets. That is what keeps it from fighting the sync's own
    // "mark these rows synced" write: that write clears `dirty` and does NOT
    // touch `updated_at`, so the trigger stays quiet instead of immediately
    // re-queueing the rows it just uploaded.
    for (const table of SYNC_TABLES) {
      await tx.exec(`
CREATE TRIGGER trg_${table}_dirty
AFTER UPDATE ON ${table}
WHEN NEW.updated_at <> OLD.updated_at
BEGIN
  UPDATE ${table} SET dirty = 1 WHERE id = NEW.id;
END;
      `);
    }

    // `settings` holds device-local state - the device id, the Supabase
    // credentials, the backup counters. Replicating it would overwrite one
    // phone's identity with another's, so it stays local and is reconstructed
    // on a restored phone instead.
    await tx.exec(`
CREATE TABLE sync_log (
  id            TEXT    PRIMARY KEY NOT NULL,
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER,
  pushed_rows   INTEGER NOT NULL DEFAULT 0,
  ok            INTEGER NOT NULL DEFAULT 0 CHECK (ok IN (0,1)),
  -- Kept so a failing phone can be diagnosed over WhatsApp without a debugger.
  error         TEXT,
  device_id     TEXT    NOT NULL
);
CREATE INDEX ix_sync_log_started ON sync_log (started_at DESC);
    `);
  },
};
