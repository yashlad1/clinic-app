/**
 * WCAG contrast, computed rather than claimed.
 *
 * CLAUDE.md section 8 states specific ratios ("~17:1", "~6.2:1", "all >= 4.5:1").
 * Those numbers were written by hand, and a hand-written contrast ratio is a
 * guess with a decimal point in it. This makes them checkable, so a future
 * palette tweak that quietly drops a colour below the floor fails a test
 * instead of shipping to a clinician working in a bright room.
 */

export function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex colour: ${hex}`);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Relative luminance, per WCAG 2.1. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colours, 1..21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const WCAG = {
  /** Normal-size text and any UI state carried by colour. */
  AA: 4.5,
  /** >=18pt bold or >=24pt regular. Everything here is well above that anyway. */
  AA_LARGE: 3.0,
} as const;

export const round1 = (n: number) => Math.round(n * 10) / 10;
