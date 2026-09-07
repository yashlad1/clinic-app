import { makeTestDb, actions, T0, IST } from '../db/testing';
import { findOrCreateLot } from '../db/repo/lots';
import { createPatient } from '../db/repo/patients';
import {
  recordAdministration,
  recordReceipt,
  recordWastage,
  recordOpeningBalance,
  recordAdjustment,
  reverseMovement,
  isReversed,
  findRecentSimilar,
} from './ledger';

const BCG = { name: 'BCG', unit_mode: 'VIAL' as const, doses_per_vial: 10, min_balance_doses: 20 };
const PENTA = { name: 'Pentavac PFS', unit_mode: 'DOSE' as const, doses_per_vial: 1, min_balance_doses: 10 };

async function env() {
  const e = await makeTestDb({ seed: [BCG, PENTA] });
  const bcg = await e.vaccineId('BCG');
  const penta = await e.vaccineId('Pentavac PFS');
  const lot = await findOrCreateLot(
    e.db,
    { vaccineId: bcg, lotNumber: 'AB1234', expiryDate: '2027-03-31' },
    e.ctx.deviceId,
    T0,
  );
  const onHand = async (v: string) =>
    (await e.db.first<{ n: number }>(`SELECT on_hand_doses AS n FROM v_stock_on_hand WHERE vaccine_id=?`, [v]))!.n;
  return { ...e, bcg, penta, lot, onHand, next: actions() };
}

describe('derived stock', () => {
  it('on-hand = sum of receipts minus administrations minus wastage', async () => {
    const { db, ctx, bcg, lot, onHand, next } = await env();
    await recordReceipt(db, ctx, { clientActionId: next(), vaccineId: bcg, lotId: lot, doses: 30 });
    expect(await onHand(bcg)).toBe(30);

    await recordAdministration(db, ctx, { clientActionId: next(), vaccineId: bcg, lotId: lot });
    await recordAdministration(db, ctx, { clientActionId: next(), vaccineId: bcg, lotId: lot });
    expect(await onHand(bcg)).toBe(28);

    await recordWastage(db, ctx, { clientActionId: next(), vaccineId: bcg, lotId: lot, doses: 3, reason: 'BREAKAGE' });
    expect(await onHand(bcg)).toBe(25);
  });

  it('reports 0 for a vaccine with no movements, rather than omitting it', async () => {
    const { penta, onHand } = await env();
    expect(await onHand(penta)).toBe(0);
  });

  it('records an opening balance when migrating from the notebook', async () => {
    const { db, ctx, bcg, onHand, next } = await env();
    await recordOpeningBalance(db, ctx, { clientActionId: next(), vaccineId: bcg, doses: 42 });
    expect(await onHand(bcg)).toBe(42);
  });

  it('PERMITS negative on-hand and never clamps it - drift must stay visible', async () => {
    const { db, ctx, bcg, lot, onHand, next } = await env();
    await recordReceipt(db, ctx, { clientActionId: next(), vaccineId: bcg, lotId: lot, doses: 5 });
    await recordAdministration(db, ctx, { clientActionId: next(), vaccineId: bcg, lotId: lot, doses: 8 });
    // A negative balance means a receipt was never logged. Clamping to zero
    // would destroy the only signal that says so.
    expect(await onHand(bcg)).toBe(-3);
  });

  it('rejects non-positive quantities at the API boundary', async () => {
    const { db, ctx, bcg, lot, next } = await env();
    await expect(recordReceipt(db, ctx, { clientActionId: next(), vaccineId: bcg, lotId: lot, doses: 0 })).rejects.toThrow();
    await expect(recordAdministration(db, ctx, { clientActionId: next(), vaccineId: bcg, doses: -1 })).rejects.toThrow();
    await expect(recordAdjustment(db, ctx, { clientActionId: next(), vaccineId: bcg, deltaDoses: 0, note: 'x' })).rejects.toThrow();
  });
});

