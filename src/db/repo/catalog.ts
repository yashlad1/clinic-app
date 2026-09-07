import type { Db } from '../driver';
import { newId } from '../../domain/ids';
import type { SeedVaccine } from '../../domain/seed';
import { SEED_VACCINES } from '../../domain/seed';
import type { Vaccine } from '../../domain/types';

/**
 * Catalog writes. Reachable from the Catalog admin screen ONLY.
 *
 * If a data-entry screen can create a catalog row, we have re-invented free
 * text with extra steps - and failure mode 1 (misspelling) comes straight back.
 */

export async function insertVaccine(
  db: Db,
  v: SeedVaccine,
  deviceId: string,
  now: number = Date.now(),
): Promise<string> {
  const id = newId(now);
  await db.run(
    `INSERT INTO vaccines
       (id, name, generic_name, aliases, unit_mode, doses_per_vial,
        min_balance_doses, created_at, updated_at, device_id)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      v.name,
      v.generic_name ?? null,
      JSON.stringify(v.aliases ?? []),
      v.unit_mode,
      v.doses_per_vial,
      v.min_balance_doses,
      now,
      now,
      deviceId,
    ],
  );
  return id;
}

/** Idempotent: safe to run on every launch. */
export async function seedCatalog(
  db: Db,
  deviceId: string,
  now: number = Date.now(),
  vaccines: SeedVaccine[] = SEED_VACCINES,
): Promise<number> {
  let inserted = 0;
  await db.tx(async (tx) => {
    for (const v of vaccines) {
      const existing = await tx.first<{ id: string }>(
        `SELECT id FROM vaccines WHERE name = ? AND deleted_at IS NULL`,
        [v.name],
      );
      if (existing) continue;
      await insertVaccine(tx, v, deviceId, now);
      inserted++;
    }
  });
  return inserted;
}

export function listVaccines(db: Db, activeOnly = true): Promise<Vaccine[]> {
  return db.all<Vaccine>(
    `SELECT * FROM vaccines
      WHERE deleted_at IS NULL ${activeOnly ? 'AND is_active = 1' : ''}
      ORDER BY name COLLATE NOCASE`,
  );
}

/**
 * Alias-aware search, so the picker is generous while identity stays single.
 */
export function searchVaccines(db: Db, q: string): Promise<Vaccine[]> {
  const needle = `%${q.toLowerCase()}%`;
  return db.all<Vaccine>(
    `SELECT * FROM vaccines
      WHERE deleted_at IS NULL AND is_active = 1
        AND (LOWER(name) LIKE ? OR LOWER(COALESCE(generic_name,'')) LIKE ? OR LOWER(aliases) LIKE ?)
      ORDER BY name COLLATE NOCASE`,
    [needle, needle, needle],
  );
}

export async function setMinBalance(
  db: Db,
  vaccineId: string,
  minBalanceDoses: number,
  now: number = Date.now(),
): Promise<void> {
  await db.run(`UPDATE vaccines SET min_balance_doses = ?, updated_at = ? WHERE id = ?`, [
    minBalanceDoses,
    now,
    vaccineId,
  ]);
}

/** Retire, never delete - history must keep resolving. */
export async function deactivateVaccine(db: Db, vaccineId: string, now: number = Date.now()) {
  await db.run(`UPDATE vaccines SET is_active = 0, updated_at = ? WHERE id = ?`, [now, vaccineId]);
}
