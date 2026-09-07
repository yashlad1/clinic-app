import { makeTestDb, T0 } from './testing';
import { insertVaccine } from './repo/catalog';
import { LATEST_VERSION, currentVersion, migrate, DataNewerThanAppError } from './migrate';
import { openNodeDb } from './driver.node';
import { recordAdministration, recordReceipt, fillMissingChild } from '../domain/ledger';
import { findOrCreateLot } from './repo/lots';

const DOSE = { name: 'Pentavac PFS', unit_mode: 'DOSE' as const, doses_per_vial: 1, min_balance_doses: 10 };
const VIAL = { name: 'BCG', unit_mode: 'VIAL' as const, doses_per_vial: 10, min_balance_doses: 20 };

describe('migration runner', () => {
  it('migrates a fresh database to the latest version and persists user_version', async () => {
    const db = openNodeDb();
    expect(await currentVersion(db)).toBe(0);
    expect(await migrate(db)).toBe(LATEST_VERSION);
    expect(await currentVersion(db)).toBe(LATEST_VERSION);
  });

  it('is idempotent - running it again is a no-op', async () => {
    const db = openNodeDb();
    await migrate(db);
    expect(await migrate(db)).toBe(LATEST_VERSION);
  });

  it('refuses to open data written by a NEWER app', async () => {
    const db = openNodeDb();
    await migrate(db);
    await db.exec(`PRAGMA user_version = ${LATEST_VERSION + 5}`);
    // Silent partial writes against a future schema is how data is lost invisibly.
    await expect(migrate(db)).rejects.toThrow(DataNewerThanAppError);
  });

  it('takes a snapshot before upgrading an existing database, but not on a fresh one', async () => {
    const fresh = openNodeDb();
    const snapshot = jest.fn().mockResolvedValue(undefined);
    await migrate(fresh, { snapshot });
    expect(snapshot).not.toHaveBeenCalled();
  });
});

describe('catalog constraints kill the misspelling failure mode', () => {
  it('rejects a duplicate vaccine name', async () => {
    const { db } = await makeTestDb({ seed: [VIAL] });
    // The same vaccine cannot exist twice, so "unique values" is structural.
    await expect(insertVaccine(db, VIAL, 'd')).rejects.toThrow();
  });

  it('rejects a DOSE-mode vaccine claiming more than one dose per vial', async () => {
    const { db } = await makeTestDb({ seed: [] });
    await expect(
      insertVaccine(db, { ...DOSE, doses_per_vial: 10 }, 'd'),
    ).rejects.toThrow();
  });

  it('rejects a non-positive doses_per_vial', async () => {
    const { db } = await makeTestDb({ seed: [] });
    await expect(
      insertVaccine(db, { ...VIAL, name: 'Weird', doses_per_vial: 0 }, 'd'),
    ).rejects.toThrow();
  });
});

