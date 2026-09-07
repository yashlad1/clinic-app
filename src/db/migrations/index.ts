import { m001 } from './m001_initial';

/**
 * Ordered migration chain. Append new migrations; never edit a shipped one.
 *
 * Rules (see CLAUDE.md section 6):
 *   - Additive only. No DROP TABLE, no DROP COLUMN, no DELETE. To retire a
 *     column, stop reading it.
 *   - Every migration gets a test that builds v(N-1) with seeded rows, runs the
 *     chain, and asserts every pre-existing row survived.
 */
export const MIGRATIONS = [m001];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].to;
