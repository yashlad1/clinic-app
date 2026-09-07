import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BigButton, Chip, Empty, Field, Input, Loading, SecondaryButton, Stepper, T,
} from '../../ui/components';
import { color, radius, space, touch, type, weight } from '../../ui/tokens';
import { useDb, useQuery } from '../../db/provider';
import { useToast } from '../../ui/snackbar';
import { newId } from '../../domain/ids';
import { recordAdministration, reverseMovement, findRecentSimilar } from '../../domain/ledger';
import { lotsInStock, lastUsedLot, isExpired } from '../../db/repo/lots';
import { createPatient, recentPatients, searchPatients } from '../../db/repo/patients';
import { listStaff } from '../../db/repo/staff';
import { bumpDosesSinceBackup } from '../../db/repo/settings';
import { describeStock } from '../../domain/stock';
import { expiryToMonthLabel, todayLocal } from '../../domain/time';
import type { StockRow } from '../../domain/types';

/**
 * The dose modal. Target: 3 taps from launch (tile -> child chip -> GIVE), or
 * 2 if she skips the child.
 *
 * No confirmation dialog. The write happens on GIVE and the snackbar is the
 * confirmation, because a confirm on the common path trains people to tap
 * through confirms.
 */
export default function DoseScreen() {
  const { vaccineId } = useLocalSearchParams<{ vaccineId: string }>();
  const router = useRouter();
  const { db, deviceId, bump } = useDb();
  const toast = useToast();
  const today = todayLocal();

  const [doses, setDoses] = useState(1);
  const [lotId, setLotId] = useState<string | null | undefined>(undefined);
  const [childId, setChildId] = useState<string | null>(null);
  const [childLabel, setChildLabel] = useState<string | null>(null);
  const [childQuery, setChildQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: vaccine } = useQuery(
    (d) => d.first<StockRow>(`SELECT * FROM v_stock_on_hand WHERE vaccine_id = ?`, [vaccineId]),
    [vaccineId],
  );
  const { data: lots } = useQuery((d) => lotsInStock(d, vaccineId), [vaccineId]);
  const { data: preferredLot } = useQuery((d) => lastUsedLot(d, vaccineId), [vaccineId]);
  const { data: recent } = useQuery((d) => recentPatients(d, 12), []);
  const { data: matches } = useQuery(
    (d) => (childQuery.trim().length >= 2 ? searchPatients(d, childQuery.trim(), 8) : Promise.resolve([])),
    [childQuery],
  );
  const { data: staff } = useQuery((d) => listStaff(d), []);

  // Preselect the most-recently-used lot, so lot choice is usually zero taps.
  const effectiveLot = lotId !== undefined ? lotId : (preferredLot?.lot_id ?? lots?.[0]?.lot_id ?? null);
  const selected = useMemo(() => lots?.find((l) => l.lot_id === effectiveLot) ?? null, [lots, effectiveLot]);
  const expired = selected ? isExpired(selected, today) : false;

  if (!vaccine) return <Loading label="Loading vaccine" />;

  const stock = describeStock(
    vaccine.on_hand_doses,
    vaccine.unit_mode,
    vaccine.doses_per_vial,
    vaccine.min_balance_doses,
  );
  const wouldGoNegative = vaccine.on_hand_doses - doses < 0;

  const give = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Minted here, at the tap, and reused for any retry of THIS intent.
      const clientActionId = newId();

      const similar = await findRecentSimilar(db, {
        vaccineId, movementType: 'ADMINISTRATION', deltaDoses: -doses,
      });

      const { movement } = await recordAdministration(db, { deviceId, staffId: staff?.[0]?.id ?? null }, {
        clientActionId,
        vaccineId,
        lotId: effectiveLot,
        doses,
        patientId: childId,
        patientLabel: childLabel ?? (childQuery.trim() || null),
      });
      await bumpDosesSinceBackup(db, doses);
      bump();

      const who = childLabel ? ` to ${childLabel}` : '';
      const note = similar ? ' (a similar dose was recorded moments ago)' : '';
      toast.show(`${doses} × ${vaccine.name} recorded${who}.${note}`, async () => {
        // Undo writes a REVERSING ENTRY. It never deletes, so the correction is
        // auditable and stays available from the Ledger screen forever.
        await reverseMovement(db, { deviceId }, { clientActionId: newId(), movementId: movement.id });
        await bumpDosesSinceBackup(db, -doses);
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
        {/* The vaccine name IS the confirmation, and it costs no tap. */}
        <T style={st.name}>{vaccine.name}</T>
        <T style={st.stock}>
          {stock.primary}
          {stock.secondary ? ` · ${stock.secondary}` : ''} in stock
        </T>

        <Field
          label="Batch / lot"
          hint={lots?.length ? undefined : 'No batch recorded yet — you can still log the dose.'}
        >
          {lots?.length ? (
            <View style={st.chipRow}>
              {lots.map((l) => (
                <Chip
                  key={l.lot_id}
                  label={l.lot_number}
                  sublabel={`${l.on_hand_doses} left${l.expiry_date ? ` · exp ${expiryToMonthLabel(l.expiry_date)}` : ''}`}
                  selected={effectiveLot === l.lot_id}
                  onPress={() => setLotId(l.lot_id)}
                />
              ))}
              <Chip label="Not sure" selected={effectiveLot === null} onPress={() => setLotId(null)} />
            </View>
          ) : null}
          {expired ? (
            <T style={st.warn}>
              This batch expired {expiryToMonthLabel(selected!.expiry_date!)}. Pick another batch.
            </T>
          ) : null}
        </Field>

        <Field label="Child" hint="Optional — you can add the name later.">
          {childLabel ? (
            <View style={st.chipRow}>
              <Chip label={childLabel} selected onPress={() => undefined} />
              <SecondaryButton
                label="Change"
                onPress={() => {
                  setChildId(null);
                  setChildLabel(null);
                  setChildQuery('');
                }}
              />
            </View>
          ) : (
            <>
              <Input
                placeholder="Type 2 letters, or a phone number"
                value={childQuery}
                onChangeText={setChildQuery}
                autoCorrect={false}
                autoCapitalize="words"
                accessibilityLabel="Search or add child"
              />
              {matches?.length ? (
                <View style={st.chipRow}>
                  {matches.map((p) => (
                    <Chip
                      key={p.id}
                      label={p.name}
                      onPress={() => {
                        setChildId(p.id);
                        setChildLabel(p.name);
                      }}
                    />
                  ))}
                </View>
              ) : null}
              {childQuery.trim().length >= 2 && !matches?.some((m) => m.name.toLowerCase() === childQuery.trim().toLowerCase()) ? (
                <Pressable
                  accessibilityRole="button"
                  style={st.addRow}
                  onPress={async () => {
                    const name = childQuery.trim();
                    const id = await createPatient(db, { name }, deviceId);
                    setChildId(id);
                    setChildLabel(name);
                    bump();
                  }}
                >
                  <T style={st.addText}>+ Add "{childQuery.trim()}" as a new child</T>
                </Pressable>
              ) : null}
              {!childQuery && recent?.length ? (
                <View style={st.chipRow}>
                  {recent.map((p) => (
                    <Chip
                      key={p.id}
                      label={p.name}
                      onPress={() => {
                        setChildId(p.id);
                        setChildLabel(p.name);
                      }}
                    />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </Field>

        <Field label="Doses">
          <Stepper value={doses} onChange={setDoses} min={1} max={20} />
        </Field>

        {wouldGoNegative ? (
          <T style={st.warn}>
            This will take stock below zero ({vaccine.on_hand_doses - doses} doses). That usually
            means a delivery was never logged — the dose will still be recorded.
          </T>
        ) : null}
      </ScrollView>

      <View style={st.footer}>
        {!childLabel ? (
          <Pressable
            accessibilityRole="button"
            onPress={give}
            disabled={saving || expired}
            style={st.skip}
          >
            <T style={st.skipText}>Skip — no name</T>
          </Pressable>
        ) : null}
        <BigButton
          label={`GIVE ${doses} ${doses === 1 ? 'DOSE' : 'DOSES'}`}
          onPress={give}
          disabled={saving || expired}
        />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  name: { fontSize: type.hero, fontWeight: weight.bold, color: color.text },
  stock: { fontSize: type.label, color: color.textMuted, marginTop: space.xs, marginBottom: space.xl },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  warn: { fontSize: type.label, fontWeight: weight.semibold, color: color.low, marginTop: space.sm },
  addRow: { minHeight: touch.min, justifyContent: 'center', marginTop: space.sm },
  addText: { fontSize: type.body, fontWeight: weight.semibold, color: color.primary },
  footer: {
    padding: space.lg,
    gap: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.bg,
  },
  skip: { minHeight: touch.min, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  skipText: { fontSize: type.body, fontWeight: weight.semibold, color: color.primary },
});
