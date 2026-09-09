import { openNodeDb } from './driver.node';
import { migrate, currentVersion } from './migrate';
import { m001 } from './migrations/m001_initial';
import { LATEST_VERSION } from './migrations';

/**
 * The exact question asked before going live: does the data entered on build 4
 * survive the over-the-air update?
 *
 * An OTA swaps the JavaScript bundle and never touches app-private storage, so
 * clinic.db is not involved. What IS involved is the two new migrations the
 * bundle carries, which run against the existing v1 database on next launch.
 * That is the part worth proving rather than asserting, so this builds a v1
 * database containing exactly what she entered - vaccine names, edited
 * doses-per-vial, deliveries and doses - then runs the real chain and checks
 * every number again.
 */
describe('data entered before the OTA survives it', () => {
  it('keeps every vaccine, vial count and stock number across v1 -> latest', async () => {
    const db = openNodeDb(':memory:');
    await db.exec('PRAGMA foreign_keys = ON');

    // ---- Build a v1 database, the way build 4 left it. ----
    await db.tx(async (tx) => {
      await m001.up(tx);
      await tx.exec(`PRAGMA user_version = 1`);
    });
    expect(await currentVersion(db)).toBe(1);

    const now = 1_788_900_000_000;
    // Two vaccines, including a doses-per-vial she corrected against the fridge.
    await db.run(
      `INSERT INTO vaccines (id,name,aliases,unit_mode,doses_per_vial,min_balance_doses,
                             is_active,sort_hint,created_at,updated_at,device_id)
       VALUES ('v-bcg','BCG','[]','VIAL',20,10,1,0,?,?,'phone4'),
              ('v-ipv','IPV','[]','DOSE',1,5,1,0,?,?,'phone4')`,
      [now, now, now, now],
    );
    await db.run(
      `INSERT INTO lots (id,vaccine_id,lot_number,expiry_date,funding_source,
                         created_at,updated_at,device_id)
       VALUES ('l-1','v-bcg','AB1234','2028-03-31','PRIVATE',?,?,'phone4')`,
      [now, now],
    );
    await db.run(
      `INSERT INTO patients (id,name,created_at,updated_at,device_id)
       VALUES ('p-1','Aarav',?,?,'phone4')`, [now, now],
    );
    // A delivery of 5 vials x 20 = 100 doses, then 3 doses given.
    const mv = (id: string, delta: number, type: string, extra = '') =>
      db.run(
        `INSERT INTO stock_movements (id,idempotency_key,vaccine_id,lot_id,delta_doses,
            movement_type,stock_source,occurred_at,local_date,local_time,tz_offset_minutes,
            recorded_at,needs_detail,created_at,updated_at,device_id${extra ? ',patient_id' : ''})
         VALUES (?,?,'v-bcg','l-1',?,?,'CLINIC_STOCK',?,'2026-09-07','10:30',330,?,0,?,?,'phone4'${extra ? ",'p-1'" : ''})`,
        [id, `phone4:${id}`, delta, type, now, now, now, now],
      );
    await mv('m-1', 100, 'RECEIPT');
    await mv('m-2', -1, 'ADMINISTRATION', 'p');
    await mv('m-3', -1, 'ADMINISTRATION', 'p');
    await mv('m-4', -1, 'ADMINISTRATION');

    const onHandBefore = await db.first<{ n: number }>(
      `SELECT on_hand_doses AS n FROM v_stock_on_hand WHERE vaccine_id='v-bcg'`);
    expect(onHandBefore!.n).toBe(97);

    // ---- The OTA lands and the new bundle migrates on next launch. ----
    const applied = await migrate(db);
    expect(applied).toBe(LATEST_VERSION);

    // ---- Everything she typed is still there, unchanged. ----
    const vaccines = await db.all<{ id: string; name: string; doses_per_vial: number; min_balance_doses: number }>(
      `SELECT id,name,doses_per_vial,min_balance_doses FROM vaccines ORDER BY id`);
    expect(vaccines).toEqual([
      { id: 'v-bcg', name: 'BCG', doses_per_vial: 20, min_balance_doses: 10 },
      { id: 'v-ipv', name: 'IPV', doses_per_vial: 1, min_balance_doses: 5 },
    ]);

    const lot = await db.first<{ lot_number: string; expiry_date: string }>(
      `SELECT lot_number,expiry_date FROM lots WHERE id='l-1'`);
    expect(lot).toEqual({ lot_number: 'AB1234', expiry_date: '2028-03-31' });

    expect((await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM stock_movements`))!.n).toBe(4);
    expect((await db.first<{ name: string }>(`SELECT name FROM patients WHERE id='p-1'`))!.name).toBe('Aarav');

    // The number that actually matters: derived stock is identical.
    const onHandAfter = await db.first<{ n: number }>(
      `SELECT on_hand_doses AS n FROM v_stock_on_hand WHERE vaccine_id='v-bcg'`);
    expect(onHandAfter!.n).toBe(97);
  });

  it('marks the pre-existing rows for upload, so the old data reaches the server too', async () => {
    // Surviving is not enough - data entered before sync existed must also get
    // backed up. `ADD COLUMN dirty NOT NULL DEFAULT 1` is what does that.
    const db = openNodeDb(':memory:');
    await db.exec('PRAGMA foreign_keys = ON');
    await db.tx(async (tx) => { await m001.up(tx); await tx.exec(`PRAGMA user_version = 1`); });
    const now = 1_788_900_000_000;
    await db.run(
      `INSERT INTO vaccines (id,name,aliases,unit_mode,doses_per_vial,min_balance_doses,
                             is_active,sort_hint,created_at,updated_at,device_id)
       VALUES ('v-1','Pentavac PFS','[]','DOSE',1,10,1,0,?,?,'phone4')`, [now, now]);

    await migrate(db);

    const dirty = await db.first<{ n: number }>(`SELECT dirty AS n FROM vaccines WHERE id='v-1'`);
    expect(dirty!.n).toBe(1);
  });
});
