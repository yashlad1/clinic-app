import React, { useMemo, useRef } from 'react';
import {
  type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View,
} from 'react-native';
import { T } from './components';
import { type Accent, accentColor, accentSoft, color, radius, space, touch, type, weight } from './tokens';
import { MONTHS, expiryFromMonth } from '../domain/time';

/**
 * A scrolling wheel picker - the familiar month/year carousel.
 *
 * Hand-written on purpose, for the same reason as `top-tabs.tsx`: the obvious
 * alternative (`@react-native-picker/picker`) is a native dependency, and a
 * native dependency cannot be tested in Expo Go and rotates the OTA
 * fingerprint. A wheel is two ScrollViews with snapping.
 *
 * Two details that are correctness, not polish:
 *
 * 1. The FIRST item on each wheel is "-", meaning not set. A wheel always
 *    displays something under the selection band, so a wheel that started on a
 *    real month would silently claim an expiry the clinician never entered.
 *    Expiry is optional, and inventing one is worse than omitting it.
 * 2. Rows are `touch.min` tall and individually tappable, so the control still
 *    works for someone who finds flick-scrolling fiddly.
 */

const ITEM = touch.min;
const VISIBLE = 3;
const HEIGHT = ITEM * VISIBLE;

type Item = { value: number | null; label: string };

function Wheel({
  items, value, onChange, accent, label,
}: {
  items: Item[];
  value: number | null;
  onChange: (v: number | null) => void;
  accent: Accent;
  label: string;
}) {
  const ref = useRef<ScrollView>(null);
  const didInit = useRef(false);
  const index = Math.max(0, items.findIndex((i) => i.value === value));

  // Round rather than floor: snapToInterval lands on the nearest row, so the
  // rounded index is where the wheel has actually come to rest.
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(items.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM)));
    if (items[i].value !== value) onChange(items[i].value);
  };

  const tap = (i: number) => {
    ref.current?.scrollTo({ y: i * ITEM, animated: true });
    onChange(items[i].value);
  };

  return (
    <View style={st.col}>
      <T style={st.colLabel}>{label}</T>
      <View style={[st.viewport, { backgroundColor: accentSoft[accent] }]}>
        <View
          pointerEvents="none"
          style={[st.band, { borderColor: accentColor[accent] }]}
        />
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM}
          disableIntervalMomentum
          decelerationRate="fast"
          nestedScrollEnabled
          contentContainerStyle={{ paddingVertical: ITEM }}
          // contentOffset is iOS-only, so position it once the rows exist.
          onContentSizeChange={() => {
            if (didInit.current) return;
            didInit.current = true;
            if (index > 0) ref.current?.scrollTo({ y: index * ITEM, animated: false });
          }}
          onMomentumScrollEnd={settle}
          onScrollEndDrag={settle}
        >
          {items.map((it, i) => {
            const on = it.value === value;
            return (
              <Pressable
                key={it.label}
                onPress={() => tap(i)}
                style={st.item}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${label}: ${it.value === null ? 'not set' : it.label}`}
              >
                <T
                  style={[
                    st.itemText,
                    on && { color: accentColor[accent], fontWeight: weight.bold },
                  ]}
                >
                  {it.label}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export function MonthYearWheel({
  month, year, onMonth, onYear, accent = 'stock',
}: {
  month: number | null;
  year: number | null;
  onMonth: (m: number | null) => void;
  onYear: (y: number | null) => void;
  accent?: Accent;
}) {
  const monthItems = useMemo<Item[]>(
    () => [{ value: null, label: '—' }, ...MONTHS.map((m, i) => ({ value: i + 1, label: m }))],
    [],
  );
  const yearItems = useMemo<Item[]>(() => {
    const y0 = new Date().getFullYear();
    // One year back, because stock already on the shelf can be short-dated,
    // and eight forward, which covers every paediatric vaccine shelf life.
    return [
      { value: null, label: '—' },
      ...Array.from({ length: 10 }, (_, k) => y0 - 1 + k).map((y) => ({ value: y, label: String(y) })),
    ];
  }, []);

  const both = month !== null && year !== null;
  const partial = (month === null) !== (year === null);

  return (
    <View>
      <View style={st.row}>
        <Wheel items={monthItems} value={month} onChange={onMonth} accent={accent} label="Month" />
        <Wheel items={yearItems} value={year} onChange={onYear} accent={accent} label="Year" />
      </View>
      {both ? (
        // Vials print MM/YYYY and are usable THROUGH that month. Spelling out
        // the last usable day is what stops a lot being written off 30 days
        // early - the exact mistake domain/time.ts exists to prevent.
        <T style={[st.note, { color: accentColor[accent] }]}>
          Usable through {lastDayLabel(year!, month!)}
        </T>
      ) : partial ? (
        <T style={st.warn}>Pick both a month and a year, or leave both blank.</T>
      ) : (
        <T style={st.note}>No expiry recorded. You can add it later.</T>
      )}
    </View>
  );
}

function lastDayLabel(year: number, month: number): string {
  const [, m, d] = expiryFromMonth(year, month).split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${year}`;
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  col: { flex: 1 },
  colLabel: {
    fontSize: type.min,
    fontWeight: weight.bold,
    color: color.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: space.xs,
  },
  viewport: { height: HEIGHT, borderRadius: radius.md, overflow: 'hidden' },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM,
    height: ITEM,
    borderTopWidth: 2,
    borderBottomWidth: 2,
  },
  item: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: type.title, color: color.textMuted },
  note: { fontSize: type.min, color: color.textMuted, marginTop: space.sm, fontWeight: weight.semibold },
  warn: { fontSize: type.min, color: color.low, marginTop: space.sm, fontWeight: weight.semibold },
});
