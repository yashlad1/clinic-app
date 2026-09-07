import type { Db } from '../db/driver';
import { getSetting, setSetting } from '../db/repo/settings';
import { supabaseBackend, type SupabaseConfig } from './backend.supabase';
import type { SyncBackend } from './backend';
import { EMBEDDED_SYNC } from './embedded';

/**
 * Where the server credentials live: the local `settings` table, entered once
 * per phone in Settings.
 *
 * NOT in app.json or any committed file. The GitHub repo is public (CLAUDE.md
 * section 13), and while a Supabase publishable key is designed to be exposed -
 * row-level security is the actual guard - publishing a specific clinic's key
 * is a standing invitation to probe it. `settings` is also excluded from
 * replication, so one phone's credentials never travel to another.
 */

export const SYNC_SETTING = {
  url: 'sync_url',
  key: 'sync_key',
  email: 'sync_email',
  password: 'sync_password',
  enabled: 'sync_enabled',
} as const;

/**
 * Resolution order: what this phone was told, then what the build shipped with.
 *
 * The override matters more than it looks. If the clinic ever moves to its own
 * project, or the password is rotated, that is a Settings edit on the phone
 * rather than a new APK sent to India over mobile data.
 *
 * `enabled` is the same story: unset means "follow the build", so an embedded
 * build is on from first launch, while an explicit '0' from the Settings screen
 * still switches it off.
 */
export async function loadSyncConfig(db: Db): Promise<SupabaseConfig | null> {
  const [url, key, email, password, enabled] = await Promise.all([
    getSetting(db, SYNC_SETTING.url),
    getSetting(db, SYNC_SETTING.key),
    getSetting(db, SYNC_SETTING.email),
    getSetting(db, SYNC_SETTING.password),
    getSetting(db, SYNC_SETTING.enabled),
  ]);

  if (enabled === '0') return null;
  if (enabled !== '1' && !EMBEDDED_SYNC) return null;

  const resolved: SupabaseConfig = {
    url: url || EMBEDDED_SYNC?.url || '',
    publishableKey: key || EMBEDDED_SYNC?.publishableKey || '',
    email: email || EMBEDDED_SYNC?.email || '',
    password: password || EMBEDDED_SYNC?.password || '',
  };
  const complete =
    !!resolved.url && !!resolved.publishableKey && !!resolved.email && !!resolved.password;
  return complete ? resolved : null;
}

export async function saveSyncConfig(
  db: Db,
  cfg: SupabaseConfig & { enabled: boolean },
): Promise<void> {
  await setSetting(db, SYNC_SETTING.url, cfg.url.trim());
  await setSetting(db, SYNC_SETTING.key, cfg.publishableKey.trim());
  await setSetting(db, SYNC_SETTING.email, cfg.email.trim());
  await setSetting(db, SYNC_SETTING.password, cfg.password);
  await setSetting(db, SYNC_SETTING.enabled, cfg.enabled ? '1' : '0');
}

export async function backendFor(db: Db): Promise<SyncBackend | null> {
  const cfg = await loadSyncConfig(db);
  return cfg ? supabaseBackend(cfg) : null;
}
