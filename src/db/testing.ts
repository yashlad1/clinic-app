import { openNodeDb } from './driver.node';
import { migrate } from './migrate';
import type { Db } from './driver';
import { seedCatalog } from './repo/catalog';
import { createStaff } from './repo/staff';
import type { WriteContext } from '../domain/ledger';
import type { SeedVaccine } from '../domain/seed';

/** Fixed instants so tests never depend on the wall clock. */
export const T0 = Date.UTC(2026, 8, 6, 5, 0, 0); // 6 Sep 2026, 10:30 IST
export const IST = 330;

export interface TestEnv {
  db: Db;
  ctx: WriteContext;
  vaccineId(name: string): Promise<string>;
}

/** A migrated in-memory database. No device, no emulator, no React. */
export async function makeTestDb(
  opts: { seed?: SeedVaccine[]; now?: number } = {},
): Promise<TestEnv> {
  const now = opts.now ?? T0;
  const db = openNodeDb();
  await migrate(db);

  const deviceId = 'test-device';
  if (opts.seed !== undefined) await seedCatalog(db, deviceId, now, opts.seed);
  const staffId = await createStaff(db, 'Dr Test', deviceId, now);

  return {
    db,
    ctx: { deviceId, staffId, now, tzOffsetMinutes: IST },
    async vaccineId(name: string) {
      const row = await db.first<{ id: string }>(`SELECT id FROM vaccines WHERE name = ?`, [name]);
      if (!row) throw new Error(`no seeded vaccine named ${name}`);
      return row.id;
    },
  };
}

/** Deterministic client action ids, so tests control idempotency explicitly. */
export function actions(prefix = 'a'): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}
