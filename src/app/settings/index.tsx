import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BigButton, Field, Input, Loading, Row, T } from '../../ui/components';
import { color, space, type, weight } from '../../ui/tokens';
import { useDb, useQuery } from '../../db/provider';
import { useToast } from '../../ui/snackbar';
import { SETTING, getSetting, setSetting } from '../../db/repo/settings';
import { createStaff, listStaff } from '../../db/repo/staff';
import { LATEST_VERSION } from '../../db/migrate';

export default function SettingsScreen() {
  const { db, deviceId, appVersion, bump } = useDb();
  const toast = useToast();
  const [clinic, setClinic] = useState('');
  const [newStaff, setNewStaff] = useState('');

  const { data: saved } = useQuery((d) => getSetting(d, SETTING.clinicName));
  const { data: staff } = useQuery((d) => listStaff(d, false));

  useEffect(() => {
    if (saved !== null && saved !== undefined) setClinic(saved);
  }, [saved]);

  if (!staff) return <Loading />;

  return (
    <ScrollView style={st.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
      <Field label="Clinic name" hint="Shown on exported reports.">
        <Input value={clinic} onChangeText={setClinic} autoCapitalize="words" />
      </Field>
      <BigButton
        label="Save clinic name"
        tone="neutral"
        onPress={async () => {
          await setSetting(db, SETTING.clinicName, clinic.trim());
          bump();
          toast.show('Saved.');
        }}
      />

      <T style={st.section}>Who enters data</T>
      {staff.map((s) => (
        <Row key={s.id} title={s.name} />
      ))}
      <Field label="Add a person">
        <Input
          value={newStaff}
          onChangeText={setNewStaff}
          placeholder="Name"
          autoCapitalize="words"
          autoCorrect={false}
        />
      </Field>
      <BigButton
        label="Add"
        tone="neutral"
        disabled={!newStaff.trim()}
        onPress={async () => {
          await createStaff(db, newStaff.trim(), deviceId);
          setNewStaff('');
          bump();
          toast.show('Added.');
        }}
      />

      <T style={st.section}>About</T>
      <Row title="App version" subtitle={appVersion} />
      <Row title="Data format" subtitle={`v${LATEST_VERSION}`} />
      <Row title="This device" subtitle={deviceId.slice(0, 8)} />
      <View style={{ height: space.lg }} />
      <T style={st.note}>
        This app works fully offline. All clinic records stay on this phone. It connects to the
        internet only to check for app updates.
      </T>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  section: { fontSize: type.label, fontWeight: weight.bold, color: color.textMuted, marginTop: space.xl, marginBottom: space.sm },
  note: { fontSize: type.min, color: color.textMuted, lineHeight: 20 },
});
