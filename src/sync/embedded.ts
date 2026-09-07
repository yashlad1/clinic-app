import type { SupabaseConfig } from './backend.supabase';

/**
 * Credentials baked in at build time, so the clinic phone needs no setup.
 *
 * WHY THIS EXISTS, and the trade it makes.
 *
 * Configuring the server by hand is seven steps - URL, key, email, password,
 * toggle, test, save - explained over WhatsApp to a doctor on another
 * continent. That does not happen, and an unconfigured backup protects nobody.
 * So the values ship with the build and server backup is on from first launch.
 *
 * The cost, stated plainly: `EXPO_PUBLIC_*` values are inlined into the
 * JavaScript bundle, so anyone who unzips the APK can read the clinic login and
 * could then read and append to this clinic's rows. What contains the damage:
 *
 *   - Row-level security confines any leak to THIS clinic's data.
 *   - `stock_movements` has no UPDATE or DELETE policy on the server, so a
 *     leaked credential cannot erase history - only read and append.
 *   - Rotating is cheap: change the Supabase password, update the EAS
 *     environment variables, publish an update.
 *
 * Judged against the actual risk - a lost or broken phone, not a targeted
 * attacker - a backup that works unattended beats a stricter one that is never
 * switched on.
 *
 * The values themselves are NEVER committed. They live in EAS environment
 * variables and are injected at bundle time; the repo holds only these names.
 */

const url = process.env.EXPO_PUBLIC_SYNC_URL;
const key = process.env.EXPO_PUBLIC_SYNC_KEY;
const email = process.env.EXPO_PUBLIC_SYNC_EMAIL;
const password = process.env.EXPO_PUBLIC_SYNC_PASSWORD;

/** Present only in a build that was given all four variables. */
export const EMBEDDED_SYNC: SupabaseConfig | null =
  url && key && email && password
    ? { url, publishableKey: key, email, password }
    : null;

export const hasEmbeddedSync = EMBEDDED_SYNC !== null;
