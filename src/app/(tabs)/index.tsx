import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, ErrorState, Input, Loading, T, useBottomInset } from '../../ui/components';
import { color, elevation, radius, space, type, weight } from '../../ui/tokens';
import { useQuery } from '../../db/provider';
import { dosesGivenTotals, vaccinesByUsage } from '../../domain/reports';
import { describeStockRow } from '../../domain/stock';
import { daysAgoLocal, formatDayLabel, todayLocal } from '../../domain/time';
import { BackupBanner } from '../../ui/backup-banner';

/**
 * HOME IS THE DOSE-ENTRY SCREEN, NOT A DASHBOARD.
 *
 * Any design where the doctor lands on summary tiles and then taps "Give dose"
 * has already lost. The grid also does double duty: "what do I have" and "how
 * much is left" - two of the three requested reports - are ambient here, so she
 * never navigates to read them.
 */
export default function GiveDoseScreen() {
  const router = useRouter();
  const bottomInset = useBottomInset();
  const [q, setQ] = useState('');
  const today = todayLocal();
  const since = daysAgoLocal(30);

  const { data: rows, loading, error, reload } = useQuery((db) => vaccinesByUsage(db, since), [since]);
  const { data: given } = useQuery((db) => dosesGivenTotals(db, today), [today]);

  const dosesToday = (given ?? []).reduce((n, g) => n + g.doses, 0);

  const filtered = useMemo(() => {
    const all = rows ?? [];
    if (!q.trim()) return all;
    const needle = q.trim().toLowerCase();
    return all.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        (r.generic_name ?? '').toLowerCase().includes(needle),
    );
  }, [rows, q]);

  /**
   * Counted per level, not as one "not OK" bucket.
   *
   * Lumping them together labelled everything amber "LOW", so a freshly seeded
   * catalog with no stock entered reported "25 LOW" when all 25 were OUT. That
   * is the wrong signal in the wrong colour: LOW means running down, OUT means
   * there is none, and CHECK means the balance went negative and a delivery was
   * probably never logged. CLAUDE.md section 8 requires the colour AND the
   * right word.
   */
  const counts = useMemo(() => {
    const c = { CHECK: 0, OUT: 0, LOW: 0 };
    for (const r of rows ?? []) {
      const level = describeStockRow(r).level;
      if (level === 'NEGATIVE') c.CHECK += 1;
      else if (level === 'OUT') c.OUT += 1;
      else if (level === 'LOW') c.LOW += 1;
    }
    return c;
  }, [rows]);

  // Most urgent first, and only what is actually non-zero.
  const flags = (
    [
      ['CHECK', counts.CHECK, 'danger'],
      ['OUT', counts.OUT, 'danger'],
      ['LOW', counts.LOW, 'low'],
    ] as const
  ).filter(([, n]) => n > 0);

  if (error) return <ErrorState error={error} onRetry={reload} what="load your vaccines" />;
  if (loading && !rows) return <Loading label="Loading vaccines" />;

  return (
    <View style={st.screen}>
      <View style={st.header}>
        <View style={{ flex: 1 }}>
          <T style={st.eyebrow}>{formatDayLabel()}</T>
          <Pressable accessibilityRole="button" onPress={() => router.push('/reports/today')}>
            <T style={st.count}>
              {dosesToday} {dosesToday === 1 ? 'dose' : 'doses'} today
            </T>
          </Pressable>
        </View>
        {flags.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={flags.map(([w, n]) => `${n} ${w}`).join(', ')}
            onPress={() => router.push('/stock')}
            style={st.flags}
          >
            {flags.map(([word, n, tone]) => (
              <Badge key={word} text={`${n} ${word}`} tone={tone} />
            ))}
          </Pressable>
        ) : null}
      </View>

      <View style={st.pad}>
        <BackupBanner />
        {/* Not autofocused: the keyboard must not cover the grid on arrival. */}
        <Input
          placeholder="Search vaccine"
          value={q}
          onChangeText={setQ}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search vaccine"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.vaccine_id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={[st.grid, { paddingBottom: space.xxl + bottomInset }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ padding: space.xl }}>
            <T style={st.emptyText}>
              {q
                ? `No vaccine matches "${q}".`
                : 'No vaccines yet. Add one from the Vaccines tab.'}
            </T>
          </View>
        }
        renderItem={({ item }) => {
          const d = describeStockRow(item);
          const tone = d.level === 'OK' ? color.text : d.level === 'LOW' ? color.low : color.danger;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${d.primary}`}
              onPress={() => router.push(`/dose/${item.vaccine_id}`)}
              style={({ pressed }) => [
                st.tile,
                elevation(1),
                pressed && st.tilePressed,
              ]}
            >
              {d.badge ? (
                <View style={st.tileBadge}>
                  <Badge text={d.badge} tone={d.level === 'LOW' ? 'low' : 'danger'} />
                </View>
              ) : null}
              <T style={st.tileName} numberOfLines={3}>
                {item.name}
              </T>
              <View style={{ flex: 1, minHeight: space.sm }} />
              <T style={[st.tileStock, { color: tone }]}>{d.primary}</T>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  // Wraps rather than clipping the last badge at font scale 1.6x.
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, justifyContent: 'flex-end' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  eyebrow: {
    fontSize: type.min,
    color: color.textMuted,
    fontWeight: weight.semibold,
    letterSpacing: 0.4,
  },
  count: { fontSize: type.hero, fontWeight: weight.bold, color: color.text, marginTop: 2 },
  pad: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md },
  emptyText: { fontSize: type.body, color: color.textMuted, textAlign: 'center', lineHeight: 26 },

  grid: { paddingHorizontal: space.lg, gap: space.md },
  tile: {
    flex: 1,
    minHeight: 138,
    borderRadius: radius.lg,
    padding: space.lg,
    backgroundColor: color.bg,
  },
  tilePressed: { backgroundColor: color.doseSoft, transform: [{ scale: 0.985 }] },
  tileName: { fontSize: type.title, fontWeight: weight.semibold, color: color.text, lineHeight: 27 },
  tileStock: { fontSize: type.body, fontWeight: weight.bold },
  tileBadge: { position: 'absolute', top: space.md, right: space.md, zIndex: 1 },
});
