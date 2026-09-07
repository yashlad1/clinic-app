import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput,
  type TextInputProps, View, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { friendlyError } from './errors';
import {
  MAX_FONT_SCALE, type Accent, accentColor, accentSoft, color, elevation, radius, space, touch,
  type, weight,
} from './tokens';

/**
 * Every component here encodes a rule from CLAUDE.md section 8. The look is
 * modern - soft surfaces, real elevation, generous radii - but none of the
 * accessibility floors move: 56dp targets, 18pt body, 14pt absolute minimum,
 * and no state carried by colour alone.
 */

const scale = { maxFontSizeMultiplier: MAX_FONT_SCALE };

export function T(props: React.ComponentProps<typeof Text>) {
  return <Text {...scale} {...props} />;
}

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.screen, style]}>{children}</View>;
}

export function Scroll({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={[s.screen, style]}
      contentContainerStyle={{
        padding: space.lg,
        // Clears Android's navigation bar; see Footer.
        paddingBottom: space.xxl * 2 + insets.bottom,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/**
 * How much room the system takes at the bottom of the screen. Add this to the
 * `paddingBottom` of any list that sits under a `floating` Footer, or the last
 * row hides behind it.
 */
export function useBottomInset() {
  return useSafeAreaInsets().bottom;
}

/**
 * Bottom-anchored action bar. Use this instead of a hand-rolled `footer` style.
 *
 * Android's three-button navigation bar overlaps anything positioned at
 * `bottom: 0`, and by design (CLAUDE.md section 8) every primary CTA in this
 * app lives in the bottom third. Without the inset the button is not merely
 * clipped, it is *untappable* - which is how "ADD A NEW VACCINE" came to look
 * like a feature that had never been built.
 *
 * `floating` overlays a scrolling list (Stock, Vaccines); the default sits in
 * normal flow beneath one (the modals).
 */
export function Footer({
  children,
  floating,
  gap,
  style,
}: {
  children: React.ReactNode;
  floating?: boolean;
  gap?: number;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        s.footer,
        floating ? s.footerFloating : null,
        floating ? elevation(3) : null,
        { paddingBottom: space.lg + insets.bottom },
        gap ? { gap } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * A read failed. Shown instead of a spinner that would otherwise never resolve.
 *
 * `useQuery` has always caught read errors and exposed them, but no screen
 * rendered them, so any failed read became an indefinite <Loading/> with no
 * explanation and no way forward. Retry is wired to useQuery's `reload`, which
 * matters because the most likely causes here - a locked database mid-write, a
 * transient failure - succeed on a second attempt.
 */
export function ErrorState({
  error,
  onRetry,
  what = 'load this screen',
}: {
  error: Error;
  onRetry?: () => void;
  what?: string;
}) {
  return (
    <View style={s.center}>
      <T style={s.errorTitle}>Could not {what}</T>
      <T style={s.errorBody}>{friendlyError(error, { what })}</T>
      {onRetry ? <SecondaryButton label="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

/** A raised panel. The main structural element now that borders are hairlines. */
export function Card({
  children,
  style,
  tone,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  tone?: Accent | 'soft';
  onPress?: () => void;
}) {
  const bg = tone && tone !== 'soft' ? accentSoft[tone] : tone === 'soft' ? color.surface : color.bg;
  const body = (
    <View style={[s.card, { backgroundColor: bg }, tone ? null : elevation(1), style]}>
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}>
      {body}
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <T style={s.sectionTitle}>{children}</T>;
}

/**
 * Primary call to action: 64dp tall, full width, and it always carries a WORD.
 * The `accent` prop is load-bearing, not decoration - it is what makes "GIVE A
 * DOSE" and "ADD TO STOCK" impossible to mistake for one another.
 */
export function BigButton({
  label,
  onPress,
  accent = 'dose',
  variant = 'solid',
  disabled,
  sublabel,
  danger,
}: {
  label: string;
  onPress: () => void;
  accent?: Accent;
  variant?: 'solid' | 'outline';
  disabled?: boolean;
  sublabel?: string;
  danger?: boolean;
}) {
  const base = danger ? color.danger : accentColor[accent];
  const solid = variant === 'solid';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.bigButton,
        solid
          ? { backgroundColor: disabled ? color.surfaceSunken : base }
          : { backgroundColor: color.bg, borderWidth: 2, borderColor: disabled ? color.border : base },
        solid && !disabled ? elevation(2) : null,
        pressed && !disabled ? { transform: [{ scale: 0.985 }], opacity: 0.92 } : null,
      ]}
    >
      <T
        style={[
          s.bigButtonLabel,
          { color: disabled ? color.textMuted : solid ? color.onAccent : base },
        ]}
      >
        {label}
      </T>
      {sublabel ? (
        <T
          style={[
            s.bigButtonSub,
            { color: disabled ? color.textMuted : solid ? 'rgba(255,255,255,0.85)' : color.textMuted },
          ]}
        >
          {sublabel}
        </T>
      ) : null}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  accent = 'dose',
  danger,
}: {
  label: string;
  onPress: () => void;
  accent?: Accent;
  danger?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.secondary}>
      <T style={[s.secondaryLabel, { color: danger ? color.danger : accentColor[accent] }]}>
        {label}
      </T>
    </Pressable>
  );
}

/**
 * A state badge. Colour is ALWAYS paired with this word - roughly 8% of men are
 * red-green colourblind, and a sunlit clinic window flattens colour on any phone.
 */
export function Badge({
  text,
  tone,
}: {
  text: string;
  tone: 'low' | 'danger' | 'ok' | 'neutral';
}) {
  const map = {
    low: { bg: color.lowSoft, fg: color.low },
    danger: { bg: color.dangerSoft, fg: color.danger },
    ok: { bg: color.okSoft, fg: color.ok },
    neutral: { bg: color.surfaceSunken, fg: color.textMuted },
  }[tone];
  return (
    <View style={[s.badge, { backgroundColor: map.bg }]}>
      <T style={[s.badgeText, { color: map.fg }]}>{text}</T>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  sublabel,
  accent = 'dose',
  compact,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  sublabel?: string;
  accent?: Accent;
  compact?: boolean;
}) {
  const base = accentColor[accent];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        compact ? s.chipCompact : null,
        selected
          ? { backgroundColor: accentSoft[accent], borderColor: base }
          : { backgroundColor: color.surface, borderColor: 'transparent' },
        pressed ? { opacity: 0.8 } : null,
      ]}
    >
      <T style={[s.chipLabel, selected ? { color: base } : null]}>{label}</T>
      {sublabel ? <T style={s.chipSub}>{sublabel}</T> : null}
    </Pressable>
  );
}

/**
 * A stepper, not a keyboard.
 *
 * The reason is correctness, not comfort: a stepper CANNOT produce 100 when you
 * meant 10, and in a derived-stock ledger that typo is silent corruption that
 * only surfaces weeks later as inventory that does not exist.
 */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 999,
  quickValues,
  accent = 'dose',
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  quickValues?: number[];
  accent?: Accent;
}) {
  const step = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)));
  return (
    <View>
      <View style={s.stepperRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease"
          onPress={() => step(-1)}
          onLongPress={() => step(-5)}
          disabled={value <= min}
          style={({ pressed }) => [s.stepperBtn, value <= min && s.stepperBtnDisabled, pressed && { opacity: 0.7 }]}
        >
          <T style={s.stepperSign}>−</T>
        </Pressable>
        <T style={s.stepperValue} accessibilityLabel={`${value}`}>
          {value}
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase"
          onPress={() => step(1)}
          onLongPress={() => step(5)}
          disabled={value >= max}
          style={({ pressed }) => [s.stepperBtn, value >= max && s.stepperBtnDisabled, pressed && { opacity: 0.7 }]}
        >
          <T style={s.stepperSign}>+</T>
        </Pressable>
      </View>
      {quickValues?.length ? (
        <View style={s.chipRow}>
          {quickValues.map((q) => (
            <Chip
              key={q}
              compact
              accent={accent}
              label={String(q)}
              selected={value === q}
              onPress={() => onChange(q)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: space.xl }}>
      <T style={s.fieldLabel}>{label}</T>
      {hint ? <T style={s.fieldHint}>{hint}</T> : null}
      {children}
    </View>
  );
}

/** Filled input rather than a boxed one - fewer lines on screen, same target size. */
export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={color.textMuted}
      {...scale}
      {...props}
      style={[s.input, props.style]}
    />
  );
}

export function Row({
  title,
  subtitle,
  right,
  onPress,
  last,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const body = (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1 }}>
        <T style={s.rowTitle}>{title}</T>
        {subtitle ? <T style={s.rowSub}>{subtitle}</T> : null}
      </View>
      {right}
      {onPress ? <T style={s.chevron}>›</T> : null}
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => (pressed ? { backgroundColor: color.pressed } : null)}
    >
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function Banner({
  text,
  tone,
  actionLabel,
  onAction,
  onDismiss,
}: {
  text: string;
  tone: 'low' | 'danger';
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const map =
    tone === 'danger'
      ? { bg: color.dangerSoft, fg: color.danger }
      : { bg: color.lowSoft, fg: color.low };
  return (
    <View style={[s.banner, { backgroundColor: map.bg }]}>
      <T style={[s.bannerText, { color: map.fg }]}>{text}</T>
      <View style={s.bannerActions}>
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction} style={s.bannerBtn}>
            <T style={[s.bannerBtnText, { color: map.fg }]}>{actionLabel}</T>
          </Pressable>
        ) : null}
        {onDismiss ? (
          <Pressable accessibilityRole="button" onPress={onDismiss} style={s.bannerBtn}>
            <T style={[s.bannerBtnText, { color: map.fg }]}>Later</T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={color.dose} />
      <T style={s.rowSub}>{label}</T>
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={s.center}>
      <T style={s.emptyTitle}>{title}</T>
      {hint ? <T style={[s.rowSub, { textAlign: 'center' }]}>{hint}</T> : null}
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    backgroundColor: color.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  footerFloating: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: space.md,
  },
  errorTitle: { fontSize: type.title, fontWeight: weight.bold, color: color.text, textAlign: 'center' },
  errorBody: { fontSize: type.body, color: color.textMuted, textAlign: 'center', lineHeight: 26 },
  emptyTitle: {
    fontSize: type.title,
    fontWeight: weight.semibold,
    color: color.text,
    textAlign: 'center',
  },

  card: { borderRadius: radius.lg, padding: space.lg },
  sectionTitle: {
    fontSize: type.min,
    fontWeight: weight.bold,
    color: color.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: space.xl,
    marginBottom: space.sm,
  },

  bigButton: {
    minHeight: touch.cta,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  bigButtonLabel: { fontSize: type.title, fontWeight: weight.bold, letterSpacing: 0.3 },
  bigButtonSub: { fontSize: type.min, marginTop: 2, fontWeight: weight.medium },

  secondary: { minHeight: touch.min, justifyContent: 'center', alignSelf: 'flex-start' },
  secondaryLabel: { fontSize: type.body, fontWeight: weight.semibold },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: type.min, fontWeight: weight.bold, letterSpacing: 0.6 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  chip: {
    minHeight: touch.min,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  chipCompact: { paddingHorizontal: space.md, minWidth: touch.min },
  chipLabel: { fontSize: type.body, fontWeight: weight.semibold, color: color.text },
  chipSub: { fontSize: type.min, color: color.textMuted, marginTop: 1 },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  stepperBtn: {
    width: touch.min,
    height: touch.min,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: { opacity: 0.4 },
  stepperSign: { fontSize: type.big, fontWeight: weight.bold, color: color.text },
  stepperValue: {
    fontSize: type.hero,
    fontWeight: weight.bold,
    color: color.text,
    minWidth: 72,
    textAlign: 'center',
  },

  fieldLabel: {
    fontSize: type.label,
    fontWeight: weight.semibold,
    color: color.text,
    marginBottom: space.xs,
  },
  fieldHint: { fontSize: type.min, color: color.textMuted, marginBottom: space.sm, lineHeight: 20 },
  input: {
    minHeight: touch.min,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontSize: type.body,
    color: color.text,
    backgroundColor: color.surface,
  },

  row: {
    minHeight: touch.min + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  rowTitle: { fontSize: type.body, fontWeight: weight.semibold, color: color.text },
  rowSub: { fontSize: type.label, color: color.textMuted, marginTop: 2 },
  chevron: { fontSize: type.big, color: color.borderStrong, marginTop: -4 },

  banner: { borderRadius: radius.md, padding: space.lg, marginBottom: space.md },
  bannerText: { fontSize: type.label, fontWeight: weight.semibold, lineHeight: 22 },
  bannerActions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  bannerBtn: {
    minHeight: touch.min - 12,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  bannerBtnText: { fontSize: type.label, fontWeight: weight.bold },
});
