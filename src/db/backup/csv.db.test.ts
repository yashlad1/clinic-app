import { csvCell, toCsv, objectsToCsv } from './csv';

describe('csv quoting', () => {
  it('leaves simple values alone', () => {
    expect(csvCell('BCG')).toBe('BCG');
    expect(csvCell(30)).toBe('30');
  });

  it('renders null and undefined as empty', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes embedded commas', () => {
    expect(csvCell('Measles, Mumps, Rubella')).toBe('"Measles, Mumps, Rubella"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    expect(csvCell('BCG "SII"')).toBe('"BCG ""SII"""');
  });

  it('passes an apostrophe through unquoted - it is not a CSV metacharacter', () => {
    expect(csvCell("Child's dose")).toBe("Child's dose");
  });

  it('quotes newlines, so a multi-line note cannot break the row structure', () => {
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('quotes values with leading or trailing whitespace so it survives', () => {
    expect(csvCell(' padded ')).toBe('" padded "');
  });
});

describe('csv documents', () => {
  it('writes a header row and CRLF line endings for Excel', () => {
    const out = toCsv(['a', 'b'], [[1, 2], [3, 4]]);
    expect(out).toBe('a,b\r\n1,2\r\n3,4\r\n');
  });

  it('round-trips a realistic dose row with a comma in the vaccine name', () => {
    const csv = objectsToCsv(['date', 'time', 'vaccine', 'child', 'doses'], [
      { date: '2026-09-06', time: '10:30 am', vaccine: 'Measles-Rubella (MR)', child: "O'Brien, Aarav", doses: 1 },
    ]);
    const [, row] = csv.trim().split('\r\n');
    expect(row).toBe('2026-09-06,10:30 am,Measles-Rubella (MR),"O\'Brien, Aarav",1');
    // The comma inside the child's name must not create a sixth column.
    expect(row.split(',').length).toBeGreaterThan(5); // naive split breaks...
    expect(row.match(/"/g)).toHaveLength(2); // ...which is exactly why it is quoted.
  });
});
