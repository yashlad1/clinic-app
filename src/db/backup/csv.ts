/**
 * Minimal CSV writer. Deliberately not a dependency: we generate CSV and never
 * parse it (restore uses the .db), so a 20-line function beats papaparse.
 *
 * Quoting matters more than it looks. Indian trade names contain commas and
 * apostrophes, and a clinician opening a mangled sheet in Excel loses trust in
 * the whole app.
 */

export type CsvValue = string | number | boolean | null | undefined;

export function csvCell(v: CsvValue): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Quote if it contains a delimiter, a quote, a newline, or edge whitespace.
  if (/[",\n\r]/.test(s) || s !== s.trim()) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const r of rows) lines.push(r.map(csvCell).join(','));
  // CRLF: Excel on Windows is the most likely consumer after the phone.
  return lines.join('\r\n') + '\r\n';
}

export function objectsToCsv<T extends Record<string, CsvValue>>(
  headers: (keyof T & string)[],
  objects: T[],
): string {
  return toCsv(
    headers,
    objects.map((o) => headers.map((h) => o[h])),
  );
}
