import 'reflect-metadata';

import type { IdempotencyStore } from '@tripod-stack/shared-contract';
import { runWithIdempotency } from '@tripod-stack/shared-contract';
import { describe, expect, it } from 'vitest';

import { InMemoryCacheProvider } from '../src/in-memory.js';

/**
 * 验证 InMemoryCacheProvider 结构兼容 IdempotencyStore，
 * 可直接作为 @Idempotent 的后端。
 */
describe('CacheProvider 结构兼容 IdempotencyStore', () => {
  it('InMemoryCacheProvider 可被 runWithIdempotency 当 store 用', async () => {
    // 包一层把 value 转 string（IdempotencyStore.get 期望 string；CacheProvider.get 泛型默认 string）
    const cache = new InMemoryCacheProvider();
    const store: IdempotencyStore = {
      get: async (k) => cache.get<string>(k),
      set: async (k, v, ttl) => cache.set(k, v, ttl),
      setNX: async (k, v, ttl) => cache.setNX(k, v, ttl),
      del: async (k) => cache.del(k),
    };

    let called = 0;
    const r1 = await runWithIdempotency(
      'test-key-111111111',
      { keyFrom: 'header', ttlSec: 60, lockTtlSec: 10 },
      store,
      async () => {
        called++;
        return Promise.resolve({ id: 1 });
      },
    );
    const r2 = await runWithIdempotency(
      'test-key-111111111',
      { keyFrom: 'header', ttlSec: 60, lockTtlSec: 10 },
      store,
      async () => {
        called++;
        return Promise.resolve({ id: 999 });
      },
    );

    expect(r1).toEqual({ id: 1 });
    expect(r2).toEqual({ id: 1 }); // 回放
    expect(called).toBe(1);
  });
});