describe('idempotency: a replayed write cannot double-decrement', () => {
  it('returns the existing movement instead of writing a second one', async () => {
    const { db, ctx, bcg, lot, onHand } = await env();
    await recordReceipt(db, ctx, { clientActionId: 'r1', vaccineId: bcg, lotId: lot, doses: 30 });

    const first = await recordAdministration(db, ctx, { clientActionId: 'tap-1', vaccineId: bcg, lotId: lot });
    expect(first.created).toBe(true);

    // The same tap, retried three times - a flaky write, an app killed
    // mid-write, a queue replayed on relaunch.
    for (let i = 0; i < 3; i++) {
      const again = await recordAdministration(db, ctx, { clientActionId: 'tap-1', vaccineId: bcg, lotId: lot });
      expect(again.created).toBe(false);
      expect(again.movement.id).toBe(first.movement.id);
    }
    expect(await onHand(bcg)).toBe(29);
  });

  it('treats a genuinely new tap as a new dose', async () => {
    const { db, ctx, bcg, lot, onHand } = await env();
    await recordReceipt(db, ctx, { clientActionId: 'r1', vaccineId: bcg, lotId: lot, doses: 30 });
    await recordAdministration(db, ctx, { clientActionId: 'tap-1', vaccineId: bcg, lotId: lot });
    await recordAdministration(db, ctx, { clientActionId: 'tap-2', vaccineId: bcg, lotId: lot });
    expect(await onHand(bcg)).toBe(28);
  });

  it('flags a rapid repeat WITHOUT blocking it - siblings and twins are real', async () => {
    const { db, ctx, bcg, lot, onHand } = await env();
    await recordReceipt(db, ctx, { clientActionId: 'r1', vaccineId: bcg, lotId: lot, doses: 30 });
    await recordAdministration(db, ctx, { clientActionId: 'tap-1', vaccineId: bcg, lotId: lot });

    const similar = await findRecentSimilar(
      db,
      { vaccineId: bcg, movementType: 'ADMINISTRATION', deltaDoses: -1 },
      T0 + 20_000,
    );
    expect(similar).not.toBeNull(); // the UI nudges...

    // ...but the second dose still lands. Under-recording is worse than
    // double-recording: a double shows up at reconciliation, a miss looks like theft.
    await recordAdministration(db, ctx, { clientActionId: 'tap-2', vaccineId: bcg, lotId: lot });
    expect(await onHand(bcg)).toBe(28);
  });

  it('does not flag a repeat outside the window', async () => {
    const { db, ctx, bcg, lot } = await env();
    await recordReceipt(db, ctx, { clientActionId: 'r1', vaccineId: bcg, lotId: lot, doses: 30 });
    await recordAdministration(db, ctx, { clientActionId: 'tap-1', vaccineId: bcg, lotId: lot });
    const similar = await findRecentSimilar(
      db,
      { vaccineId: bcg, movementType: 'ADMINISTRATION', deltaDoses: -1 },
      T0 + 60_000,
    );
    expect(similar).toBeNull();
  });
});

describe('reversal is the only undo, and it is the only correction', () => {
  it('restores stock exactly, and the original row still exists', async () => {
    const { db, ctx, bcg, lot, onHand } = await env();
    await recordReceipt(db, ctx, { clientActionId: 'r1', vaccineId: bcg, lotId: lot, doses: 30 });
    const { movement } = await recordAdministration(db, ctx, { clientActionId: 'tap-1', vaccineId: bcg, lotId: lot });
    expect(await onHand(bcg)).toBe(29);

    await reverseMovement(db, ctx, { clientActionId: 'undo-1', movementId: movement.id });
    expect(await onHand(bcg)).toBe(30);

    // Nothing vanished - that is the point.
    const still = await db.first(`SELECT id FROM stock_movements WHERE id = ?`, [movement.id]);
    expect(still).not.toBeNull();
    expect(await isReversed(db, movement.id)).toBe(true);
  });

  it('carries the original lot, so lot balances stay correct', async () => {
    const { db, ctx, bcg, lot } = await env();
    await recordReceipt(db, ctx, { clientActionId: 'r1', vaccineId: bcg, lotId: lot, doses: 30 });
    const { movement } = await recordAdministration(db, ctx, { clientActionId: 'tap-1', vaccineId: bcg, lotId: lot });
    await reverseMovement(db, ctx, { clientActionId: 'undo-1', movementId: movement.id });

    const bal = await db.first<{ n: number }>(`SELECT on_hand_doses AS n FROM v_lot_balance WHERE lot_id=?`, [lot]);
    expect(bal!.n).toBe(30);
  });

  it('reverses a movement at most once, and says so instead of throwing', async () => {
    // This used to assert that a second reversal REJECTS. It does not any more,
    // and the change is deliberate: the second call is a double-tap on
    // "Correct this entry", not a second intent, and an exception there
    // surfaced as an unhandled rejection in the UI. What actually matters is
    // the arithmetic - one reversal row, no double credit - so that is what is
    // asserted now, rather than the mechanism that used to enforce it.
    const { db, ctx, bcg, lot, onHand } = await env();
    await recordReceipt(db, ctx, { clientActionId: 'r1', vaccineId: bcg, lotId: lot, doses: 30 });
    const { movement } = await recordAdministration(db, ctx, { clientActionId: 'tap-1', vaccineId: bcg, lotId: lot });

    const first = await reverseMovement(db, ctx, { clientActionId: 'undo-1', movementId: movement.id });
    const second = await reverseMovement(db, ctx, { clientActionId: 'undo-2', movementId: movement.id });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.movement.id).toBe(first.movement.id);

    const rows = await db.first<{ n: number }>(
      `SELECT COUNT(*) AS n FROM stock_movements WHERE reverses_id = ?`, [movement.id]);
    expect(rows!.n).toBe(1);
    expect(await onHand(bcg)).toBe(30);
  });

  it('refuses to reverse a REVERSAL', async () => {
    const { db, ctx, bcg, lot } = await env();
    await recordReceipt(db, ctx, { clientActionId: 'r1', vaccineId: bcg, lotId: lot, doses: 30 });
    const { movement } = await recordAdministration(db, ctx, { clientActionId: 'tap-1', vaccineId: bcg, lotId: lot });
    const undo = await reverseMovement(db, ctx, { clientActionId: 'undo-1', movementId: movement.id });
    await expect(
      reverseMovement(db, ctx, { clientActionId: 'undo-3', movementId: undo.movement.id }),
    ).rejects.toThrow(/cannot reverse a REVERSAL/);
  });

  it('is itself idempotent - a double-tapped UNDO does not over-credit stock', async () => {
    const { db, ctx, bcg, lot, onHand } = await env();
    await recordReceipt(db, ctx, { clientActionId: 'r1', vaccineId: bcg, lotId: lot, doses: 30 });
    const { movement } = await recordAdministration(db, ctx, { clientActionId: 'tap-1', vaccineId: bcg, lotId: lot });
    await reverseMovement(db, ctx, { clientActionId: 'undo-1', movementId: movement.id });
    await reverseMovement(db, ctx, { clientActionId: 'undo-1', movementId: movement.id });
    expect(await onHand(bcg)).toBe(30);
  });

  it('rejects reversing an unknown movement', async () => {
    const { db, ctx } = await env();
    await expect(
      reverseMovement(db, ctx, { clientActionId: 'u', movementId: 'nope' }),
    ).rejects.toThrow();
  });
});

