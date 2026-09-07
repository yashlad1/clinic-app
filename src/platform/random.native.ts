import * as Crypto from 'expo-crypto';

/** Randomness source on the device. React Native has no global crypto. */
export function getRandomValues(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  return Crypto.getRandomValues(bytes);
}
