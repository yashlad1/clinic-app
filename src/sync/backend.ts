import type { SyncTable } from '../db/migrations/m002_sync';

/**
 * The seam between "what to sync" and "where it goes".
 *
 * Same trick as `src/db/driver.ts`: one narrow interface, a real adapter and an
 * in-memory adapter, so the whole sync engine is testable in plain Node with no
 * network and no Supabase project. Nothing outside `backend.*.ts` may know that
 * the server is Supabase.
 */

export type Row = Record<string, unknown>;

export interface PushBatch {
  table: SyncTable;
  rows: Row[];
}

export interface SyncBackend {
  /**
   * Upload rows. MUST be idempotent per row id, because a push that succeeds
   * on the server and then loses the response will be retried: the phone only
   * clears `dirty` after it hears back.
   */
  push(batch: PushBatch): Promise<void>;
  /** Everything the server holds, for rebuilding a lost phone. */
  pullAll(table: SyncTable): Promise<Row[]>;
  /** Cheap reachability + credential check for the Settings screen. */
  ping(): Promise<void>;
}

export class SyncAuthError extends Error {
  readonly kind = 'auth';
  constructor(message: string) {
    super(message);
    this.name = 'SyncAuthError';
  }
}

export class SyncNetworkError extends Error {
  readonly kind = 'network';
  constructor(message: string) {
    super(message);
    this.name = 'SyncNetworkError';
  }
}
