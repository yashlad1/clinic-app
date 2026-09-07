import { useCallback } from 'react';
import { useToast } from './snackbar';
import { friendlyError } from './errors';

/**
 * Run a write, and if it fails, TELL HER.
 *
 * Eight of sixteen screens used to await a database write with no catch at all,
 * so a failure became an unhandled rejection: in a release build the button
 * simply did nothing and said nothing. This exists so that shape is not
 * reachable by accident - every write path goes through here.
 *
 *   const run = useAction();
 *   onPress={() => run('record this dose', async () => { ... })}
 *
 * It returns whether the action succeeded, so a caller can decide not to
 * navigate away or not to show its own success toast.
 */
export function useAction() {
  const toast = useToast();
  return useCallback(
    async (what: string, fn: () => Promise<void>): Promise<boolean> => {
      try {
        await fn();
        return true;
      } catch (e) {
        toast.showError(friendlyError(e, { what }));
        return false;
      }
    },
    [toast],
  );
}
