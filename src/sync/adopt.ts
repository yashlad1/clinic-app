import type { Db } from '../db/driver';
import { SETTING, getSetting, setSetting } from '../db/repo/settings';
import { seedCatalog } from '../db/repo/catalog';
import { pullOnce } from './pull';
import type { SyncBackend } from './backend';

/**
 * First launch: join the clinic, or start it.
 *
 * Without this, installing the APK on a second device is a guaranteed data
 * problem rather than a risk. `catalog_seeded` is a LOCAL setting, so a fresh
 * install seeds its own ~26 vaccines with brand-new UUIDs, marks them dirty and
 * pushes them - leaving two BCG rows and two Pentavac rows on the server.
 *
 * That is failure mode 1 (one vaccine, more than one row) recreated by the sync
 * layer, on day one, before anybody gives a dose. The fix is ordering: a device
 * that joins an existing clinic must PULL before it seeds.
 *
 * The offline case is the subtle one. If the server cannot be reached we must
 * NOT fall back to seeding - that is exactly how the duplicate gets created,
 * just delayed until connectivity returns. So we wait instead, and try again on
 * the next launch or foreground. An empty grid with an honest message is
 * recoverable; a duplicated catalog is not.
 */

export type AdoptResult =
  /** This device created the catalog. It is the primary device. */
  | { kind: 'seeded'; vaccines: number }
  /** This device took the catalog from the server. */
  | { kind: 'adopted'; rows: number }
  /** Sync is on but unreachable. Deliberately did nothing. */
  | { kind: 'waiting'; reason: string };

export async function adoptOrSeed(
  db: Db,
  deviceId: string,
  /** null means no server configured. Injected, never resolved in here, so
   *  this is testable against the in-memory backend like everything else. */
  backend: SyncBackend | null,
  now: number = Date.now(),
): Promise<AdoptResult | null> {
  if (await getSetting(db, SETTING.catalogSeeded)) return null; // already settled

  // No server configured: this is a standalone phone, so seed and be primary.
  if (!backend) {
    const n = await seedCatalog(db, deviceId, now);
    await setSetting(db, SETTING.catalogSeeded, '1', now);
    await setSetting(db, SETTING.isPrimaryDevice, '1', now);
    return { kind: 'seeded', vaccines: n };
  }

  const pulled = await pullOnce(db, backend, now);
  if (!pulled.ok) {
    // Cannot tell whether a clinic already exists, so refuse to guess.
    return { kind: 'waiting', reason: pulled.error ?? 'could not reach the server' };
  }

  const existing = await db.first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM vaccines WHERE deleted_at IS NULL`,
  );
  if ((existing?.n ?? 0) > 0) {
    await setSetting(db, SETTING.catalogSeeded, '1', now);
    await setSetting(db, SETTING.isPrimaryDevice, '0', now);
    return { kind: 'adopted', rows: pulled.appliedRows };
  }

  // Server reachable but empty: this really is the first device.
  const n = await seedCatalog(db, deviceId, now);
  await setSetting(db, SETTING.catalogSeeded, '1', now);
  await setSetting(db, SETTING.isPrimaryDevice, '1', now);
  return { kind: 'seeded', vaccines: n };
}

/** True unless this device is known to have joined an existing clinic. */
export async function isPrimaryDevice(db: Db): Promise<boolean> {
  return (await getSetting(db, SETTING.isPrimaryDevice)) !== '0';
}
