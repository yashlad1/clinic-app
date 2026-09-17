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
  /**
   * The Aero Clinic palette, adapted to React Native.
   *
   * What came across: the ink/ink-soft text pair, sky-deep, caution, clinical,
   * the opaque surface, and the rule that disabled is a TOKEN SWAP rather than
   * a component-wide opacity - that last one is the schema and this file
   * agreeing about the same bug.
   *
   * What could not: `backdrop-filter`, `color-mix`, `@layer`, `::after` and
   * every media query in the sheet have no React Native equivalent, and the
   * glass surface they build is the wrong instrument for a sunlit clinic
   * anyway. Section 8 forbids gradients here for the same reason the schema
   * ships a Vista Basic mode: the opaque rendering is the one that has to be
   * right first. This palette IS that mode.
   *
   * Every value below is measured by contrast.db.test.ts, not asserted.
   */
  bg: '#FFFFFF',
  /** --aero-bg-opaque. Soft neutral panels. */
  surface: '#F2F7FC',
  /** --aero-btn:disabled background, reused as the sunken surface. */
  surfaceSunken: '#E7EDF3',
  /** --aero-rim-outer, flattened: RN has no rgba rim over a blur. */
  border: '#D8E2ED',
  borderStrong: '#B7C6D6',

  /** --ink. 15.9:1 on white. */
  text: '#10233A',
  /** --ink-soft. 7.3:1 - the schema undersells it at 4.9. */
  textMuted: '#46586F',
  onAccent: '#FFFFFF',

  /**
   * One accent per context, still a safety feature rather than styling.
   *
   * The schema ships exactly ONE chrome colour that can carry text on white:
   * --sky-deep at 5.4:1. --aqua (2.2:1) and --grape (4.0:1) are marked fill
   * only, and they are right. But this app paints its accents as TEXT - tab
   * labels, headings, button labels - and it needs three that stay apart at a
   * glance, because Give dose and Add stock move the ledger in opposite
   * directions and sit next to each other.
   *
   * So aqua and grape are deepened along their own hue until they clear 5:1,
   * and the bright originals become the fills they were always meant to be.
   */
  dose: '#1B6FA8', // --sky-deep, 5.4:1   - Give dose
  doseSoft: '#E6F3FC', // --sky, as fill
  stock: '#167B70', // --aqua deepened, 5.1:1 - Add stock
  stockSoft: '#E5F8F6',
  catalog: '#6B5ED6', // --grape deepened, 5.0:1 - Vaccines
  catalogSoft: '#F7F6FE',
  more: '#33455E', // slate, kept clear of textMuted

  /**
   * Reserved for stock LEVELS only; never reused as a context accent.
   *
   * --caution and --clinical come straight from the schema. There is no green
   * in it, so `ok` keeps the measured value it already had: a palette with no
   * "all good" colour cannot supply one.
   */
  ok: '#15803D',
  okSoft: '#EDFAF0',
  low: '#A05E00', // --caution, 5.1:1
  lowSoft: '#FFF3D1', // --caution-fill, as fill
  danger: '#A01E24', // --clinical, 7.8:1
  dangerSoft: '#FAE7E8',

  /**
   * Disabled, as the schema insists: a token swap, never opacity. Its own
   * pairing (#6B7A8D on #E7EDF3) measures 3.7:1, so the text is darkened to
   * clear this app's floor. A greyed-out control still has to be readable to
   * someone deciding whether it is disabled or the app is broken.
   */
  disabledText: '#5E6B7C',
  disabledFill: '#E7EDF3',

  /** UNDO on the dark toast. A token now, so the contrast test can see it. */
  undo: '#8FC7F0',

  /** Pressed-state overlays. */
  pressed: 'rgba(16, 35, 58, 0.06)',
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
    boxShadow: `0 ${level * 2}px ${level * 6}px rgba(16,35,58,${0.05 + level * 0.02})`,
  } as unknown as ViewStyle;
  return (Platform.select({
    ios: { shadowColor: color.text, ...ios } as ViewStyle,
    android: { elevation: level * 2 } as ViewStyle,
    default: web,
  }) ?? {}) as ViewStyle;
}

/**
 * Honour the system font scale - this cohort very often has Android's font AND
 * display size turned up. Cap only where clipping would break a layout.
 */
export const MAX_FONT_SCALE = 1.6;
