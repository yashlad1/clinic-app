import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDb } from '../db/provider';
import { backendFor } from './config';
import { pushOnce } from './push';
import { pullOnce } from './pull';
import { adoptOrSeed } from './adopt';

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

/**
 * A heartbeat, on top of the write-triggered and foreground-triggered passes.
 *
 * Those two cover almost everything, but not the case that matters most for
 * someone checking from home: the app left open on a clinic counter all
 * afternoon, with entries going in on the OTHER device. Without a timer this
 * one never pulls, so its screen quietly drifts out of date while looking
 * authoritative.
 *
 * Fifteen minutes because that is the resolution the question needs - "is
 * today's stock roughly right" - and because a sync is a few kilobytes: a
 * whole day of heartbeats costs less than one photo.
 */
const HEARTBEAT_MS = 15 * 60 * 1000;

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

      // A device that could not reach the server on first launch is still
      // waiting for a catalog. Settle that before anything else, so it never
      // ends up seeding a duplicate one.
      await adoptOrSeed(db, deviceId, backend).catch(() => undefined);

      // PULL BEFORE PUSH, always. A device must learn what already exists
      // before offering its own version of it - pushing first is how two
      // devices end up having both created the same batch or catalog row.
      const pulled = await pullOnce(db, backend);
      const pushed = await pushOnce(db, backend, deviceId);
      return {
        ok: pulled.ok && pushed.ok,
        error: pushed.error ?? pulled.error,
      };
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

  // Every 15 minutes while the app is open. `syncNow` already refuses to run
  // concurrently with itself, so a tick landing on top of a write-triggered
  // pass is a no-op rather than a duplicate upload.
  useEffect(() => {
    const id = setInterval(() => {
      // Only while in the foreground: a background timer would not fire
      // reliably on Android anyway, and pretending otherwise invites trust in
      // a guarantee that does not exist.
      if (AppState.currentState === 'active') void syncNow();
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [syncNow]);

  return syncNow;
}

/** Mounted once, under the providers. Renders nothing. */
export function AutoSync() {
  useSyncEngine();
  return null;
}
