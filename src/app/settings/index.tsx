import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BigButton, ErrorState, Field, Input, Loading, Row, T, useBottomInset } from '../../ui/components';
import { color, space, type, weight } from '../../ui/tokens';
import { centred } from '../../ui/layout';
import { useDb, useQuery } from '../../db/provider';
import { useToast } from '../../ui/snackbar';
import { useAction } from '../../ui/use-action';
import { SETTING, getSetting, setSetting } from '../../db/repo/settings';
import { createStaff, listStaff } from '../../db/repo/staff';
import { LATEST_VERSION } from '../../db/migrate';

export default function SettingsScreen() {
  const bottomInset = useBottomInset();
  const { db, deviceId, appVersion, bump } = useDb();
  const toast = useToast();
  const run = useAction();
  const [clinic, setClinic] = useState('');
  const [newStaff, setNewStaff] = useState('');

  const { data: saved } = useQuery((d) => getSetting(d, SETTING.clinicName));
  const { data: staff, error, reload } = useQuery((d) => listStaff(d, false));

  useEffect(() => {
    if (saved !== null && saved !== undefined) setClinic(saved);
  }, [saved]);

  if (error) return <ErrorState error={error} onRetry={reload} what="load settings" />;
  if (!staff) return <Loading />;

  return (
    <ScrollView style={st.screen} contentContainerStyle={[centred, { padding: space.lg, paddingBottom: space.xxl + bottomInset }]}>
      <Field label="Clinic name" hint="Shown on exported reports.">
        <Input value={clinic} onChangeText={setClinic} autoCapitalize="words" />
      </Field>
      <BigButton
        label="Save clinic name"
        variant="outline"
        onPress={() => void run('save the clinic name', async () => {
          await setSetting(db, SETTING.clinicName, clinic.trim());
          bump();
          toast.show('Saved.');
        })}
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
        variant="outline"
        disabled={!newStaff.trim()}
        onPress={() => void run('add this person', async () => {
          await createStaff(db, newStaff.trim(), deviceId);
          setNewStaff('');
          bump();
          toast.show('Added.');
        })}
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
