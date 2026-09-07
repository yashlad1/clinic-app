import { describeStock, dosesFromVials, splitVials, stockLevel } from './stock';

describe('vial <-> dose arithmetic (the clinician never multiplies)', () => {
  it('converts vials to doses', () => {
    expect(dosesFromVials(10, 5)).toBe(50); // 5 BCG vials = 50 doses
    expect(dosesFromVials(20, 1)).toBe(20); // 1 OPV vial = 20 doses
    expect(dosesFromVials(1, 7)).toBe(7); // prefilled syringes
  });

  it('splits doses back into sealed vials plus a remainder', () => {
    expect(splitVials(10, 24)).toEqual({ sealed: 2, remainder: 4 });
    expect(splitVials(10, 30)).toEqual({ sealed: 3, remainder: 0 });
    expect(splitVials(10, 7)).toEqual({ sealed: 0, remainder: 7 });
    expect(splitVials(1, 7)).toEqual({ sealed: 7, remainder: 0 });
  });

  it('administering 3 from a 10-dose vial leaves 7, and the 11th opens a second', () => {
    expect(splitVials(10, 10 - 3)).toEqual({ sealed: 0, remainder: 7 });
    // 2 vials received = 20 doses; after 11 doses, 9 remain = 0 sealed + 9.
    expect(splitVials(10, 20 - 11)).toEqual({ sealed: 0, remainder: 9 });
    // After 10 doses exactly, one full vial remains.
    expect(splitVials(10, 20 - 10)).toEqual({ sealed: 1, remainder: 0 });
  });
});

describe('low-stock boundary', () => {
  it('fires at <= min_balance, not <', () => {
    // Off-by-one here means a vaccine runs out silently.
    expect(stockLevel(11, 10)).toBe('OK');
    expect(stockLevel(10, 10)).toBe('LOW');
    expect(stockLevel(9, 10)).toBe('LOW');
  });

  it('distinguishes OUT from LOW from NEGATIVE', () => {
    expect(stockLevel(0, 10)).toBe('OUT');
    expect(stockLevel(-3, 10)).toBe('NEGATIVE');
  });

  it('treats a min_balance of 0 as "no threshold set"', () => {
    expect(stockLevel(1, 0)).toBe('OK');
    expect(stockLevel(0, 0)).toBe('OUT');
  });
});

describe('stock display', () => {
  it('shows vial-mode stock in both denominations', () => {
    const d = describeStock(24, 'VIAL', 10, 20);
    expect(d.primary).toBe('24 doses');
    expect(d.secondary).toBe('2 vials + 4 doses');
  });

  it('omits the remainder when vials are whole', () => {
    expect(describeStock(30, 'VIAL', 10, 20).secondary).toBe('3 vials');
  });

  it('shows dose-mode stock with no vial line', () => {
    const d = describeStock(18, 'DOSE', 1, 10);
    expect(d.primary).toBe('18 doses');
    expect(d.secondary).toBeUndefined();
  });

  it('singularises', () => {
    expect(describeStock(1, 'DOSE', 1, 0).primary).toBe('1 dose');
    expect(describeStock(10, 'VIAL', 10, 0).secondary).toBe('1 vial');
  });

  it('always pairs a level with a WORD, never colour alone', () => {
    expect(describeStock(5, 'DOSE', 1, 10).badge).toBe('LOW');
    expect(describeStock(0, 'DOSE', 1, 10).badge).toBe('OUT');
    expect(describeStock(-2, 'DOSE', 1, 10).badge).toBe('CHECK');
    expect(describeStock(50, 'DOSE', 1, 10).badge).toBeUndefined();
  });
});
