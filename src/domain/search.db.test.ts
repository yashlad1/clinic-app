import { matchScore, normalise, searchRank } from './search';

const v = (name: string, generic?: string, aliases?: string[]) => ({
  name,
  generic_name: generic ?? null,
  aliases: aliases ? JSON.stringify(aliases) : null,
});

const CATALOG = [
  v('BCG', 'Bacillus Calmette-Guerin'),
  v('Pentavac PFS', 'DTwP-HepB-Hib', ['penta', 'dpt', 'pentavalent']),
  v('Rotavac', 'Rotavirus'),
  v('Rotarix', 'Rotavirus'),
  v('Td (UIP)', 'Tetanus-diphtheria'),
  v('Tresivac (MMR)', 'Measles-Mumps-Rubella'),
  v('Vaxigrip Tetra', 'Influenza'),
];
const names = (q: string) => searchRank(CATALOG, q).map((x) => x.name);

describe('what people actually type', () => {
  it('finds a vaccine by an alias the schema carries for exactly this', () => {
    // The bug this replaces: every search box ignored `aliases`, so the one
    // thing it exists for did not work anywhere in the app.
    expect(names('dpt')).toEqual(['Pentavac PFS']);
  });

  it('ignores the brackets in a real catalog name', () => {
    expect(names('td uip')).toEqual(['Td (UIP)']);
    expect(names('mmr')).toEqual(['Tresivac (MMR)']);
  });

  it('takes several words in any order', () => {
    expect(names('tetra vaxigrip')).toEqual(['Vaxigrip Tetra']);
  });

  it('every word has to land - typing more must narrow, never widen', () => {
    expect(names('rota bcg')).toEqual([]);
  });

  it('ranks a leading match above one buried mid-word', () => {
    // "vac" is inside Pentavac and Rotavac; Rotavac's is at a word start.
    const out = names('rotavac');
    expect(out[0]).toBe('Rotavac');
  });

  it('searches the generic name too', () => {
    expect(names('rotavirus').sort()).toEqual(['Rotarix', 'Rotavac']);
  });

  it('an empty query leaves the order alone', () => {
    expect(names('')).toEqual(CATALOG.map((x) => x.name));
    expect(names('   ')).toEqual(CATALOG.map((x) => x.name));
  });

  it('survives aliases that are not JSON rather than losing the row', () => {
    expect(matchScore({ name: 'X', aliases: 'plain text alias' }, 'plain')).toBeGreaterThan(0);
  });

  it('normalises case, punctuation and spacing', () => {
    expect(normalise('  Td (UIP)-2 ')).toBe('td uip 2');
  });
});
