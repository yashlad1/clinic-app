/**
 * Randomness source for Node and web. Metro resolves random.native.ts on the
 * device instead, which routes through expo-crypto.
 */
export function getRandomValues(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(bytes);
}
