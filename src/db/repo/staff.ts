import type { Db } from '../driver';
import { newId } from '../../domain/ids';

/**
 * More than one person enters data, so every ledger row is attributable.
 * Accountability by visibility - no countersigning, no two-person rule, no
 * login. Adding friction here would just mean doses stop getting logged.
 */

export interface Staff {
  id: string;
  name: string;
  is_active: number;
}

export async function createStaff(
  db: Db,
  name: string,
  deviceId: string,
  now: number = Date.now(),
): Promise<string> {
  const id = newId(now);
  await db.run(
    `INSERT INTO staff (id, name, created_at, updated_at, device_id) VALUES (?,?,?,?,?)`,
    [id, name.trim(), now, now, deviceId],
  );
  return id;
}

export function listStaff(db: Db, activeOnly = true): Promise<Staff[]> {
  return db.all<Staff>(
    `SELECT id, name, is_active FROM staff
      WHERE deleted_at IS NULL ${activeOnly ? 'AND is_active = 1' : ''}
      ORDER BY name COLLATE NOCASE`,
  );
}
