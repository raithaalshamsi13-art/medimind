/**
 * Identifier generation, in one place so it is trivial to stub in tests.
 *
 * UUIDs (not auto-increment integers) because medicines will eventually sync to
 * a cloud database: a client needs to be able to mint an id offline without
 * risking a collision with a row created on another device.
 */

import * as Crypto from 'expo-crypto';

export function newId(): string {
  return Crypto.randomUUID();
}
