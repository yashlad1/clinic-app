import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, BigButton, Card, Chip, ErrorState, Footer, Input, Loading, T, useBottomInset } from '../../ui/components';
import { color, space, type, weight } from '../../ui/tokens';
import { centred } from '../../ui/layout';
import { useQuery } from '../../db/provider';
import { asOfLabel, movementStrip, stockOnHand } from '../../domain/reports';
import { describeStockRow } from '../../domain/stock';
import { todayLocal } from '../../domain/time';

/**
 * ADD STOCK - deliveries in, plus the current position.
 *
 * Teal throughout, and the action reads "ADD STOCK", never "give". This screen
 * moves the ledger in the opposite direction to Give dose, and it sits right
 * next to it in the tab bar, so the visual separation is doing real work.
 */
export default function AddStockScreen() {
  const router = useRouter();
  const bottomInset = useBottomInset();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'low'>('all');
  const today = todayLocal();

  const { data: rows, loading, error, reload } = useQuery((db) => stockOnHand(db, { activeOnly: true }), []);
  const { data: strip } = useQuery((db) => movementStrip(db, today), [today]);

  const decorated = useMemo(
    () => (rows ?? []).map((r) => ({ row: r, d: describeStockRow(r) })),
    [rows],
  );
  // LOW, OUT and CHECK together - everything that wants a decision. Named for
  // what it contains: calling this "low" labelled a shelf with nothing on it as
  // merely running down.
  const lows = decorated.filter((x) => x.d.level !== 'OK');

  const shown = useMemo(() => {
    let list = filter === 'low' ? lows : [...lows, ...decorated.filter((x) => x.d.level === 'OK')];
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      list = list.filter((x) => x.row.name.toLowerCase().includes(n));
    }
    return list;
  }, [decorated, lows, filter, q]);

  if (error) return <ErrorState error={error} onRetry={reload} what="load your stock" />;
  if (loading && !rows) return <Loading label="Loading stock" />;

  const totalDoses = decorated.reduce((n, x) => n + x.row.on_hand_doses, 0);

  return (
    <View style={st.screen}>
      <FlatList
        data={shown}
        keyExtractor={(x) => x.row.vaccine_id}
        contentContainerStyle={[centred, { paddingBottom: 140 + bottomInset }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={st.headerWrap}>
            <T style={st.eyebrow}>{asOfLabel()}</T>
            <T style={st.total}>{totalDoses} doses in stock</T>

            {strip ? (
              <Card tone="soft" style={{ marginTop: space.md }}>
                <T style={st.stripLabel}>Today</T>
                {/* What the paper notebook was trying to be, with the
                    arithmetic done and self-checking.

                    It used to be one wrapped sentence of 14pt grey - the
                    smallest, faintest type on the screen - for the figures
                    CLAUDE.md section 9 calls the point of the report. Numbers
                    that matter are 22-28pt bold by rule, and an equation is
                    read term by term, so each term now gets its own labelled
                    column and the row wraps instead of reflowing mid-sum. */}
                <View style={st.stripRow}>
                  <StripTerm label="Opening" value={strip.opening} />
                  <StripTerm label="+ Received" value={strip.received} />
                  <StripTerm label="− Given" value={strip.given} />
                  <StripTerm label="− Wasted" value={strip.wasted} />
                  {strip.adjusted !== 0 ? (
                    <StripTerm label="Adjusted" value={strip.adjusted} signed />
                  ) : null}
                  {strip.corrections !== 0 ? (
                    <StripTerm label="Corrections" value={strip.corrections} signed />
                  ) : null}
                  <StripTerm label="= Now" value={strip.now} total />
                </View>
              </Card>
            ) : null}

            <View style={{ marginTop: space.lg, gap: space.md }}>
              <Input
                placeholder="Search vaccine"
                value={q}
                onChangeText={setQ}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <View style={st.chipRow}>
                <Chip
                  accent="stock"
                  label="All"
                  selected={filter === 'all'}
                  onPress={() => setFilter('all')}
                />
                <Chip
                  accent="stock"
                  label={`Low or out (${lows.length})`}
                  selected={filter === 'low'}
                  onPress={() => setFilter('low')}
                />
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add stock of ${item.row.name}. Currently ${item.d.primary}`}
            onPress={() => router.push(`/receive/${item.row.vaccine_id}`)}
            style={({ pressed }) => [st.row, pressed && { backgroundColor: color.stockSoft }]}
          >
            <View style={{ flex: 1 }}>
              <T style={st.rowName}>{item.row.name}</T>
              <T style={st.rowSub}>
                {item.d.primary}
                {item.row.min_balance_doses > 0 ? ` · keep ${item.row.min_balance_doses}` : ''}
              </T>
            </View>
            {item.d.badge ? (
              <Badge text={item.d.badge} tone={item.d.level === 'LOW' ? 'low' : 'danger'} />
            ) : null}
            <T style={st.plus}>+</T>
          </Pressable>
        )}
      />

      <Footer floating>
        <BigButton
          accent="stock"
          label="ADD STOCK"
          sublabel="Log a delivery that has arrived"
          onPress={() => router.push('/receive')}
        />
      </Footer>
    </View>
  );
}

/** One term of the movement equation: a label, then the figure under it. */
function StripTerm({
  label,
  value,
  signed,
  total,
}: {
  label: string;
  value: number;
  signed?: boolean;
  total?: boolean;
}) {
  return (
    <View>
      <T style={st.stripTermLabel}>{label}</T>
      <T style={[st.stripTermValue, total ? st.stripTermTotal : null]}>
        {signed && value > 0 ? '+' : ''}
        {value}
      </T>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  headerWrap: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md },
  eyebrow: { fontSize: type.min, color: color.textMuted, fontWeight: weight.semibold },
  total: { fontSize: type.hero, fontWeight: weight.bold, color: color.text, marginTop: 2 },
  stripLabel: {
    fontSize: type.min,
    fontWeight: weight.bold,
    color: color.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: space.xs,
  },
  // columnGap carries the separation the `·` used to, so no glyph has to.
  stripRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space.md,
    columnGap: space.xl,
    marginTop: space.sm,
  },
  stripTermLabel: { fontSize: type.min, color: color.textMuted, fontWeight: weight.semibold },
  stripTermValue: { fontSize: type.title, fontWeight: weight.bold, color: color.text },
  stripTermTotal: { fontSize: type.big, color: color.stock },
  chipRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },

  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  rowName: { fontSize: type.body, fontWeight: weight.semibold, color: color.text },
  rowSub: { fontSize: type.label, color: color.textMuted, marginTop: 2 },
  plus: { fontSize: type.big, fontWeight: weight.bold, color: color.stock, marginTop: -3 },

});
