import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput,
  type TextInputProps, View, type ViewStyle,
} from 'react-native';
import { MAX_FONT_SCALE, color, radius, space, touch, type, weight } from './tokens';

/**
 * Every component here encodes a rule from CLAUDE.md section 8. If a change
 * makes a target smaller than 56dp, text smaller than 14pt, or a state visible
 * by colour alone, it is a regression regardless of how it looks.
 */

const scale = { maxFontSizeMultiplier: MAX_FONT_SCALE };

export function T(props: React.ComponentProps<typeof Text>) {
  return <Text {...scale} {...props} />;
}

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.screen, style]}>{children}</View>;
}

export function Scroll({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <ScrollView
      style={[s.screen, style]}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/**
 * Primary call to action: 64dp tall, full width, high contrast, and it always
 * carries a WORD. No icon-only buttons anywhere outside the tab bar - icons are
 * ambiguous to someone coming from paper.
 */
export function BigButton({
  label,
  onPress,
  tone = 'primary',
  disabled,
  sublabel,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'neutral' | 'danger';
  disabled?: boolean;
  sublabel?: string;
}) {
  const bg =
    tone === 'primary' ? color.primary : tone === 'danger' ? color.danger : color.surface;
  const fg = tone === 'neutral' ? color.text : color.onDark;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.bigButton,
        { backgroundColor: disabled ? color.border : pressed ? color.primaryPressed : bg },
        tone === 'neutral' && { borderWidth: 2, borderColor: color.borderStrong },
      ]}
    >
      <T style={[s.bigButtonLabel, { color: disabled ? color.textMuted : fg }]}>{label}</T>
      {sublabel ? (
        <T style={[s.bigButtonSub, { color: disabled ? color.textMuted : fg }]}>{sublabel}</T>
      ) : null}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.secondary}>
      <T style={s.secondaryLabel}>{label}</T>
    </Pressable>
  );
}

/**
 * A state badge. Colour is ALWAYS paired with this word - roughly 8% of men are
 * red-green colourblind, and a sunlit clinic window flattens colour on any phone.
 */
export function Badge({ text, tone }: { text: string; tone: 'low' | 'danger' | 'ok' | 'neutral' }) {
  const map = {
    low: { bg: color.lowBg, fg: color.low },
    danger: { bg: color.dangerBg, fg: color.danger },
    ok: { bg: '#DCFCE7', fg: color.ok },
    neutral: { bg: color.surface, fg: color.textMuted },
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
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  sublabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[s.chip, selected && s.chipSelected]}
    >
      <T style={[s.chipLabel, selected && s.chipLabelSelected]}>{label}</T>
      {sublabel ? <T style={[s.chipSub, selected && s.chipLabelSelected]}>{sublabel}</T> : null}
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
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  quickValues?: number[];
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
          style={[s.stepperBtn, value <= min && s.stepperBtnDisabled]}
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
          style={[s.stepperBtn, value >= max && s.stepperBtnDisabled]}
        >
          <T style={s.stepperSign}>+</T>
        </Pressable>
      </View>
      {quickValues?.length ? (
        <View style={s.chipRow}>
          {quickValues.map((q) => (
            <Chip key={q} label={String(q)} selected={value === q} onPress={() => onChange(q)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: space.xl }}>
      <T style={s.fieldLabel}>{label}</T>
      {hint ? <T style={s.fieldHint}>{hint}</T> : null}
      {children}
    </View>
  );
}

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
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <T style={s.rowTitle}>{title}</T>
        {subtitle ? <T style={s.rowSub}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
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
  const map = tone === 'danger' ? { bg: color.dangerBg, fg: color.danger } : { bg: color.lowBg, fg: color.low };
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
      <ActivityIndicator size="large" color={color.primary} />
      <T style={s.rowSub}>{label}</T>
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={s.center}>
      <T style={s.emptyTitle}>{title}</T>
      {hint ? <T style={s.rowSub}>{hint}</T> : null}
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  emptyTitle: { fontSize: type.title, fontWeight: weight.semibold, color: color.text, textAlign: 'center' },

  bigButton: {
    minHeight: touch.cta,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  bigButtonLabel: { fontSize: type.title, fontWeight: weight.bold },
  bigButtonSub: { fontSize: type.min, marginTop: 2 },

  secondary: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: space.md },
  secondaryLabel: { fontSize: type.body, fontWeight: weight.semibold, color: color.primary },

  badge: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: type.min, fontWeight: weight.bold, letterSpacing: 0.5 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  chip: {
    minHeight: touch.min,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.border,
    backgroundColor: color.bg,
  },
  chipSelected: { borderColor: color.primary, backgroundColor: '#EFF6FF' },
  chipLabel: { fontSize: type.body, fontWeight: weight.semibold, color: color.text },
  chipLabelSelected: { color: color.primary },
  chipSub: { fontSize: type.min, color: color.textMuted },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  stepperBtn: {
    width: touch.min,
    height: touch.min,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: { borderColor: color.border },
  stepperSign: { fontSize: type.big, fontWeight: weight.bold, color: color.text },
  stepperValue: { fontSize: type.hero, fontWeight: weight.bold, color: color.text, minWidth: 64, textAlign: 'center' },

  fieldLabel: { fontSize: type.label, fontWeight: weight.semibold, color: color.textMuted, marginBottom: space.xs },
  fieldHint: { fontSize: type.min, color: color.textMuted, marginBottom: space.sm },
  input: {
    minHeight: touch.min,
    borderWidth: 2,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: type.body,
    color: color.text,
    backgroundColor: color.bg,
  },

  row: {
    minHeight: touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  rowTitle: { fontSize: type.body, fontWeight: weight.semibold, color: color.text },
  rowSub: { fontSize: type.label, color: color.textMuted, marginTop: 2 },

  banner: { borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  bannerText: { fontSize: type.label, fontWeight: weight.semibold },
  bannerActions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  bannerBtn: { minHeight: touch.min - 12, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.sm },
  bannerBtnText: { fontSize: type.label, fontWeight: weight.bold },
});
