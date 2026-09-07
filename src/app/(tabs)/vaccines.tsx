import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, BigButton, Card, Chip, Input, Loading, T } from '../../ui/components';
import { color, elevation, radius, space, type, weight } from '../../ui/tokens';
import { useDb, useQuery } from '../../db/provider';
import { useToast } from '../../ui/snackbar';
import {
  activateVaccine, deactivateVaccine, listRemovedVaccines, listVaccines, removeVaccine,
  restoreVaccine, vaccineUsage,
} from '../../db/repo/catalog';

/**
 * VACCINES - add a new one, remove an old one, fix doses-per-vial.
 *
 * Two different actions, deliberately not the same thing:
 *
 *   Hide   - takes it out of the pickers, keeps it one tap from coming back.
 *            The right choice for "we don't stock this at the moment".
 *   Remove - takes it out of the catalog entirely.
 *
 * Even Remove is a soft delete. Every past dose references this row, so a hard
 * DELETE would orphan the ledger and break the history screen and the export.
 * The clinician sees a removal; the record keeps everything that was ever given.
 */
export default function VaccinesScreen() {
  const router = useRouter();
  const { db, bump } = useDb();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [showRemoved, setShowRemoved] = useState(false);

  const { data: active, loading } = useQuery((d) => listVaccines(d, false), []);
  const { data: removed } = useQuery((d) => listRemovedVaccines(d), []);

  const rows = useMemo(() => {
    const list = showRemoved ? (removed ?? []) : (active ?? []);
    if (!q.trim()) return list;
    const n = q.trim().toLowerCase();
    return list.filter(
      (v) => v.name.toLowerCase().includes(n) || (v.generic_name ?? '').toLowerCase().includes(n),
    );
  }, [active, removed, showRemoved, q]);

  if (loading && !active) return <Loading label="Loading vaccines" />;

  const confirmRemove = async (id: string, name: string) => {
    // Tell her the consequence in real numbers rather than "are you sure?".
    const usage = await vaccineUsage(db, id);
    const lines = [`"${name}" will be removed from every list and picker.`];
    if (usage.onHandDoses !== 0) {
      lines.push(
        `\nWARNING: ${usage.onHandDoses} doses are currently in stock. That stock will no longer be counted anywhere.`,
      );
    }
    if (usage.movements > 0) {
      lines.push(
        `\n${usage.dosesGiven} doses given and ${usage.movements} entries stay in your records — nothing is erased. You can add it back at any time.`,
      );
    } else {
      lines.push('\nIt has never been used, so nothing is lost.');
    }

    Alert.alert(`Remove ${name}?`, lines.join(''), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeVaccine(db, id);
          bump();
          toast.show(`${name} removed.`, async () => {
            await restoreVaccine(db, id);
            bump();
          });
        },
      },
    ]);
  };

  return (
    <View style={st.screen}>
      <FlatList
        data={rows}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={st.headerWrap}>
            <T style={st.total}>
              {(active ?? []).length} {(active ?? []).length === 1 ? 'vaccine' : 'vaccines'}
            </T>

            <Card tone="catalog" style={{ marginTop: space.md }}>
              <T style={st.noteTitle}>Check doses per vial</T>
              <T style={st.noteBody}>
                Pack sizes vary by manufacturer. A wrong number here multiplies into every stock
                count for that vaccine, so check it against your fridge before you rely on it.
              </T>
            </Card>

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
                  accent="catalog"
                  label="In catalog"
                  selected={!showRemoved}
                  onPress={() => setShowRemoved(false)}
                />
                <Chip
                  accent="catalog"
                  label={`Removed (${(removed ?? []).length})`}
                  selected={showRemoved}
                  onPress={() => setShowRemoved(true)}
                />
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ padding: space.xl }}>
            <T style={st.emptyText}>
              {showRemoved
                ? 'Nothing has been removed.'
                : q
                  ? `No vaccine matches "${q}".`
                  : 'No vaccines yet. Add your first one below.'}
            </T>
          </View>
        }
        renderItem={({ item }) => (
          <View style={st.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name}`}
              onPress={() => router.push(`/catalog/${item.id}`)}
              style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.6 }]}
            >
              <T style={st.rowName}>{item.name}</T>
              <T style={st.rowSub}>
                {item.unit_mode === 'VIAL'
                  ? `Vials of ${item.doses_per_vial}`
                  : 'Single doses'}
                {` · keep ${item.min_balance_doses} doses`}
              </T>
            </Pressable>

            {showRemoved ? (
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  await restoreVaccine(db, item.id);
                  bump();
                  toast.show(`${item.name} added back.`);
                }}
                style={st.action}
              >
                <T style={[st.actionText, { color: color.catalog }]}>Add back</T>
              </Pressable>
            ) : (
              <>
                {!item.is_active ? <Badge text="HIDDEN" tone="neutral" /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.is_active ? `Hide ${item.name}` : `Show ${item.name}`}
                  onPress={async () => {
                    if (item.is_active) await deactivateVaccine(db, item.id);
                    else await activateVaccine(db, item.id);
                    bump();
                  }}
                  style={st.action}
                >
                  <T style={[st.actionText, { color: color.textMuted }]}>
                    {item.is_active ? 'Hide' : 'Show'}
                  </T>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name}`}
                  onPress={() => confirmRemove(item.id, item.name)}
                  style={st.action}
                >
                  <T style={[st.actionText, { color: color.danger }]}>Remove</T>
                </Pressable>
              </>
            )}
          </View>
        )}
      />

      <View style={[st.footer, elevation(3)]}>
        <BigButton
          accent="catalog"
          label="ADD A NEW VACCINE"
          sublabel="Trade name, how it is counted, safety limit"
          onPress={() => router.push('/catalog/new')}
        />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  headerWrap: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md },
  total: { fontSize: type.hero, fontWeight: weight.bold, color: color.text },
  noteTitle: { fontSize: type.label, fontWeight: weight.bold, color: color.catalog },
  noteBody: { fontSize: type.min, color: color.text, lineHeight: 21, marginTop: space.xs },
  chipRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  emptyText: { fontSize: type.body, color: color.textMuted, textAlign: 'center', lineHeight: 26 },

  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  rowName: { fontSize: type.body, fontWeight: weight.semibold, color: color.text },
  rowSub: { fontSize: type.label, color: color.textMuted, marginTop: 2 },
  action: {
    minHeight: 56,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  actionText: { fontSize: type.label, fontWeight: weight.semibold },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.lg,
    backgroundColor: color.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
