import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDb } from '../db/provider';
import { backendFor } from './config';
import { pushOnce } from './push';

/**
 * Background replication.
 *
 * Three rules, all of them consequences of CLAUDE.md invariant 5 - recording a
 * dose must never be blocked:
 *
 *  1. It NEVER blocks the UI and never shows a dialog. A clinic on flaky mobile
 *     data would otherwise be interrupted all morning by something that is not
 *     her problem.
 *  2. It NEVER surfaces its own failures as errors. A failed sync is not a
 *     failed dose - the entry is safe in SQLite and stays queued. Status lives
 *     quietly on the More tab instead.
 *  3. It never runs concurrently with itself, or two passes would upload the
 *     same rows twice. Harmless, since push is idempotent, but wasteful on
 *     metered data.
 */

/** Long enough that a queue of siblings becomes one upload, not five. */
const DEBOUNCE_MS = 4000;

export function useSyncEngine() {
  const { db, deviceId, revision } = useDb();
  const running = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncNow = useCallback(async (): Promise<{ ok: boolean; error?: string } | null> => {
    if (running.current) return null;
    running.current = true;
    try {
      const backend = await backendFor(db);
      if (!backend) return null; // not configured; that is a normal state
      const out = await pushOnce(db, backend, deviceId);
      return { ok: out.ok, error: out.error };
    } catch (e) {
      // Swallowed on purpose - see rule 2. pushOnce already wrote it to
      // sync_log, which is what the More tab reads.
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    } finally {
      running.current = false;
    }
  }, [db, deviceId]);

  // After a write. `revision` is bumped by every mutation in the app, so this
  // is the single hook that catches all of them.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void syncNow(), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [revision, syncNow]);

  // On return to the app: the most likely moment for connectivity to have come
  // back, and the cheapest place to drain a queue built up offline.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncNow();
    });
    return () => sub.remove();
  }, [syncNow]);

  return syncNow;
}

/** Mounted once, under the providers. Renders nothing. */
export function AutoSync() {
  useSyncEngine();
  return null;
}
