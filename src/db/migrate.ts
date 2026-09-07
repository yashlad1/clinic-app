import type { Db } from './driver';
import { MIGRATIONS, LATEST_VERSION } from './migrations';

export { LATEST_VERSION };

/**
 * Thrown when the database is NEWER than the app that opened it - almost always
 * because an OTA update was rolled back. We must NOT open it for writing:
 * silent partial writes against a future schema is how data is lost invisibly.
 */
export class DataNewerThanAppError extends Error {
  dataVersion: number;
  appVersion: number;
  constructor(dataVersion: number, appVersion: number) {
    super(
      `This version of the app (schema v${appVersion}) is older than your saved ` +
        `data (schema v${dataVersion}). Please update the app.`,
    );
    this.name = 'DataNewerThanAppError';
    this.dataVersion = dataVersion;
    this.appVersion = appVersion;
  }
}

export interface MigrateHooks {
  /**
   * Called once before ANY migration runs, when upgrading an existing database.
   * Should serialize the current db to a file. This is the highest-value safety
   * feature in the app: it makes every schema change recoverable on-device with
   * no user action, and costs nothing at this data volume.
   */
  snapshot?: (from: number, to: number) => Promise<void>;
  onProgress?: (version: number) => void;
}

export async function currentVersion(db: Db): Promise<number> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Forward-only migration runner. PRAGMA user_version is the single source of truth.
 */
export async function migrate(db: Db, hooks: MigrateHooks = {}): Promise<number> {
  // journal_mode is persistent but MUST be set outside a transaction.
  await db.exec('PRAGMA journal_mode = WAL');
  // foreign_keys is per-CONNECTION, not persistent - it has to be set on every open.
  await db.exec('PRAGMA foreign_keys = ON');

  let v = await currentVersion(db);

  if (v > LATEST_VERSION) throw new DataNewerThanAppError(v, LATEST_VERSION);
  if (v === LATEST_VERSION) return v;

  if (v > 0 && hooks.snapshot) await hooks.snapshot(v, LATEST_VERSION);

  for (const m of MIGRATIONS.filter((m) => m.to > v)) {
    await db.tx(async (tx) => {
      await m.up(tx);
      // Bumped INSIDE the transaction, deliberately. user_version lives in the
      // database header and is transactional, so a crash or a dead battery
      // mid-migration rolls back the schema change AND the version together.
      // Bumping it afterwards is the classic way to end up with a database that
      // claims v3 but has a v2 schema.
      //
      // PRAGMA cannot be parameterised, so this must be interpolated. That is
      // only acceptable because m.to is an integer literal from our own source.
      await tx.exec(`PRAGMA user_version = ${Number(m.to)}`);
    });
    v = m.to;
    hooks.onProgress?.(v);
  }

  return v;
}
