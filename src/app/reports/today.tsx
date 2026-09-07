import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Badge, BigButton, Empty, Input, Loading, Row, SecondaryButton, T } from '../../ui/components';
import { color, radius, space, type, weight } from '../../ui/tokens';
import { useDb, useQuery } from '../../db/provider';
import { asOfLabel, dosesGiven, dosesGivenTotals, movementStrip } from '../../domain/reports';
import { fillMissingChild } from '../../domain/ledger';
import { formatDayLabel, formatTime12h, todayLocal } from '../../domain/time';

/** "Vaccines given today, time, count" - the notebook page, arithmetic included. */
export default function TodayScreen() {
  const { db, bump } = useDb();
  const today = todayLocal();
  const [editing, setEditing] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  const { data: lines, loading } = useQuery((d) => dosesGiven(d, today), [today]);
  const { data: totals } = useQuery((d) => dosesGivenTotals(d, today), [today]);
  const { data: strip } = useQuery((d) => movementStrip(d, today), [today]);

  if (loading && !lines) return <Loading />;

  const total = (totals ?? []).reduce((n, t) => n + t.doses, 0);

  return (
    <ScrollView style={st.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
      <T style={st.day}>{formatDayLabel()}</T>
      <T style={st.total}>
        {total} {total === 1 ? 'dose' : 'doses'} given
      </T>
      <T style={st.asOf}>{asOfLabel()}</T>

      {strip ? (
        <View style={st.strip}>
          <T style={st.stripText}>
            Opening {strip.opening} · +Received {strip.received} · −Given {strip.given} · −Wasted{' '}
            {strip.wasted} · = {strip.now} now
          </T>
        </View>
      ) : null}

      {totals?.length ? (
        <>
          <T style={st.section}>By vaccine</T>
          {totals.map((t) => (
            <Row key={t.vaccine_id} title={t.name} right={<T style={st.count}>{t.doses}</T>} />
          ))}
        </>
      ) : null}

      <T style={st.section}>Every dose</T>
      {lines?.length ? (
        lines.map((l) => (
          <View key={l.id} style={st.line}>
            <T style={st.time}>{formatTime12h(l.local_time)}</T>
            <View style={{ flex: 1 }}>
              <T style={st.vaccine}>
                {l.vaccine_name}
                {l.doses > 1 ? ` × ${l.doses}` : ''}
              </T>
              <T style={st.meta}>
                {l.patient_label ?? 'no name recorded'}
                {l.lot_number ? ` · batch ${l.lot_number}` : ''}
                {l.staff_name ? ` · ${l.staff_name}` : ''}
              </T>
              {editing === l.id ? (
                <View style={{ gap: space.sm, marginTop: space.sm }}>
                  <Input
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    placeholder="Child's name"
                    autoCapitalize="words"
                    autoCorrect={false}
                    autoFocus
                  />
                  <BigButton
                    label="Save name"
                    onPress={async () => {
                      await fillMissingChild(db, { movementId: l.id, patientLabel: nameDraft.trim() });
                      bump();
                      setEditing(null);
                      setNameDraft('');
                    }}
                    disabled={!nameDraft.trim()}
                  />
                </View>
              ) : l.needs_detail ? (
                <SecondaryButton
                  label="Add the child's name"
                  onPress={() => {
                    setEditing(l.id);
                    setNameDraft('');
                  }}
                />
              ) : null}
            </View>
            {l.needs_detail ? <Badge text="NO NAME" tone="neutral" /> : null}
          </View>
        ))
      ) : (
        <Empty title="No doses recorded yet today" hint="Tap a vaccine on the Give dose tab." />
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  day: { fontSize: type.label, color: color.textMuted, fontWeight: weight.semibold },
  total: { fontSize: type.hero, fontWeight: weight.bold, color: color.text },
  asOf: { fontSize: type.min, color: color.textMuted },
  strip: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  stripText: { fontSize: type.min, color: color.textMuted, lineHeight: 20 },
  section: { fontSize: type.label, fontWeight: weight.bold, color: color.textMuted, marginTop: space.xl, marginBottom: space.sm },
  count: { fontSize: type.title, fontWeight: weight.bold, color: color.text },
  line: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  time: { fontSize: type.label, color: color.textMuted, width: 76, fontWeight: weight.semibold },
  vaccine: { fontSize: type.body, fontWeight: weight.semibold, color: color.text },
  meta: { fontSize: type.min, color: color.textMuted, marginTop: 2 },
});
