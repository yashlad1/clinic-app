import type { Db } from '../driver';
import { newId } from '../../domain/ids';

export const SETTING = {
  deviceId: 'device_id',
  clinicName: 'clinic_name',
  currentStaffId: 'current_staff_id',
  lastBackupAt: 'last_backup_at',
  dosesSinceBackup: 'doses_since_backup',
  onboardingDone: 'onboarding_done',
  catalogSeeded: 'catalog_seeded',
} as const;

export async function getSetting(db: Db, key: string): Promise<string | null> {
  const row = await db.first<{ value: string | null }>(`SELECT value FROM settings WHERE key = ?`, [
    key,
  ]);
  return row?.value ?? null;
}

export async function setSetting(
  db: Db,
  key: string,
  value: string | null,
  now: number = Date.now(),
): Promise<void> {
  await db.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now],
  );
}

export async function getNumber(db: Db, key: string, fallback = 0): Promise<number> {
  const v = await getSetting(db, key);
  return v === null ? fallback : Number(v);
}

/** Drives the count-based half of the backup nag. */
export async function bumpDosesSinceBackup(db: Db, by = 1, now: number = Date.now()): Promise<void> {
  const current = await getNumber(db, SETTING.dosesSinceBackup, 0);
  await setSetting(db, SETTING.dosesSinceBackup, String(current + by), now);
}

export async function markBackedUp(db: Db, at: number = Date.now()): Promise<void> {
  await setSetting(db, SETTING.lastBackupAt, String(at), at);
  await setSetting(db, SETTING.dosesSinceBackup, '0', at);
}

/**
 * Stable per-install identifier. Part of every idempotency key and stamped on
 * every row, so a future multi-device merge can tell which phone wrote what.
 */
export async function ensureDeviceId(db: Db, now: number = Date.now()): Promise<string> {
  const existing = await getSetting(db, SETTING.deviceId);
  if (existing) return existing;
  const id = newId(now);
  await setSetting(db, SETTING.deviceId, id, now);
  return id;
}
