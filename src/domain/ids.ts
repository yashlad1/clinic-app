import { getRandomValues } from '../platform/random';

const HEX: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/**
 * UUIDv7 - 48-bit big-endian millisecond timestamp, then randomness.
 *
 * Chosen over v4 because it is time-sortable, which matters for an offline
 * ledger: rows sort into insertion order without trusting the device clock for
 * *identity*, and the index stays dense instead of scattering writes across the
 * whole B-tree. Being client-generated means a row created offline keeps the
 * same identity forever, so a future multi-device merge is a set union.
 */
export function newId(now: number = Date.now()): string {
  const b = new Uint8Array(new ArrayBuffer(16));
  getRandomValues(b);

  // 48-bit timestamp, big-endian.
  b[0] = (now / 2 ** 40) & 0xff;
  b[1] = (now / 2 ** 32) & 0xff;
  b[2] = (now / 2 ** 24) & 0xff;
  b[3] = (now / 2 ** 16) & 0xff;
  b[4] = (now / 2 ** 8) & 0xff;
  b[5] = now & 0xff;

  b[6] = (b[6] & 0x0f) | 0x70; // version 7
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant

  const h = HEX;
  return (
    h[b[0]] + h[b[1]] + h[b[2]] + h[b[3]] + '-' +
    h[b[4]] + h[b[5]] + '-' +
    h[b[6]] + h[b[7]] + '-' +
    h[b[8]] + h[b[9]] + '-' +
    h[b[10]] + h[b[11]] + h[b[12]] + h[b[13]] + h[b[14]] + h[b[15]]
  );
}

/**
 * An idempotency key must be derived from the USER'S TAP, not from the moment
 * we get around to writing. `clientActionId` is minted when the button is
 * pressed and reused across every retry of that one intent, so a replayed or
 * retried write collides on the UNIQUE index and becomes a no-op that looks
 * like success. This is what makes a double-decrement impossible.
 */
export function idempotencyKey(deviceId: string, clientActionId: string): string {
  return `${deviceId}:${clientActionId}`;
}
