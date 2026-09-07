import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Input, Loading, Row, T } from '../../ui/components';
import { color, space, type, weight } from '../../ui/tokens';
import { useQuery } from '../../db/provider';
import { listVaccines } from '../../db/repo/catalog';

/**
 * Catalog admin. Deliberately NOT reachable from any entry screen: if a
 * data-entry screen could create a catalog row, we would have re-invented free
 * text with extra steps.
 */
export default function CatalogScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const { data, loading } = useQuery((db) => listVaccines(db, false), []);

  if (loading && !data) return <Loading />;

  const rows = (data ?? []).filter((v) =>
    !q.trim() ? true : v.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <View style={st.screen}>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <T style={st.warn}>
          Check doses-per-vial against your fridge before you start. Pack sizes vary by
          manufacturer, and a wrong number here makes every stock count wrong.
        </T>
        <Input placeholder="Search vaccine" value={q} onChangeText={setQ} autoCorrect={false} autoCapitalize="none" />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Row
            title={item.name}
            subtitle={
              (item.unit_mode === 'VIAL'
                ? `Vials of ${item.doses_per_vial}`
                : 'Single doses') + ` · keep ${item.min_balance_doses} doses`
            }
            right={item.is_active ? undefined : <Badge text="HIDDEN" tone="neutral" />}
            onPress={() => router.push(`/catalog/${item.id}`)}
          />
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  warn: { fontSize: type.label, color: color.low, fontWeight: weight.semibold, lineHeight: 22 },
});
