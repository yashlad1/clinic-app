import { openNodeDb } from '../driver.node';
import { migrate, currentVersion, LATEST_VERSION } from '../migrate';
import { m001 } from './m001_initial';
import { SYNC_TABLES } from './m002_sync';

/**
 * The migration rule from CLAUDE.md section 6: build v(N-1) with real rows,
 * run the chain, and assert every pre-existing row survived and the new
 * columns exist. A migration runs on a phone holding the only copy of a
 * clinic's records, so "it worked on an empty database" proves nothing.
 */

const NOW = Date.UTC(2026, 8, 7, 6, 0, 0);

/** A v1 database with one of everything, as a real phone would have. */
async function buildV1() {
  const db = openNodeDb(':memory:');
  await db.exec('PRAGMA foreign_keys = ON');
  await db.tx(async (tx) => {
    await m001.up(tx);
    await tx.exec('PRAGMA user_version = 1');
  });

  const meta = [NOW, NOW, 'old-phone'];
  await db.run(
    `INSERT INTO vaccines (id,name,unit_mode,doses_per_vial,min_balance_doses,created_at,updated_at,device_id)
     VALUES ('v1','BCG','VIAL',10,20,?,?,?)`, meta);
  await db.run(
    `INSERT INTO patients (id,name,created_at,updated_at,device_id) VALUES ('p1','Aarav',?,?,?)`, meta);
  await db.run(
    `INSERT INTO staff (id,name,created_at,updated_at,device_id) VALUES ('s1','Dr A',?,?,?)`, meta);
  await db.run(
    `INSERT INTO lots (id,vaccine_id,lot_number,funding_source,first_received_at,created_at,updated_at,device_id)
     VALUES ('l1','v1','AB1','PRIVATE',?,?,?,?)`, [NOW, ...meta]);
  await db.run(
    `INSERT INTO stock_movements
       (id,idempotency_key,vaccine_id,lot_id,delta_doses,movement_type,stock_source,
        patient_id,staff_id,occurred_at,local_date,local_time,tz_offset_minutes,
        recorded_at,needs_detail,created_at,updated_at,device_id)
     VALUES ('m1','k1','v1','l1',30,'RECEIPT','CLINIC_STOCK',NULL,'s1',?, '2026-09-07','11:30',330,?,0,?,?,?)`,
    [NOW, NOW, ...meta]);
  return db;
}

describe('migration 002 (sync columns)', () => {
  it('runs the chain from v1 to latest and preserves every row', async () => {
    const db = await buildV1();
    expect(await currentVersion(db)).toBe(1);

    await migrate(db);
    expect(await currentVersion(db)).toBe(LATEST_VERSION);

    for (const table of [...SYNC_TABLES]) {
      const row = await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      expect(row!.n).toBe(1);
    }
    // The ledger row is intact, not merely present.
    const m = await db.first<{ delta_doses: number; movement_type: string }>(
      `SELECT delta_doses, movement_type FROM stock_movements WHERE id = 'm1'`);
    expect(m).toEqual({ delta_doses: 30, movement_type: 'RECEIPT' });
  });

  it('queues the rows that were already on the phone for upload', async () => {
    // The whole point of DEFAULT 1: after upgrading, the first sync carries the
    // existing history, not just what happens next. A phone that has been in
    // use for a month must not silently start replicating from today.
    const db = await buildV1();
    await migrate(db);
    for (const table of [...SYNC_TABLES]) {
      const row = await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE dirty = 1`);
      expect(row!.n).toBe(1);
    }
  });

  it('re-dirties a row when it is genuinely edited', async () => {
    const db = await buildV1();
    await migrate(db);
    await db.run(`UPDATE vaccines SET dirty = 0, last_synced_at = ? WHERE id = 'v1'`, [NOW]);

    // An edit bumps updated_at, which is what the trigger watches.
    await db.run(`UPDATE vaccines SET min_balance_doses = 5, updated_at = ? WHERE id = 'v1'`, [NOW + 1000]);
    const v = await db.first<{ dirty: number }>(`SELECT dirty FROM vaccines WHERE id = 'v1'`);
    expect(v!.dirty).toBe(1);
  });

  it('does not re-dirty rows when sync marks them uploaded', async () => {
    // The recursion that would break sync permanently: if clearing `dirty`
    // re-set it, the queue would never drain and every sync would re-upload
    // the entire ledger.
    const db = await buildV1();
    await migrate(db);
    await db.run(`UPDATE stock_movements SET dirty = 0, last_synced_at = ? WHERE id = 'm1'`, [NOW]);
    const m = await db.first<{ dirty: number }>(`SELECT dirty FROM stock_movements WHERE id = 'm1'`);
    expect(m!.dirty).toBe(0);
  });

  it('still refuses to edit ledger arithmetic after the migration', async () => {
    // Adding columns must not have loosened the append-only triggers.
    const db = await buildV1();
    await migrate(db);
    await expect(
      db.run(`UPDATE stock_movements SET delta_doses = 999 WHERE id = 'm1'`),
    ).rejects.toThrow(/append-only/);
    await expect(db.run(`DELETE FROM stock_movements WHERE id = 'm1'`)).rejects.toThrow(/append-only/);
  });
});

describe('migration 003 (multi-device)', () => {
  it('lets two devices log the same batch, which v2 forbade', async () => {
    const db = await buildV1();
    await migrate(db);
    // Two rows for one physical batch: what happens when two devices both log
    // a delivery from lot AB1 before syncing. Under v2's UNIQUE index the
    // second insert was rejected, which meant refusing a real delivery.
    await db.run(
      `INSERT INTO lots (id,vaccine_id,lot_number,funding_source,first_received_at,created_at,updated_at,device_id)
       VALUES ('l2','v1','AB1','PRIVATE',?,?,?,?)`,
      [NOW, NOW, NOW, 'other-phone'],
    );
    const n = await db.first<{ n: number }>(
      `SELECT COUNT(*) AS n FROM lots WHERE vaccine_id='v1' AND lot_number='AB1'`);
    expect(n!.n).toBe(2);
  });

  it('still refuses two catalog rows for one vaccine name', async () => {
    // The lots index was relaxed; this one must NOT be. It is what makes "one
    // row per vaccine" true, which is the entire point of the app.
    const db = await buildV1();
    await migrate(db);
    await expect(
      db.run(
        `INSERT INTO vaccines (id,name,unit_mode,doses_per_vial,min_balance_doses,created_at,updated_at,device_id)
         VALUES ('v2','BCG','VIAL',10,20,?,?,?)`, [NOW, NOW, 'other-phone']),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('gives every replicated table a pull cursor starting from the beginning', async () => {
    const db = await buildV1();
    await migrate(db);
    const rows = await db.all<{ table_name: string; server_synced_at: string | null }>(
      `SELECT table_name, server_synced_at FROM sync_cursor ORDER BY table_name`);
    expect(rows.map((r) => r.table_name).sort()).toEqual(
      ['lots', 'patients', 'staff', 'stock_movements', 'vaccines'],
    );
    // NULL means "everything the server has", so an upgraded phone pulls the
    // clinic's full history rather than only what happens next.
    expect(rows.every((r) => r.server_synced_at === null)).toBe(true);
  });
});
