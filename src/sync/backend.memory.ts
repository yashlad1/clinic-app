import type { PushBatch, Row, SyncBackend } from './backend';
import type { SyncTable } from '../db/migrations/m002_sync';

/**
 * Test backend. Keyed by row id so it enforces the same idempotency the real
 * server does, which is the property most worth testing.
 */
export function memoryBackend(opts: { failEvery?: number } = {}) {
  const store = new Map<SyncTable, Map<string, Row>>();
  let pushes = 0;

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
        t.set(id, r);
      }
      store.set(batch.table, t);
    },
    async pullAll(table: SyncTable) {
      return [...(store.get(table)?.values() ?? [])];
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
