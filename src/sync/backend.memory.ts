import type { PushBatch, Row, SyncBackend } from './backend';
import type { SyncTable } from '../db/migrations/m002_sync';

/**
 * Test backend. Keyed by row id so it enforces the same idempotency the real
 * server does, which is the property most worth testing.
 */
export function memoryBackend(opts: { failEvery?: number } = {}) {
  const store = new Map<SyncTable, Map<string, Row>>();
  let pushes = 0;
  let seq = 0;

  const backend: SyncBackend = {
    async push(batch: PushBatch) {
      pushes += 1;
      if (opts.failEvery && pushes % opts.failEvery === 0) {
        throw new Error('simulated network failure');
      }
      const t = store.get(batch.table) ?? new Map<string, Row>();
      for (const r of batch.rows) {
        const id = String(r.id);
        // stock_movements is append-only on the server too: first write wins.
        if (batch.table === 'stock_movements' && t.has(id)) continue;
        // Mirrors the server's stale-write guard: the newest EDIT wins, not
        // the newest UPLOAD. Without this the test backend would be more
        // permissive than Postgres and would hide the bug it exists to catch.
        const prev = t.get(id);
        if (prev && Number(r.updated_at ?? 0) < Number(prev.updated_at ?? 0)) continue;
        // A monotonic stand-in for Postgres's `now()` default, so pullSince
        // behaves like the real thing.
        seq += 1;
        t.set(id, { ...r, synced_at: String(seq).padStart(12, '0') });
      }
      store.set(batch.table, t);
    },
    async pullAll(table: SyncTable) {
      return [...(store.get(table)?.values() ?? [])];
    },
    async pullSince(table: SyncTable, since: string | null, limit: number) {
      const rows = [...(store.get(table)?.values() ?? [])].sort((a, b) =>
        String(a.synced_at ?? '').localeCompare(String(b.synced_at ?? '')),
      );
      const after = since ? rows.filter((r) => String(r.synced_at ?? '') > since) : rows;
      return after.slice(0, limit);
    },
    async ping() {},
  };

  return {
    backend,
    rows: (table: SyncTable) => [...(store.get(table)?.values() ?? [])],
    count: (table: SyncTable) => store.get(table)?.size ?? 0,
    pushes: () => pushes,
  };
}
