/**
 * Design tokens.
 *
 * These are requirements, not preferences. The user is a practising
 * pediatrician, likely 50+, working one-handed between patients, reading
 * without glasses, in a bright clinic. Every number here exists for a reason
 * recorded in CLAUDE.md section 8.
 */

export const color = {
  bg: '#FFFFFF',
  surface: '#F9FAFB',
  border: '#D1D5DB',
  borderStrong: '#9CA3AF',

  // ~16:1 on white. Never go lighter than `textMuted` for anything readable.
  text: '#111827',
  textMuted: '#4B5563',
  onDark: '#FFFFFF',

  // All >= 4.5:1 on white. Colour is NEVER the only signal - every state is
  // also carried by a word and an icon, because ~8% of men are red-green
  // colourblind and a sunlit phone screen destroys colour discrimination anyway.
  ok: '#15803D',
  low: '#B45309',
  lowBg: '#FEF3C7',
  danger: '#B91C1C',
  dangerBg: '#FEE2E2',

  primary: '#1D4ED8',
  primaryPressed: '#1E3A8A',
} as const;

/** Minimum 56dp: Android's guideline is 48, and this user needs more. */
export const touch = {
  min: 56,
  cta: 64,
  tabBar: 68,
} as const;

export const type = {
  /** The numbers that matter: stock counts, today's total. */
  hero: 32,
  big: 28,
  /** Vaccine tile titles. */
  title: 22,
  /** Body and list rows. */
  body: 18,
  label: 16,
  /** Absolute floor. Nothing smaller, ever. */
  min: 14,
} as const;

export const weight = {
  bold: '700',
  semibold: '600',
  regular: '400',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/**
 * Honour the system font scale - this cohort very often has Android's font AND
 * display size turned up. Cap only where clipping would break a layout.
 */
export const MAX_FONT_SCALE = 1.6;
