import { makeTestDb, T0 } from '../testing';
import {
  activateVaccine, deactivateVaccine, insertVaccine, listRemovedVaccines, listVaccines,
  removeVaccine, restoreVaccine, searchVaccines, vaccineUsage,
} from './catalog';
import { findOrCreateLot } from './lots';
import { recordAdministration, recordReceipt } from '../../domain/ledger';
import { stockOnHand } from '../../domain/reports';
import { dosesCsv } from '../backup/collect';

const BCG = { name: 'BCG', unit_mode: 'VIAL' as const, doses_per_vial: 10, min_balance_doses: 20 };
const PENTA = { name: 'Pentavac PFS', unit_mode: 'DOSE' as const, doses_per_vial: 1, min_balance_doses: 10 };

describe('adding a vaccine', () => {
  it('adds one that then appears in the pickers', async () => {
    const { db } = await makeTestDb({ seed: [BCG] });
    await insertVaccine(db, PENTA, 'dev', T0);
    expect((await listVaccines(db)).map((v) => v.name)).toEqual(['BCG', 'Pentavac PFS']);
  });

  it('is searchable by alias immediately', async () => {
    const { db } = await makeTestDb({ seed: [] });
    await insertVaccine(db, { ...PENTA, aliases: ['penta', 'dpt'] }, 'dev', T0);
    expect((await searchVaccines(db, 'dpt')).map((v) => v.name)).toEqual(['Pentavac PFS']);
  });

  it('still refuses a duplicate name', async () => {
    const { db } = await makeTestDb({ seed: [BCG] });
    await expect(insertVaccine(db, BCG, 'dev', T0)).rejects.toThrow();
  });
});

describe('hiding versus removing', () => {
  it('hiding keeps it in the catalog but out of the active pickers', async () => {
    const { db, vaccineId } = await makeTestDb({ seed: [BCG, PENTA] });
    await deactivateVaccine(db, await vaccineId('BCG'), T0);
    expect((await listVaccines(db, true)).map((v) => v.name)).toEqual(['Pentavac PFS']);
    expect((await listVaccines(db, false)).map((v) => v.name)).toEqual(['BCG', 'Pentavac PFS']);
  });

  it('un-hiding restores it', async () => {
    const { db, vaccineId } = await makeTestDb({ seed: [BCG] });
    const id = await vaccineId('BCG');
    await deactivateVaccine(db, id, T0);
    await activateVaccine(db, id, T0);
    expect((await listVaccines(db, true)).map((v) => v.name)).toEqual(['BCG']);
  });
});

describe('removing a vaccine', () => {
  async function withHistory() {
    const e = await makeTestDb({ seed: [BCG, PENTA] });
    const bcg = await e.vaccineId('BCG');
    const lot = await findOrCreateLot(e.db, { vaccineId: bcg, lotNumber: 'A1' }, e.ctx.deviceId, T0);
    await recordReceipt(e.db, e.ctx, { clientActionId: 'r', vaccineId: bcg, lotId: lot, doses: 30 });
    await recordAdministration(e.db, e.ctx, {
      clientActionId: 'a', vaccineId: bcg, lotId: lot, patientLabel: 'Aarav',
    });
    return { ...e, bcg };
  }

  it('takes it out of every list and every stock total', async () => {
    const { db, bcg } = await withHistory();
    await removeVaccine(db, bcg, T0);

    expect((await listVaccines(db, false)).map((v) => v.name)).toEqual(['Pentavac PFS']);
    expect((await stockOnHand(db)).map((r) => r.name)).toEqual(['Pentavac PFS']);
    expect(await searchVaccines(db, 'BCG')).toEqual([]);
  });

  it('does NOT orphan the ledger - past doses still resolve to a name', async () => {
    const { db, bcg } = await withHistory();
    await removeVaccine(db, bcg, T0);

    // A hard DELETE would break this join, the history screen, and the export.
    const rows = await db.all<{ name: string; delta_doses: number }>(
      `SELECT v.name, m.delta_doses FROM stock_movements m
         JOIN vaccines v ON v.id = m.vaccine_id ORDER BY m.recorded_at`,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('BCG');

    // And the export still names it.
    expect(await dosesCsv(db)).toContain('BCG');
  });

  it('frees the name, so an accidental removal can be undone by re-adding', async () => {
    const { db, bcg } = await withHistory();
    await removeVaccine(db, bcg, T0);
    // ux_vaccines_name is partial on deleted_at IS NULL, so this must succeed.
    await expect(insertVaccine(db, BCG, 'dev', T0)).resolves.toBeTruthy();
  });

  it('can also be undone by restoring the original row', async () => {
    const { db, bcg } = await withHistory();
    await removeVaccine(db, bcg, T0);
    await restoreVaccine(db, bcg, T0);
    expect((await listVaccines(db, true)).map((v) => v.name)).toEqual(['BCG', 'Pentavac PFS']);
    // Its stock comes back with it, because stock was never stored - only derived.
    expect((await stockOnHand(db)).find((r) => r.name === 'BCG')!.on_hand_doses).toBe(29);
  });

  it('lists what has been removed, so nothing disappears silently', async () => {
    const { db, bcg } = await withHistory();
    await removeVaccine(db, bcg, T0);
    expect((await listRemovedVaccines(db)).map((v) => v.name)).toEqual(['BCG']);
  });
});

describe('what removing would cost', () => {
  it('reports stock on hand and doses given, to drive the warning', async () => {
    const { db, ctx, vaccineId } = await makeTestDb({ seed: [BCG] });
    const bcg = await vaccineId('BCG');
    const lot = await findOrCreateLot(db, { vaccineId: bcg, lotNumber: 'A1' }, ctx.deviceId, T0);
    await recordReceipt(db, ctx, { clientActionId: 'r', vaccineId: bcg, lotId: lot, doses: 30 });
    await recordAdministration(db, ctx, { clientActionId: 'a', vaccineId: bcg, lotId: lot, doses: 3 });

    expect(await vaccineUsage(db, bcg)).toEqual({ movements: 2, dosesGiven: 3, onHandDoses: 27 });
  });

  it('reports zeroes for an unused vaccine, so it can be removed without a warning', async () => {
    const { db, vaccineId } = await makeTestDb({ seed: [BCG] });
    expect(await vaccineUsage(db, await vaccineId('BCG'))).toEqual({
      movements: 0, dosesGiven: 0, onHandDoses: 0,
    });
  });
});