describe('ledger constraints', () => {
  const insert = (db: any, over: Record<string, unknown> = {}) => {
    const row: Record<string, any> = {
      id: 'm-' + Math.random().toString(36).slice(2),
      idempotency_key: 'k-' + Math.random().toString(36).slice(2),
      delta_doses: -1,
      movement_type: 'ADMINISTRATION',
      wastage_reason: null,
      reverses_id: null,
      ...over,
    };
    return db.run(
      `INSERT INTO stock_movements
        (id, idempotency_key, vaccine_id, delta_doses, movement_type, wastage_reason,
         reverses_id, occurred_at, local_date, local_time, tz_offset_minutes,
         recorded_at, created_at, updated_at, device_id)
       VALUES (?,?,?,?,?,?,?,?,'2026-09-06','10:30',330,?,?,?,'d')`,
      [
        row.id, row.idempotency_key, row.vaccine_id, row.delta_doses, row.movement_type,
        row.wastage_reason, row.reverses_id, T0, T0, T0, T0,
      ],
    );
  };

  it('enforces that the sign of delta_doses matches the movement type', async () => {
    const { db, vaccineId } = await makeTestDb({ seed: [VIAL] });
    const v = await vaccineId('BCG');
    await expect(insert(db, { vaccine_id: v, movement_type: 'RECEIPT', delta_doses: -5 })).rejects.toThrow();
    await expect(insert(db, { vaccine_id: v, movement_type: 'ADMINISTRATION', delta_doses: 5 })).rejects.toThrow();
    await expect(insert(db, { vaccine_id: v, movement_type: 'WASTAGE', delta_doses: 3 })).rejects.toThrow();
    await expect(insert(db, { vaccine_id: v, movement_type: 'OPENING_BALANCE', delta_doses: -1 })).rejects.toThrow();
  });

  it('rejects a zero-dose movement', async () => {
    const { db, vaccineId } = await makeTestDb({ seed: [VIAL] });
    await expect(insert(db, { vaccine_id: await vaccineId('BCG'), delta_doses: 0 })).rejects.toThrow();
  });

  it('rejects an unknown vaccine_id - identity is a foreign key, not a string', async () => {
    const { db } = await makeTestDb({ seed: [VIAL] });
    await expect(insert(db, { vaccine_id: 'does-not-exist' })).rejects.toThrow();
  });

  it('rejects a duplicate idempotency_key, so a replayed write cannot double-decrement', async () => {
    const { db, vaccineId } = await makeTestDb({ seed: [VIAL] });
    const v = await vaccineId('BCG');
    await insert(db, { vaccine_id: v, idempotency_key: 'same' });
    await expect(insert(db, { vaccine_id: v, idempotency_key: 'same' })).rejects.toThrow();
  });

  it('rejects a wastage_reason on a non-wastage movement', async () => {
    const { db, vaccineId } = await makeTestDb({ seed: [VIAL] });
    await expect(
      insert(db, { vaccine_id: await vaccineId('BCG'), wastage_reason: 'BREAKAGE' }),
    ).rejects.toThrow();
  });

  it('rejects reverses_id on a movement that is not a REVERSAL', async () => {
    const { db, vaccineId } = await makeTestDb({ seed: [VIAL] });
    const v = await vaccineId('BCG');
    await insert(db, { vaccine_id: v, id: 'orig', movement_type: 'RECEIPT', delta_doses: 10 });
    await expect(insert(db, { vaccine_id: v, reverses_id: 'orig' })).rejects.toThrow();
  });
});

describe('the ledger is append-only, enforced by the database', () => {
  it('blocks UPDATE of any arithmetic column', async () => {
    const { db, ctx, vaccineId } = await makeTestDb({ seed: [VIAL] });
    const v = await vaccineId('BCG');
    const lot = await findOrCreateLot(db, { vaccineId: v, lotNumber: 'AB1' }, ctx.deviceId, T0);
    const { movement } = await recordReceipt(db, ctx, { clientActionId: 'a1', vaccineId: v, lotId: lot, doses: 30 });

    for (const col of ['delta_doses = -99', "movement_type = 'WASTAGE'", 'occurred_at = 1', "local_date = '2020-01-01'"]) {
      await expect(
        db.run(`UPDATE stock_movements SET ${col} WHERE id = ?`, [movement.id]),
      ).rejects.toThrow(/append-only/);
    }
  });

  it('blocks DELETE entirely', async () => {
    const { db, ctx, vaccineId } = await makeTestDb({ seed: [VIAL] });
    const v = await vaccineId('BCG');
    const { movement } = await recordAdministration(db, ctx, { clientActionId: 'a1', vaccineId: v });
    await expect(db.run(`DELETE FROM stock_movements WHERE id = ?`, [movement.id])).rejects.toThrow(
      /append-only/,
    );
  });

  it('still allows ANNOTATIONS to be completed - a skipped child name is not a rewrite', async () => {
    const { db, ctx, vaccineId } = await makeTestDb({ seed: [VIAL] });
    const v = await vaccineId('BCG');
    const { movement } = await recordAdministration(db, ctx, { clientActionId: 'a1', vaccineId: v });
    expect(movement.needs_detail).toBe(1);

    await fillMissingChild(db, { movementId: movement.id, patientLabel: 'Aarav' }, T0);
    const after = await db.first<{ patient_label: string; needs_detail: number }>(
      `SELECT patient_label, needs_detail FROM stock_movements WHERE id = ?`,
      [movement.id],
    );
    expect(after).toEqual({ patient_label: 'Aarav', needs_detail: 0 });
  });
});
