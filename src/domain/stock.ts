import type { StockRow, UnitMode } from './types';

/**
 * THE CLINICIAN NEVER MULTIPLIES.
 *
 * Doses are the ledger unit, always. Vials are a packaging fact that this
 * module converts. Vial-to-dose arithmetic done in a hurry, in the head, is
 * where most of the paper notebook's errors came from - so if a screen ever
 * asks a human to multiply, the screen is wrong.
 */

export type StockLevel = 'NEGATIVE' | 'OUT' | 'LOW' | 'OK';

export interface StockDisplay {
  doses: number;
  /** Always dose-denominated: "18 doses". The number that can be acted on. */
  primary: string;
  /** For vial-mode only: "2 vials + 4 doses" - what she'll physically see. */
  secondary?: string;
  level: StockLevel;
  /** Colour is never the only signal; this word always accompanies it. */
  badge?: string;
}

export function dosesFromVials(dosesPerVial: number, vials: number): number {
  return dosesPerVial * vials;
}

export function splitVials(dosesPerVial: number, doses: number) {
  if (dosesPerVial <= 1) return { sealed: doses, remainder: 0 };
  const sign = doses < 0 ? -1 : 1;
  const abs = Math.abs(doses);
  return { sealed: sign * Math.floor(abs / dosesPerVial), remainder: sign * (abs % dosesPerVial) };
}

/**
 * Low-stock boundary is `<=`, not `<`. Off-by-one here means a vaccine runs out
 * silently, which is the whole thing we are trying to prevent.
 */
export function stockLevel(onHandDoses: number, minBalanceDoses: number): StockLevel {
  if (onHandDoses < 0) return 'NEGATIVE';
  if (onHandDoses === 0) return 'OUT';
  if (minBalanceDoses > 0 && onHandDoses <= minBalanceDoses) return 'LOW';
  return 'OK';
}

const plural = (n: number, one: string, many: string) => `${n} ${Math.abs(n) === 1 ? one : many}`;

export function describeStock(
  doses: number,
  unitMode: UnitMode,
  dosesPerVial: number,
  minBalanceDoses: number,
): StockDisplay {
  const level = stockLevel(doses, minBalanceDoses);
  const primary = plural(doses, 'dose', 'doses');

  let secondary: string | undefined;
  if (unitMode === 'VIAL' && dosesPerVial > 1 && doses !== 0) {
    const { sealed, remainder } = splitVials(dosesPerVial, doses);
    secondary =
      remainder === 0
        ? plural(sealed, 'vial', 'vials')
        : `${plural(sealed, 'vial', 'vials')} + ${plural(remainder, 'dose', 'doses')}`;
  }

  const badge =
    level === 'NEGATIVE'
      ? 'CHECK'
      : level === 'OUT'
        ? 'OUT'
        : level === 'LOW'
          ? 'LOW'
          : undefined;

  return { doses, primary, secondary, level, badge };
}

export function describeStockRow(row: StockRow): StockDisplay {
  return describeStock(row.on_hand_doses, row.unit_mode, row.doses_per_vial, row.min_balance_doses);
}
