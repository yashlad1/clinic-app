/**
 * Local-date handling.
 *
 * We compute local_date / local_time ONCE, at write time, and store them.
 * "Vaccines given today" is then an indexed equality test on a stored string:
 * deterministic, unit-testable, and immune to the phone's timezone changing
 * later. Doing it at query time with date('now','localtime') depends on the
 * device's *current* timezone and cannot be tested in CI.
 */

export interface LocalStamp {
  occurredAt: number; // epoch ms UTC
  localDate: string; // 'YYYY-MM-DD'
  localTime: string; // 'HH:MM'
  tzOffsetMinutes: number; // minutes to ADD to UTC to get local (IST = +330)
}

const p2 = (n: number) => String(n).padStart(2, '0');

/**
 * Stamp an instant. `tzOffsetMinutes` defaults to the device's current offset;
 * pass it explicitly in tests to pin behaviour.
 */
export function stamp(at: number = Date.now(), tzOffsetMinutes?: number): LocalStamp {
  // getTimezoneOffset() is minutes to add to LOCAL to get UTC, i.e. inverted.
  const off = tzOffsetMinutes ?? -new Date(at).getTimezoneOffset();
  const shifted = new Date(at + off * 60_000);
  return {
    occurredAt: at,
    localDate: `${shifted.getUTCFullYear()}-${p2(shifted.getUTCMonth() + 1)}-${p2(shifted.getUTCDate())}`,
    localTime: `${p2(shifted.getUTCHours())}:${p2(shifted.getUTCMinutes())}`,
    tzOffsetMinutes: off,
  };
}

/** The local date 'today' is in, for report queries. */
export function todayLocal(at: number = Date.now(), tzOffsetMinutes?: number): string {
  return stamp(at, tzOffsetMinutes).localDate;
}

/**
 * Vials print MM/YYYY and are usable THROUGH that month, so the stored expiry
 * is the LAST day of the printed month. Storing the 1st would write off a whole
 * lot 30 days early, every single time - real money and a real stock-out.
 */
export function expiryFromMonth(year: number, month1to12: number): string {
  const lastDay = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  return `${year}-${p2(month1to12)}-${p2(lastDay)}`;
}

/** Display an expiry back as the clinician sees it on the vial. */
export function expiryToMonthLabel(expiryDate: string): string {
  const [y, m] = expiryDate.split('-');
  return `${m}/${y}`;
}

/** The local date N days before `at`, for usage windows and backup nags. */
export function daysAgoLocal(days: number, at: number = Date.now(), tzOffsetMinutes?: number): string {
  return stamp(at - days * 86_400_000, tzOffsetMinutes).localDate;
}

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;
export const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const;

/**
 * Formatted by hand rather than with toLocaleDateString.
 *
 * Intl output differs between Node's full ICU and Android's Hermes build (Node
 * renders 'Sept', Hermes may render 'Sep'), which makes it both untestable in
 * CI and inconsistent on the device. Explicit tables are deterministic.
 */
export function formatDate(at: number): string {
  const d = new Date(at);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Sun 6 Sep" - short, unambiguous, and no year to read past. */
export function formatDayLabel(at: number = Date.now()): string {
  const d = new Date(at);
  return `${WEEKDAYS[d.getDay()]} ${formatDate(at)}`;
}

export function formatTime12h(localTime: string): string {
  const [hStr, m] = localTime.split(':');
  const h = Number(hStr);
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}
