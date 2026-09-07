import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Chip, Loading, T } from '../../ui/components';
import { color, radius, space, touch, type, weight } from '../../ui/tokens';
import { useQuery } from '../../db/provider';
import { movementStrip, stockOnHand } from '../../domain/reports';
import { describeStockRow } from '../../domain/stock';
import { asOfLabel } from '../../domain/reports';
import { todayLocal } from '../../domain/time';

/**
 * "Vaccines remaining today" — answered by showing BOTH readings reconciling on
 * one line, rather than picking one and being wrong half the time.
 */
export default function StockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'all' | 'low'>('all');
  const today = todayLocal();

  const { data: rows, loading } = useQuery((db) => stockOnHand(db, { activeOnly: true }), []);
  const { data: strip } = useQuery((db) => movementStrip(db, today), [today]);

  if (loading && !rows) return <Loading label="Loading stock" />;

  const decorated = (rows ?? []).map((r) => ({ row: r, d: describeStockRow(r) }));
  const lows = decorated.filter((x) => x.d.level !== 'OK');
  const shown = filter === 'low' ? lows : [...lows, ...decorated.filter((x) => x.d.level === 'OK')];

  return (
    <View style={[st.screen, { paddingTop: insets.top }]}>
      <View style={st.header}>
        <T style={st.title}>Stock</T>
        <T style={st.asOf}>{asOfLabel()}</T>
      </View>

      {strip ? (
        <View style={st.strip}>
          {/* This is literally what the paper notebook was trying to be, with
              the arithmetic done and self-checking. */}
          <T style={st.stripText}>
            Opening {strip.opening} · +Received {strip.received} · −Given {strip.given} · −Wasted{' '}
            {strip.wasted}
            {strip.adjusted !== 0 ? ` · Adjusted ${strip.adjusted > 0 ? '+' : ''}${strip.adjusted}` : ''}
            {strip.corrections !== 0 ? ` · Corrections ${strip.corrections > 0 ? '+' : ''}${strip.corrections}` : ''}
          </T>
          <T style={st.stripNow}>= {strip.now} doses now</T>
        </View>
      ) : null}

      <View style={st.filters}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={`Low stock (${lows.length})`} selected={filter === 'low'} onPress={() => setFilter('low')} />
      </View>

      <FlatList
        data={shown}
        keyExtractor={(x) => x.row.vaccine_id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120 }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.row.name}, ${item.d.primary}`}
            onPress={() => router.push(`/receive/${item.row.vaccine_id}`)}
            style={st.row}
          >
            <View style={{ flex: 1 }}>
              <T style={st.rowName}>{item.row.name}</T>
              <T style={st.rowSub}>
                {item.d.primary}
                {item.d.secondary ? ` · ${item.d.secondary}` : ''}
                {item.row.min_balance_doses > 0 ? ` · keep ${item.row.min_balance_doses}` : ''}
              </T>
            </View>
            {item.d.badge ? (
              <Badge text={item.d.badge} tone={item.d.level === 'LOW' ? 'low' : 'danger'} />
            ) : null}
          </Pressable>
        )}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Receive stock"
        onPress={() => router.push('/receive')}
        style={st.fab}
      >
        <T style={st.fabText}>+ Receive stock</T>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  header: { paddingHorizontal: space.lg, paddingTop: space.md },
  title: { fontSize: type.hero, fontWeight: weight.bold, color: color.text },
  asOf: { fontSize: type.label, color: color.textMuted },
  strip: {
    marginHorizontal: space.lg,
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  stripText: { fontSize: type.min, color: color.textMuted, lineHeight: 20 },
  stripNow: { fontSize: type.title, fontWeight: weight.bold, color: color.text, marginTop: space.xs },
  filters: { flexDirection: 'row', gap: space.sm, padding: space.lg, paddingBottom: space.sm },
  row: {
    minHeight: touch.min + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  rowName: { fontSize: type.body, fontWeight: weight.semibold, color: color.text },
  rowSub: { fontSize: type.label, color: color.textMuted, marginTop: 2 },
  fab: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.lg,
    minHeight: touch.cta,
    borderRadius: radius.md,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { color: color.onDark, fontSize: type.title, fontWeight: weight.bold },
});
