import type { Db } from '../driver';
import { newId } from '../../domain/ids';
import type { FundingSource, Lot } from '../../domain/types';

/**
 * Lot writes. Unlike the catalog, creating a lot IS a normal outcome of
 * receiving stock, so the receive screen may create these.
 *
 * The asymmetry is the whole trick for keeping lot traceability usable:
 * the lot number is typed ONCE per delivery, at a desk with the box in hand -
 * never once per child, at the point of care, with an infant crying.
 */

export async function findOrCreateLot(
  db: Db,
  input: {
    vaccineId: string;
    lotNumber: string;
    expiryDate?: string | null;
    fundingSource?: FundingSource;
  },
  deviceId: string,
  now: number = Date.now(),
): Promise<string> {
  const funding = input.fundingSource ?? 'PRIVATE';
  const existing = await db.first<{ id: string }>(
    `SELECT id FROM lots
      WHERE vaccine_id = ? AND lot_number = ? AND funding_source = ? AND deleted_at IS NULL`,
    [input.vaccineId, input.lotNumber, funding],
  );
  if (existing) return existing.id;

  const id = newId(now);
  await db.run(
    `INSERT INTO lots
       (id, vaccine_id, lot_number, expiry_date, funding_source,
        first_received_at, created_at, updated_at, device_id)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, input.vaccineId, input.lotNumber, input.expiryDate ?? null, funding, now, now, now, deviceId],
  );
  return id;
}

export interface LotBalance {
  lot_id: string;
  vaccine_id: string;
  lot_number: string;
  expiry_date: string | null;
  funding_source: FundingSource;
  on_hand_doses: number;
}

/**
 * FEFO - first expiry, first out.
 *
 * Presented as a one-tap SUGGESTION with a visible override, never a silent
 * forced pick: the physical fridge may not match the app (someone already
 * opened a later lot), and silently forcing the "correct" lot makes the record
 * diverge from reality, which is worse than a little wastage.
 */
export function lotsInStock(db: Db, vaccineId: string): Promise<LotBalance[]> {
  return db.all<LotBalance>(
    `SELECT * FROM v_lot_balance
      WHERE vaccine_id = ? AND on_hand_doses > 0
      ORDER BY (expiry_date IS NULL), expiry_date ASC, lot_number ASC`,
    [vaccineId],
  );
}

/** Most-recently-used lot for this vaccine, to preselect in the dose modal. */
export function lastUsedLot(db: Db, vaccineId: string): Promise<LotBalance | null> {
  return db.first<LotBalance>(
    `SELECT b.* FROM v_lot_balance b
       JOIN stock_movements m ON m.lot_id = b.lot_id
      WHERE b.vaccine_id = ? AND b.on_hand_doses > 0
      ORDER BY m.recorded_at DESC LIMIT 1`,
    [vaccineId],
  );
}

export function getLot(db: Db, lotId: string): Promise<Lot | null> {
  return db.first<Lot>(`SELECT * FROM lots WHERE id = ?`, [lotId]);
}

/** Expired = past the LAST day of the printed month (see domain/time.ts). */
export function isExpired(lot: { expiry_date: string | null }, todayLocalDate: string): boolean {
  return !!lot.expiry_date && lot.expiry_date < todayLocalDate;
}
