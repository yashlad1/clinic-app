import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Card, Row, SectionTitle, T, useBottomInset } from '../../ui/components';
import { color, space, type, weight } from '../../ui/tokens';
import { useQuery } from '../../db/provider';
import { SETTING, getSetting } from '../../db/repo/settings';
import { lastBackupLabel } from '../../domain/backup-nag';
import { missingChildEntries } from '../../domain/reports';

/** Everything infrequent, as a flat list of large labelled rows. */
export default function MoreScreen() {
  const bottomInset = useBottomInset();
  const router = useRouter();

  const { data: lastBackupAt } = useQuery(
    async (db) => Number(await getSetting(db, SETTING.lastBackupAt)) || null,
  );
  const { data: missing } = useQuery((db) => missingChildEntries(db, 100));

  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl + bottomInset }}
      showsVerticalScrollIndicator={false}
    >
      <Card tone="soft">
        <T style={st.backupLabel}>{lastBackupLabel(lastBackupAt ?? null)}</T>
        <Row title="Back up / restore" onPress={() => router.push('/backup')} last />
      </Card>

      <SectionTitle>Reports</SectionTitle>
      <Card>
        <Row
          title="Given today"
          subtitle="Times, children and totals"
          onPress={() => router.push('/reports/today')}
        />
        <Row
          title="Missing child names"
          subtitle="Fill in doses logged without a name"
          right={missing?.length ? <Badge text={String(missing.length)} tone="low" /> : undefined}
          onPress={() => router.push('/reports/today')}
        />
        <Row
          title="All entries"
          subtitle="Full history, with corrections"
          onPress={() => router.push('/ledger')}
          last
        />
      </Card>

      <SectionTitle>Records</SectionTitle>
      <Card>
        <Row
          title="Children"
          subtitle="Saved names and histories"
          onPress={() => router.push('/children')}
        />
        <Row
          title="Settings"
          subtitle="Clinic name, staff, about"
          onPress={() => router.push('/settings')}
          last
        />
      </Card>

      <T style={st.note}>
        Everything stays on this phone. Back it up regularly, and keep a screen lock on the phone.
      </T>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  backupLabel: {
    fontSize: type.label,
    fontWeight: weight.semibold,
    color: color.text,
    marginBottom: space.xs,
  },
  note: {
    fontSize: type.min,
    color: color.textMuted,
    lineHeight: 21,
    marginTop: space.xl,
    paddingHorizontal: space.xs,
  },
});
