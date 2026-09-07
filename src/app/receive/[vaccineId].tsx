import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BigButton, Chip, Field, Input, Loading, Stepper, T } from '../../ui/components';
import { color, space, type, weight } from '../../ui/tokens';
import { useDb, useQuery } from '../../db/provider';
import { useToast } from '../../ui/snackbar';
import { newId } from '../../domain/ids';
import { recordReceipt, reverseMovement } from '../../domain/ledger';
import { findOrCreateLot } from '../../db/repo/lots';
import { listStaff } from '../../db/repo/staff';
import { describeStock, dosesFromVials } from '../../domain/stock';
import { MONTHS, expiryFromMonth } from '../../domain/time';
import type { FundingSource, StockRow } from '../../domain/types';

/**
 * Log a delivery. This is where the expensive keystrokes live - once per box,
 * at a desk - which is precisely why lot capture belongs here and not at the
 * point of care with a crying infant.
 */
export default function ReceiveScreen() {
  const { vaccineId } = useLocalSearchParams<{ vaccineId: string }>();
  const router = useRouter();
  const { db, deviceId, bump } = useDb();
  const toast = useToast();

  const [qty, setQty] = useState(1);
  const [lotNumber, setLotNumber] = useState('');
  const [expMonth, setExpMonth] = useState<number | null>(null);
  const [expYear, setExpYear] = useState<number | null>(null);
  const [funding, setFunding] = useState<FundingSource>('PRIVATE');
  const [saving, setSaving] = useState(false);

  const { data: vaccine } = useQuery(
    (d) => d.first<StockRow>(`SELECT * FROM v_stock_on_hand WHERE vaccine_id = ?`, [vaccineId]),
    [vaccineId],
  );
  const { data: staff } = useQuery((d) => listStaff(d), []);

  if (!vaccine) return <Loading />;

  const byVial = vaccine.unit_mode === 'VIAL' && vaccine.doses_per_vial > 1;
  // The app multiplies. She never does.
  const doses = byVial ? dosesFromVials(vaccine.doses_per_vial, qty) : qty;
  const after = describeStock(
    vaccine.on_hand_doses + doses,
    vaccine.unit_mode,
    vaccine.doses_per_vial,
    vaccine.min_balance_doses,
  );

  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear + 1, thisYear + 2, thisYear + 3];

  const save = async () => {
    if (saving || !lotNumber.trim()) return;
    setSaving(true);
    try {
      const lotId = await findOrCreateLot(
        db,
        {
          vaccineId,
          lotNumber: lotNumber.trim().toUpperCase(),
          // Stored as the LAST day of the printed month; see domain/time.ts.
          expiryDate: expMonth && expYear ? expiryFromMonth(expYear, expMonth) : null,
          fundingSource: funding,
        },
        deviceId,
      );
      const { movement } = await recordReceipt(db, { deviceId, staffId: staff?.[0]?.id ?? null }, {
        clientActionId: newId(),
        vaccineId,
        lotId,
        doses,
      });
      bump();
      toast.show(`Added ${doses} doses of ${vaccine.name}.`, async () => {
        await reverseMovement(db, { deviceId }, { clientActionId: newId(), movementId: movement.id });
        bump();
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={st.screen}>
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <T style={st.name}>{vaccine.name}</T>
        <T style={st.sub}>
          {byVial ? `Counted in vials of ${vaccine.doses_per_vial} doses` : 'Counted in single doses'}
        </T>

        <Field label="Batch / lot number" hint="As printed on the box.">
          <Input
            value={lotNumber}
            onChangeText={setLotNumber}
            placeholder="e.g. AB1234"
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Batch or lot number"
          />
        </Field>

        <Field label="Expiry" hint="Month and year, as printed on the vial.">
          <View style={st.chipRow}>
            {MONTHS.map((m, i) => (
              <Chip key={m} label={m} selected={expMonth === i + 1} onPress={() => setExpMonth(i + 1)} />
            ))}
          </View>
          <View style={st.chipRow}>
            {years.map((y) => (
              <Chip key={y} label={String(y)} selected={expYear === y} onPress={() => setExpYear(y)} />
            ))}
          </View>
        </Field>

        <Field label="Where it came from">
          <View style={st.chipRow}>
            <Chip label="Bought" selected={funding === 'PRIVATE'} onPress={() => setFunding('PRIVATE')} />
            <Chip
              label="Government (free)"
              selected={funding === 'GOVT_UIP'}
              onPress={() => setFunding('GOVT_UIP')}
            />
          </View>
        </Field>

        <Field label={byVial ? 'How many vials?' : 'How many doses?'}>
          <Stepper value={qty} onChange={setQty} min={1} max={500} quickValues={[1, 5, 10, 20, 50]} />
          {byVial ? <T style={st.calc}>= {doses} doses</T> : null}
        </Field>

        <T style={st.after}>After adding: {after.primary}{after.secondary ? ` (${after.secondary})` : ''}</T>
      </ScrollView>

      <View style={st.footer}>
        <BigButton
          label="ADD TO STOCK"
          sublabel={lotNumber.trim() ? undefined : 'Enter the batch number first'}
          onPress={save}
          disabled={saving || !lotNumber.trim()}
        />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  name: { fontSize: type.big, fontWeight: weight.bold, color: color.text },
  sub: { fontSize: type.label, color: color.textMuted, marginTop: space.xs, marginBottom: space.xl },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  calc: { fontSize: type.body, fontWeight: weight.semibold, color: color.textMuted, marginTop: space.sm },
  after: { fontSize: type.body, fontWeight: weight.semibold, color: color.ok },
  footer: { padding: space.lg, borderTopWidth: 1, borderTopColor: color.border },
});
