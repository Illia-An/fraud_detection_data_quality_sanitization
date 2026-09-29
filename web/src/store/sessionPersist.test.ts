import { beforeEach, describe, expect, it } from 'vitest';

import {
  readSessionJson,
  removeSessionKey,
  writeSessionJson,
} from './sessionPersist';

describe('sessionPersist', () => {
  const key = 'fraud-guard-test-session';

  beforeEach(() => {
    sessionStorage.removeItem(key);
  });

  it('round-trips JSON', () => {
    writeSessionJson(key, { a: 1 });
    expect(readSessionJson<{ a: number }>(key)).toEqual({ a: 1 });
  });

  it('returns null for missing or invalid JSON', () => {
    expect(readSessionJson(key)).toBeNull();
    sessionStorage.setItem(key, '{not-json');
    expect(readSessionJson(key)).toBeNull();
  });

  it('removes keys', () => {
    writeSessionJson(key, { ok: true });
    removeSessionKey(key);
    expect(readSessionJson(key)).toBeNull();
  });
});
