/**
 * Generates docs/schema.sql from the migration chain, so the reference DDL can
 * never drift from what the app actually creates.
 *
 * Run with: npm run schema:dump
 *
 * Note the explicit file-extension imports. Node's ESM resolver does not do
 * directory imports (Metro and Jest do), so this script reaches for the
 * migration files directly rather than through src/db/migrations/index.ts.
 */
import { openNodeDb } from '../src/db/driver.node.ts';
import { m001 } from '../src/db/migrations/m001_initial.ts';

const MIGRATIONS = [m001];
const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].to;

const db = openNodeDb();
await db.exec('PRAGMA foreign_keys = ON');
for (const m of MIGRATIONS) {
  await db.tx(async (tx) => {
    await m.up(tx);
    await tx.exec(`PRAGMA user_version = ${Number(m.to)}`);
  });
}

const rows = await db.all<{ type: string; name: string; sql: string | null }>(
  `SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL
    ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1
                       WHEN 'view' THEN 2 ELSE 3 END, name`,
);

const out: string[] = [
  `-- Reference DDL for Clinic Stock, schema v${LATEST_VERSION}.`,
  `--`,
  `-- GENERATED from src/db/migrations by scripts/dump-schema.ts.`,
  `-- Do not edit by hand; run \`npm run schema:dump\` instead.`,
  `--`,
  `-- The migrations are the source of truth. This file exists so reviewers and`,
  `-- the ERD have a single flat view of what they produce.`,
  ``,
  `PRAGMA user_version = ${LATEST_VERSION};`,
  ``,
];
for (const r of rows) out.push(`${r.sql};`, ``);
console.log(out.join('\n'));
