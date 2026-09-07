import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BigButton, Chip, ErrorState, Field, Footer, Input, Loading, SecondaryButton, Stepper, T } from '../../ui/components';
import { color, space, type, weight } from '../../ui/tokens';
import { useDb, useQuery } from '../../db/provider';
import { useToast } from '../../ui/snackbar';
import { useAction } from '../../ui/use-action';
import type { UnitMode, Vaccine } from '../../domain/types';

/**
 * Editing the catalog. `doses_per_vial` is the field that matters most: it is
 * the multiplier behind every vial-mode stock number, so a wrong value here
 * corrupts the arithmetic everywhere.
 */
export default function EditVaccineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const run = useAction();
  const { db, bump } = useDb();
  const toast = useToast();

  const { data: vaccine, error, reload } = useQuery(
    (d) => d.first<Vaccine>(`SELECT * FROM vaccines WHERE id = ?`, [id]),
    [id],
  );

  const [name, setName] = useState('');
  const [unitMode, setUnitMode] = useState<UnitMode>('DOSE');
  const [dosesPerVial, setDosesPerVial] = useState(1);
  const [minBalance, setMinBalance] = useState(0);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!vaccine) return;
    setName(vaccine.name);
    setUnitMode(vaccine.unit_mode);
    setDosesPerVial(vaccine.doses_per_vial);
    setMinBalance(vaccine.min_balance_doses);
    setActive(vaccine.is_active === 1);
  }, [vaccine]);

  if (error) return <ErrorState error={error} onRetry={reload} what="load this vaccine" />;
  if (!vaccine) return <Loading />;

  const save = () => void run('save this vaccine', async () => {
    // A single-dose presentation cannot claim more than one dose per vial; the
    // database enforces this too, so keep the UI consistent with it.
    const dpv = unitMode === 'DOSE' ? 1 : Math.max(1, dosesPerVial);
    await db.run(
      `UPDATE vaccines
          SET name = ?, unit_mode = ?, doses_per_vial = ?, min_balance_doses = ?,
              is_active = ?, updated_at = ?
        WHERE id = ?`,
      [name.trim(), unitMode, dpv, minBalance, active ? 1 : 0, Date.now(), id],
    );
    bump();
    toast.show(`Saved ${name.trim()}.`);
    router.back();
  });

  return (
    <View style={st.screen}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <Field label="Trade name" hint="Exactly as printed on the vial.">
          <Input value={name} onChangeText={setName} autoCapitalize="words" autoCorrect={false} />
        </Field>

        <Field label="How is it counted?">
          <View style={st.chipRow}>
            <Chip accent="catalog" label="Single doses" selected={unitMode === 'DOSE'} onPress={() => setUnitMode('DOSE')} />
            <Chip accent="catalog" label="Multi-dose vials" selected={unitMode === 'VIAL'} onPress={() => setUnitMode('VIAL')} />
          </View>
        </Field>

        {unitMode === 'VIAL' ? (
          <Field label="Doses per vial" hint="Check the box. This multiplies every count.">
            <Stepper accent="catalog" value={dosesPerVial} onChange={setDosesPerVial} min={1} max={50} quickValues={[1, 5, 10, 20]} />
          </Field>
        ) : null}

        <Field label="Safety limit (doses)" hint="Warn me when stock falls to this level or below.">
          <Stepper accent="catalog" value={minBalance} onChange={setMinBalance} min={0} max={200} quickValues={[0, 5, 10, 20]} />
        </Field>

        <Field label="Show in the list?" hint="Hiding keeps all history; it never deletes anything.">
          <View style={st.chipRow}>
            <Chip accent="catalog" label="Shown" selected={active} onPress={() => setActive(true)} />
            <Chip accent="catalog" label="Hidden" selected={!active} onPress={() => setActive(false)} />
          </View>
        </Field>
      </ScrollView>
      <Footer>
        <BigButton accent="catalog" label="SAVE" onPress={save} disabled={!name.trim()} />
      </Footer>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
