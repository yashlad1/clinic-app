/**
 * The Db interface is the seam that keeps the entire data layer testable without a
 * device or an emulator. Three adapters implement it:
 *
 *   driver.expo.ts  - real device, wraps expo-sqlite
 *   driver.node.ts  - tests, wraps Node's built-in node:sqlite
 *   driver.web.ts   - browser smoke loop, in-memory
 *
 * INVARIANT: nothing outside src/db/driver.*.ts may import expo-sqlite.
 */

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface Db {
  /** Multi-statement DDL. Not parameterised - never interpolate user input here. */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: unknown[]): Promise<RunResult>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  first<T>(sql: string, params?: unknown[]): Promise<T | null>;
  /**
   * Exclusive transaction. The callback MUST use the `tx` handle it is given,
   * not the outer Db - on expo-sqlite, using the outer handle inside an
   * exclusive transaction deadlocks or silently escapes the transaction.
   */
  tx<R>(fn: (tx: Db) => Promise<R>): Promise<R>;
}
