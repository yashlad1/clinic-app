import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Input, Loading, T } from '../../ui/components';
import { color, radius, space, touch, type, weight } from '../../ui/tokens';
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
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const today = todayLocal();
  const since = daysAgoLocal(30);

  const { data: rows, loading } = useQuery((db) => vaccinesByUsage(db, since), [since]);
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

  const lowCount = (rows ?? []).filter((r) => {
    const d = describeStockRow(r);
    return d.level === 'LOW' || d.level === 'OUT' || d.level === 'NEGATIVE';
  }).length;

  if (loading && !rows) return <Loading label="Loading vaccines" />;

  return (
    <View style={[st.screen, { paddingTop: insets.top }]}>
      <View style={st.status}>
        <T style={st.date}>{formatDayLabel()}</T>
        <Pressable accessibilityRole="button" onPress={() => router.push('/reports/today')}>
          <T style={st.count}>
            {dosesToday} {dosesToday === 1 ? 'dose' : 'doses'} today
          </T>
        </Pressable>
        {lowCount > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/stock')}>
            <Badge text={`${lowCount} LOW`} tone="low" />
          </Pressable>
        ) : null}
      </View>

      <View style={st.bannerWrap}>
        <BackupBanner />
      </View>

      <View style={st.searchWrap}>
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
        contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.md }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ padding: space.xl }}>
            <T style={st.emptyText}>
              {q ? `No vaccine matches "${q}".` : 'No vaccines in the catalog yet.'}
            </T>
          </View>
        }
        renderItem={({ item }) => {
          const d = describeStockRow(item);
          const tone =
            d.level === 'OK' ? color.text : d.level === 'LOW' ? color.low : color.danger;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${d.primary}`}
              onPress={() => router.push(`/dose/${item.vaccine_id}`)}
              style={({ pressed }) => [st.tile, pressed && st.tilePressed]}
            >
              <T style={st.tileName} numberOfLines={2}>
                {item.name}
              </T>
              <View style={{ flex: 1 }} />
              <T style={[st.tileStock, { color: tone }]}>{d.primary}</T>
              {d.secondary ? <T style={st.tileSecondary}>{d.secondary}</T> : null}
              {d.badge ? (
                <View style={st.tileBadge}>
                  <Badge text={d.badge} tone={d.level === 'LOW' ? 'low' : 'danger'} />
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 72,
  },
  date: { fontSize: type.label, color: color.textMuted, fontWeight: weight.semibold },
  count: { fontSize: type.title, fontWeight: weight.bold, color: color.text },
  bannerWrap: { paddingHorizontal: space.md },
  searchWrap: { paddingHorizontal: space.md, paddingBottom: space.sm },
  emptyText: { fontSize: type.body, color: color.textMuted, textAlign: 'center' },

  tile: {
    flex: 1,
    minHeight: 132,
    borderWidth: 2,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: space.md,
    backgroundColor: color.bg,
  },
  tilePressed: { backgroundColor: '#EFF6FF', borderColor: color.primary },
  tileName: { fontSize: type.title, fontWeight: weight.semibold, color: color.text },
  tileStock: { fontSize: type.body, fontWeight: weight.bold, marginTop: space.sm },
  tileSecondary: { fontSize: type.min, color: color.textMuted, marginTop: 2 },
  tileBadge: { position: 'absolute', top: space.sm, right: space.sm },
});
