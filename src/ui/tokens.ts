import { Platform, type ViewStyle } from 'react-native';

/**
 * Design tokens.
 *
 * "Modern" here means depth, generous spacing and soft surfaces - NOT thin
 * weights, small text or low contrast. Every floor below is a requirement from
 * CLAUDE.md section 8, because the user is a practising pediatrician, likely
 * 50+, working one-handed between patients in a brightly lit room.
 *
 * If a change makes a target smaller than 56dp, text smaller than 14pt, or a
 * state visible by colour alone, it is a regression regardless of how it looks.
 */

export const color = {
  bg: '#FFFFFF',
  /** Soft neutral panels. Replaces the old heavy 2px-bordered boxes. */
  surface: '#F4F6F9',
  surfaceSunken: '#EBEEF3',
  /** Light hairlines, because depth now comes from elevation rather than borders. */
  border: '#E2E6EC',
  borderStrong: '#C4CBD6',

  /** ~17:1 on white. */
  text: '#0F172A',
  /** ~6.2:1 on white - still comfortably above the 4.5:1 floor. */
  textMuted: '#55606E',
  onAccent: '#FFFFFF',

  /**
   * One accent per context, so the two dangerous-to-confuse screens never look
   * alike. Giving a dose and receiving stock move the ledger in OPPOSITE
   * directions, and they now sit next to each other in the top tabs - so hue,
   * wording and button colour all have to differ.
   */
  dose: '#1D4ED8', // blue    - Give dose
  doseSoft: '#EEF3FF',
  stock: '#0F766E', // teal    - Add stock
  stockSoft: '#E6F4F2',
  catalog: '#6D28D9', // violet  - Vaccines
  catalogSoft: '#F3EEFF',
  more: '#475569', // slate   - More

  /** Reserved for stock LEVELS only; never reused as a context accent. */
  ok: '#15803D',
  okSoft: '#E7F7EC',
  low: '#B45309',
  lowSoft: '#FEF3C7',
  danger: '#B91C1C',
  dangerSoft: '#FEE9E9',

  /** Pressed-state overlays. */
  pressed: 'rgba(15, 23, 42, 0.06)',
} as const;

export type Accent = 'dose' | 'stock' | 'catalog' | 'more';

export const accentColor: Record<Accent, string> = {
  dose: color.dose,
  stock: color.stock,
  catalog: color.catalog,
  more: color.more,
};

export const accentSoft: Record<Accent, string> = {
  dose: color.doseSoft,
  stock: color.stockSoft,
  catalog: color.catalogSoft,
  more: color.surface,
};

/** Minimum 56dp: Android's guideline is 48, and this user needs more. */
export const touch = {
  min: 56,
  cta: 64,
  tabBar: 60,
} as const;

export const type = {
  /** The numbers that matter: stock counts, today's total. */
  hero: 34,
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
  medium: '500',
  regular: '400',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Larger radii than before - the main lever for a contemporary feel. */
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/**
 * Soft elevation instead of borders. Kept deliberately subtle: a heavy shadow
 * reads as clutter on a screen that is mostly a grid of tappable tiles.
 */
export function elevation(level: 0 | 1 | 2 | 3): ViewStyle {
  if (level === 0) return {};
  const ios = {
    1: { shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
    2: { shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    3: { shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  }[level];
  const web = {
    boxShadow: `0 ${level * 2}px ${level * 6}px rgba(15,23,42,${0.05 + level * 0.02})`,
  } as unknown as ViewStyle;
  return (Platform.select({
    ios: { shadowColor: '#0F172A', ...ios } as ViewStyle,
    android: { elevation: level * 2 } as ViewStyle,
    default: web,
  }) ?? {}) as ViewStyle;
}

/**
 * Honour the system font scale - this cohort very often has Android's font AND
 * display size turned up. Cap only where clipping would break a layout.
 */
export const MAX_FONT_SCALE = 1.6;