describe('the child is optional, by design', () => {
  it('records a dose with no child and flags it for day-end completion', async () => {
    const { db, ctx, bcg, lot } = await env();
    await recordReceipt(db, ctx, { clientActionId: 'r1', vaccineId: bcg, lotId: lot, doses: 30 });
    const { movement } = await recordAdministration(db, ctx, { clientActionId: 'tap-1', vaccineId: bcg, lotId: lot });
    expect(movement.patient_id).toBeNull();
    expect(movement.needs_detail).toBe(1);
  });

  it('does not flag a dose that has a child', async () => {
    const { db, ctx, bcg, lot } = await env();
    const child = await createPatient(db, { name: 'Aarav Sharma' }, ctx.deviceId, T0);
    await recordReceipt(db, ctx, { clientActionId: 'r1', vaccineId: bcg, lotId: lot, doses: 30 });
    const { movement } = await recordAdministration(db, ctx, {
      clientActionId: 'tap-1', vaccineId: bcg, lotId: lot, patientId: child, patientLabel: 'Aarav Sharma',
    });
    expect(movement.needs_detail).toBe(0);
    // Denormalised on purpose: renaming the patient must never rewrite history.
    expect(movement.patient_label).toBe('Aarav Sharma');
  });
});

describe('attribution and stamping', () => {
  it('stamps staff, device, and IST local date/time on every row', async () => {
    const { db, ctx, bcg, lot } = await env();
    const { movement } = await recordReceipt(db, ctx, { clientActionId: 'r1', vaccineId: bcg, lotId: lot, doses: 10 });
    expect(movement.staff_id).toBe(ctx.staffId);
    expect(movement.device_id).toBe('test-device');
    expect(movement.tz_offset_minutes).toBe(IST);
    expect(movement.local_date).toBe('2026-09-06');
    expect(movement.local_time).toBe('10:30');
  });

  it('keeps occurred_at separate from recorded_at when backdating', async () => {
    const { db, ctx, bcg, lot } = await env();
    const yesterday = T0 - 24 * 3600_000;
    const { movement } = await recordAdministration(db, ctx, {
      clientActionId: 'b1', vaccineId: bcg, lotId: lot, occurredAt: yesterday,
    });
    // Entering yesterday's notebook page today must not lie about when the
    // dose was actually given.
    expect(movement.local_date).toBe('2026-09-05');
    expect(movement.occurred_at).toBe(yesterday);
    expect(movement.recorded_at).toBe(T0);
  });
});
