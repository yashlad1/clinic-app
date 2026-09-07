import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Row, T } from '../../ui/components';
import { color, space, type, weight } from '../../ui/tokens';
import { useQuery } from '../../db/provider';
import { SETTING, getSetting } from '../../db/repo/settings';
import { lastBackupLabel } from '../../domain/backup-nag';
import { missingChildEntries } from '../../domain/reports';

/** Everything infrequent, as a flat list of large labelled rows. */
export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: lastBackupAt } = useQuery(async (db) => Number(await getSetting(db, SETTING.lastBackupAt)) || null);
  const { data: missing } = useQuery((db) => missingChildEntries(db, 100));

  return (
    <ScrollView style={[st.screen, { paddingTop: insets.top }]} contentContainerStyle={{ padding: space.lg }}>
      <T style={st.title}>More</T>

      <Row
        title="Back up / restore"
        subtitle={lastBackupLabel(lastBackupAt ?? null)}
        onPress={() => router.push('/backup')}
      />
      <Row title="Given today" subtitle="Times, children and totals" onPress={() => router.push('/reports/today')} />
      <Row
        title="Missing child names"
        subtitle="Fill in doses you logged without a name"
        right={missing?.length ? <Badge text={String(missing.length)} tone="low" /> : undefined}
        onPress={() => router.push('/reports/today')}
      />
      <Row title="All entries" subtitle="Full history, with corrections" onPress={() => router.push('/ledger')} />
      <Row title="Vaccines" subtitle="Trade names, doses per vial, safety limits" onPress={() => router.push('/catalog')} />
      <Row title="Children" subtitle="Saved names and histories" onPress={() => router.push('/children')} />
      <Row title="Settings" subtitle="Clinic name, staff, about" onPress={() => router.push('/settings')} />

      <View style={{ height: space.xl }} />
      <T style={st.note}>
        This app keeps everything on this phone. Back it up regularly and keep a screen lock on the
        phone.
      </T>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  title: { fontSize: type.hero, fontWeight: weight.bold, color: color.text, marginBottom: space.md },
  note: { fontSize: type.min, color: color.textMuted, lineHeight: 20 },
});
