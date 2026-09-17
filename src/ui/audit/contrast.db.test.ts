import { color, accentColor, accentSoft } from '../tokens';
import { WCAG, contrast, round1 } from './contrast';

/**
 * The accessibility floors from CLAUDE.md section 8, enforced rather than
 * documented. The user is a pediatrician, likely 50+, in a brightly lit room -
 * so these are requirements, and a palette change that breaks one is a
 * regression however good it looks.
 */

describe('text on white', () => {
  it('body text clears the CLAUDE.md claim of ~17:1', () => {
    const r = contrast(color.text, color.bg);
    expect(round1(r)).toBeGreaterThanOrEqual(15);
  });

  it('muted text clears the 4.5:1 floor', () => {
    // CLAUDE.md claims ~6.2:1 and forbids any grey below #55606E.
    expect(contrast(color.textMuted, color.bg)).toBeGreaterThanOrEqual(WCAG.AA);
  });
});

describe('every status colour on white', () => {
  // These carry meaning, so they must be readable, not merely visible.
  const statuses = { ok: color.ok, low: color.low, danger: color.danger };
  for (const [name, hex] of Object.entries(statuses)) {
    it(`${name} (${hex}) is at least ${WCAG.AA}:1`, () => {
      expect(contrast(hex, color.bg)).toBeGreaterThanOrEqual(WCAG.AA);
    });
  }
});

describe('every context accent on white', () => {
  for (const [name, hex] of Object.entries(accentColor)) {
    it(`${name} (${hex}) is at least ${WCAG.AA}:1`, () => {
      expect(contrast(hex, color.bg)).toBeGreaterThanOrEqual(WCAG.AA);
    });
  }
});

describe('accent text on its own soft background', () => {
  // Badges and chips put the accent colour on its soft tint, which is a
  // different and stricter pairing than accent-on-white.
  for (const accent of Object.keys(accentColor) as (keyof typeof accentColor)[]) {
    it(`${accent} on ${accent}Soft is at least ${WCAG.AA}:1`, () => {
      expect(contrast(accentColor[accent], accentSoft[accent])).toBeGreaterThanOrEqual(WCAG.AA);
    });
  }
});

describe('badge text on its soft background', () => {
  const pairs: [string, string, string][] = [
    ['ok', color.ok, color.okSoft],
    ['low', color.low, color.lowSoft],
    ['danger', color.danger, color.dangerSoft],
    ['neutral', color.textMuted, color.surfaceSunken],
  ];
  for (const [name, fg, bg] of pairs) {
    it(`${name} badge is at least ${WCAG.AA}:1`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(WCAG.AA);
    });
  }
});

describe('white on a filled accent button', () => {
  // BigButton fills with the accent and writes onAccent over it.
  for (const [name, hex] of Object.entries(accentColor)) {
    it(`onAccent on ${name} is at least ${WCAG.AA}:1`, () => {
      expect(contrast(color.onAccent, hex)).toBeGreaterThanOrEqual(WCAG.AA);
    });
  }
});

/**
 * Pairings the old palette had no tokens for, so the audit could not see them.
 *
 * The Aero schema's own disabled pair (#6B7A8D on #E7EDF3) measures 3.7:1 -
 * below this app's floor - which is exactly the kind of thing a test catches
 * and a copied stylesheet does not.
 */
describe('states that used to sit outside the palette', () => {
  it('disabled text stays readable on the disabled fill', () => {
    expect(contrast(color.disabledText, color.disabledFill)).toBeGreaterThanOrEqual(WCAG.AA);
  });

  it('UNDO clears the floor on the toast it sits on', () => {
    // The most safety-critical control in the app: section 8 makes undo the
    // replacement for confirmation dialogs on the dose path.
    expect(contrast(color.undo, color.text)).toBeGreaterThanOrEqual(WCAG.AA);
  });
});

describe('every accent on its own soft tint', () => {
  // Selected chips and badges paint the accent ON the tint, not on white.
  const pairs = {
    dose: [color.dose, color.doseSoft],
    stock: [color.stock, color.stockSoft],
    catalog: [color.catalog, color.catalogSoft],
  } as const;
  for (const [name, [fg, bg]] of Object.entries(pairs)) {
    it(`${name} on its tint is at least ${WCAG.AA}:1`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(WCAG.AA);
    });
  }
});

describe('the report', () => {
  it('prints every ratio, so a regression is legible not just red', () => {
    const rows: [string, number][] = [
      ['text / bg', contrast(color.text, color.bg)],
      ['textMuted / bg', contrast(color.textMuted, color.bg)],
      ['ok / bg', contrast(color.ok, color.bg)],
      ['low / bg', contrast(color.low, color.bg)],
      ['danger / bg', contrast(color.danger, color.bg)],
      ['dose / bg', contrast(color.dose, color.bg)],
      ['stock / bg', contrast(color.stock, color.bg)],
      ['catalog / bg', contrast(color.catalog, color.bg)],
      ['more / bg', contrast(color.more, color.bg)],
      ['low / lowSoft', contrast(color.low, color.lowSoft)],
      ['danger / dangerSoft', contrast(color.danger, color.dangerSoft)],
      ['ok / okSoft', contrast(color.ok, color.okSoft)],
      ['textMuted / surfaceSunken', contrast(color.textMuted, color.surfaceSunken)],
      ['onAccent / dose', contrast(color.onAccent, color.dose)],
      ['onAccent / stock', contrast(color.onAccent, color.stock)],
      ['onAccent / catalog', contrast(color.onAccent, color.catalog)],
      ['onAccent / more', contrast(color.onAccent, color.more)],
      ['dose / doseSoft', contrast(color.dose, color.doseSoft)],
      ['stock / stockSoft', contrast(color.stock, color.stockSoft)],
      ['catalog / catalogSoft', contrast(color.catalog, color.catalogSoft)],
      ['disabledText / disabledFill', contrast(color.disabledText, color.disabledFill)],
      ['undo / toast', contrast(color.undo, color.text)],
    ];
    // eslint-disable-next-line no-console
    console.log(
      '\n' + rows.map(([k, v]) => `  ${round1(v).toFixed(1).padStart(5)}:1  ${k}`).join('\n'),
    );
    expect(rows.every(([, v]) => v > 1)).toBe(true);
  });
});
