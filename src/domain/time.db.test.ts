import { stamp, todayLocal, expiryFromMonth, expiryToMonthLabel, formatTime12h } from './time';

const IST = 330;

describe('local date stamping', () => {
  it('stamps IST local date and time from a UTC instant', () => {
    // 2026-09-06 18:45 UTC == 2026-09-07 00:15 IST
    const s = stamp(Date.UTC(2026, 8, 6, 18, 45), IST);
    expect(s.localDate).toBe('2026-09-07');
    expect(s.localTime).toBe('00:15');
    expect(s.tzOffsetMinutes).toBe(IST);
  });

  it('does not shift the local date at midnight IST', () => {
    // 18:29:59 UTC is still 23:59 IST on the 6th; one minute later it is the 7th.
    expect(stamp(Date.UTC(2026, 8, 6, 18, 29), IST).localDate).toBe('2026-09-06');
    expect(stamp(Date.UTC(2026, 8, 6, 18, 30), IST).localDate).toBe('2026-09-07');
  });

  it('is immune to the device timezone changing after the write', () => {
    // The same instant, stamped once in IST. Re-reading it later from a phone
    // set to UTC must not move the row to a different day - which is exactly
    // why local_date is stored rather than computed at query time.
    const at = Date.UTC(2026, 8, 6, 20, 0);
    const written = stamp(at, IST);
    const recomputedElsewhere = stamp(at, 0);
    expect(written.localDate).toBe('2026-09-07');
    expect(recomputedElsewhere.localDate).toBe('2026-09-06');
    // The stored value is the one that counts; it never changes.
    expect(written.localDate).not.toBe(recomputedElsewhere.localDate);
  });

  it('todayLocal agrees with stamp', () => {
    const at = Date.UTC(2026, 8, 6, 5, 0);
    expect(todayLocal(at, IST)).toBe(stamp(at, IST).localDate);
  });
});

describe('expiry is the LAST day of the printed month', () => {
  it.each([
    [2027, 3, '2027-03-31'],
    [2027, 2, '2027-02-28'],
    [2028, 2, '2028-02-29'], // leap year
    [2026, 12, '2026-12-31'],
    [2027, 4, '2027-04-30'],
  ])('%s/%s -> %s', (y, m, expected) => {
    expect(expiryFromMonth(y, m)).toBe(expected);
  });

  it('a vial printed 03/2027 is still usable on 2027-03-15', () => {
    const expiry = expiryFromMonth(2027, 3);
    // Storing 2027-03-01 instead would write the lot off 30 days early.
    expect(expiry > '2027-03-15').toBe(true);
  });

  it('round-trips back to the label on the vial', () => {
    expect(expiryToMonthLabel(expiryFromMonth(2027, 3))).toBe('03/2027');
  });
});

describe('12-hour time display', () => {
  it.each([
    ['00:15', '12:15 am'],
    ['09:05', '9:05 am'],
    ['12:00', '12:00 pm'],
    ['13:30', '1:30 pm'],
    ['23:59', '11:59 pm'],
  ])('%s -> %s', (input, expected) => {
    expect(formatTime12h(input)).toBe(expected);
  });
});
