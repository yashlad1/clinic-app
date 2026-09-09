import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
// Type-only, so it is erased at compile time and does not breach invariant 6.
import type { SQLiteDatabase } from 'expo-sqlite';
import Constants from 'expo-constants';
import type { Db } from './driver';
import { openDeviceDb } from './driver.expo';
import { DataNewerThanAppError, migrate } from './migrate';
import { SETTING, ensureDeviceId, getSetting, setSetting } from './repo/settings';
import { snapshotDb } from './backup/export';
import { adoptOrSeed } from '../sync/adopt';
import { backendFor } from '../sync/config';
import { todayLocal } from '../domain/time';

interface DbContextValue {
  db: Db;
  raw: SQLiteDatabase;
  deviceId: string;
  appVersion: string;
  /** Increments after every write; queries re-run when it changes. */
  revision: number;
  bump: () => void;
}

const DbContext = createContext<DbContextValue | null>(null);

export type DbStatus =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string; blocking: boolean };

export function useDb(): DbContextValue {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error('useDb must be used inside <DbProvider>');
  return ctx;
}

export function DbProvider({
  children,
  renderLoading,
  renderError,
}: {
  children: React.ReactNode;
  renderLoading: () => React.ReactElement;
  renderError: (message: string) => React.ReactElement;
}) {
  const [value, setValue] = useState<DbContextValue | null>(null);
  const [status, setStatus] = useState<DbStatus>({ kind: 'loading' });
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { db, raw } = await openDeviceDb();
        const appVersion = String(Constants.expoConfig?.version ?? '0.0.0');

        // Snapshot BEFORE any migration touches an existing database. This is
        // what makes every schema change recoverable on the device itself.
        await migrate(db, {
          snapshot: async (from, to) => {
            await snapshotDb(raw, `premigration-v${from}-to-v${to}-${Date.now()}`, 5).catch(() => {
              // A failed snapshot must not block the migration - but it is worth
              // knowing about, so it surfaces in logcat rather than vanishing.
              console.warn('[clinic] pre-migration snapshot failed');
            });
          },
        });

        const deviceId = await ensureDeviceId(db);

        // Join the clinic, or start it. Never both.
        //
        // This deliberately replaces a plain seedCatalog() call: on a second
        // device that would have created a SECOND copy of the catalog with new
        // UUIDs and pushed it, leaving two rows per vaccine on the server -
        // failure mode 1, recreated by the sync layer. adoptOrSeed pulls first,
        // and when the server is unreachable it waits rather than guessing.
        await (async () => {
          const backend = await backendFor(db).catch(() => null);
          await adoptOrSeed(db, deviceId, backend);
        })().catch(() => undefined);

        // One silent .db snapshot per day. Survives a crash or DB corruption;
        // does NOT survive a lost phone, which is why it supplements rather
        // than replaces the share-out backup.
        const today = todayLocal();
        if ((await getSetting(db, 'last_daily_snapshot')) !== today) {
          await snapshotDb(raw, `daily-${today}`, 7).catch(() => undefined);
          await setSetting(db, 'last_daily_snapshot', today);
        }

        if (cancelled) return;
        setValue({ db, raw, deviceId, appVersion, revision: 0, bump });
        setStatus({ kind: 'ready' });
      } catch (e) {
        if (cancelled) return;
        const blocking = e instanceof DataNewerThanAppError;
        setStatus({
          kind: 'error',
          blocking,
          message: e instanceof Error ? e.message : 'Could not open the clinic database.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bump]);

  const withRevision = useMemo(
    () => (value ? { ...value, revision } : null),
    [value, revision],
  );

  if (status.kind === 'error') return renderError(status.message);
  if (!withRevision) return renderLoading();
  return <DbContext.Provider value={withRevision}>{children}</DbContext.Provider>;
}

/**
 * Re-runs `run` whenever the ledger changes.
 *
 * A revision counter rather than expo-sqlite's native change listener or an ORM
 * live-query: twenty lines, fully deterministic, and it cannot break because a
 * native callback did not fire.
 */
export function useQuery<T>(
  run: (db: Db) => Promise<T>,
  deps: unknown[] = [],
): { data: T | null; loading: boolean; error: Error | null; reload: () => void } {
  const { db, revision } = useDb();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    runRef.current(db)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, revision, nonce, ...deps]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}

/** Wraps a write so every mutation refreshes the screens that read it. */
export function useWrite() {
  const { db, deviceId, bump } = useDb();
  return useCallback(
    async <R,>(fn: (db: Db, deviceId: string) => Promise<R>): Promise<R> => {
      const out = await fn(db, deviceId);
      bump();
      return out;
    },
    [db, deviceId, bump],
  );
}
