import type { Db } from '../driver';
import { PUSH_ORDER } from './m002_sync';

/**
 * Migration 003 - what two writing devices need.
 *
 * Everything here exists because a second device can create the same thing
 * twice before the two have spoken. The doses themselves need nothing: the
 * ledger is append-only with client-generated UUIDs and `idempotency_key` is
 * `deviceId:clientActionId`, so two phones cannot collide on a movement even
 * recording the same child in the same second.
 *
 * See docs/MULTI-DEVICE-PLAN.md for the full hazard list.
 */
export const m003 = {
  to: 3,
  name: 'multidevice',
  up: async (tx: Db) => {
    // ------------------------------------------------------------------
    // The pull watermark, per table.
    //
    // Keyed on the SERVER's clock (`synced_at`, a Postgres `now()` default),
    // never on the client's `updated_at`. A device with a wrong clock writes a
    // skewed `updated_at`, and a watermark built on that would silently skip
    // its rows forever - a sync that loses data while reporting success.
    //
    // Stored as TEXT because it is an ISO timestamp echoed straight back to
    // PostgREST; parsing it here would only add a way to get it wrong.
    // ------------------------------------------------------------------
    await tx.exec(`
CREATE TABLE sync_cursor (
  table_name        TEXT PRIMARY KEY NOT NULL,
  server_synced_at  TEXT,
  updated_at        INTEGER NOT NULL
);
    `);

    // ------------------------------------------------------------------
    // Relax lot identity from UNIQUE to a plain index.
    //
    // THIS IS THE ONE DELIBERATE EXCEPTION to the additive-only rule in
    // CLAUDE.md section 6. It drops an INDEX - never a table, never a column -
    // and no row is lost.
    //
    // Why it has to go: `UNIQUE(vaccine_id, lot_number, funding_source)` is
    // unsatisfiable once two devices can both log a delivery from lot AB123
    // while offline. Keeping it would mean rejecting a real delivery, and
    // refusing to record physical stock to protect an index is the wrong way
    // round.
    //
    // What it costs: two batch chips for one physical batch, when devices
    // genuinely raced. `findOrCreateLot` still deduplicates locally, so this
    // stays rare. What it does NOT cost is arithmetic: per-vaccine stock sums
    // MOVEMENTS, not lots, so every total remains exactly right.
    // ------------------------------------------------------------------
    await tx.exec(`DROP INDEX IF EXISTS ux_lots_identity`);
    await tx.exec(`
CREATE INDEX ix_lots_identity ON lots(vaccine_id, lot_number, funding_source);
    `);

    // ------------------------------------------------------------------
    // Seed the cursor rows so pull has somewhere to write, and a NULL
    // watermark means "everything from the beginning".
    // ------------------------------------------------------------------
    const now = Date.now();
    for (const table of PUSH_ORDER) {
      await tx.run(
        `INSERT INTO sync_cursor (table_name, server_synced_at, updated_at) VALUES (?, NULL, ?)`,
        [table, now],
      );
    }
  },
};
