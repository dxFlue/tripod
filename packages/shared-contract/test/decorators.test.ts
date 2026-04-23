import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import {
  getIdempotentOptions,
  Idempotent,
  runWithIdempotency,
  type IdempotencyStore,
} from '../src/decorators/idempotent.js';
import { hasWithCorrelation, WithCorrelation } from '../src/decorators/with-correlation.js';

describe('@WithCorrelation', () => {
  it('类级装饰', () => {
    @WithCorrelation()
    class Svc {}
    expect(hasWithCorrelation(Svc)).toBe(true);
  });

  it('方法级装饰', () => {
    class Svc {
      @WithCorrelation()
      doWork(): void {
        /* noop */
      }
    }
    expect(hasWithCorrelation(Svc.prototype, 'doWork')).toBe(true);
    expect(hasWithCorrelation(Svc.prototype, 'other')).toBe(false);
  });
});

describe('@Idempotent metadata', () => {
  class OrderController {
    @Idempotent({ ttlSec: 3600, lockTtlSec: 30 })
    create(): string {
      return 'ok';
    }

    @Idempotent()
    update(): string {
      return 'default';
    }

    unmarked(): void {
      /* noop */
    }
  }

  it('读出自定义选项', () => {
    const opts = getIdempotentOptions(OrderController.prototype, 'create');
    expect(opts).toEqual({ keyFrom: 'header', ttlSec: 3600, lockTtlSec: 30 });
  });

  it('默认选项', () => {
    const opts = getIdempotentOptions(OrderController.prototype, 'update');
    expect(opts?.ttlSec).toBe(60 * 60 * 24);
    expect(opts?.lockTtlSec).toBe(60);
  });

  it('未标记方法返回 undefined', () => {
    expect(getIdempotentOptions(OrderController.prototype, 'unmarked')).toBeUndefined();
  });
});

/** 内存版 IdempotencyStore，仅用于单测。 */
class MemStore implements IdempotencyStore {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return Promise.resolve(this.store.get(key));
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }

  async setNX(key: string, value: string): Promise<boolean> {
    if (this.store.has(key)) return Promise.resolve(false);
    this.store.set(key, value);
    return Promise.resolve(true);
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }
}

describe('runWithIdempotency', () => {
  const defaults = { keyFrom: 'header' as const, ttlSec: 3600, lockTtlSec: 60 };

  it('首次调：执行 handler，缓存结果', async () => {
    const store = new MemStore();
    let called = 0;
    const result = await runWithIdempotency('valid-key-123456', defaults, store, async () => {
      called++;
      return Promise.resolve({ id: 1 });
    });
    expect(result).toEqual({ id: 1 });
    expect(called).toBe(1);
  });

  it('第二次同 key：不再执行 handler，回放缓存', async () => {
    const store = new MemStore();
    let called = 0;
    const handler = async (): Promise<{ n: number }> => {
      called++;
      return Promise.resolve({ n: called });
    };
    await runWithIdempotency('key-twice-111', defaults, store, handler);
    const second = await runWithIdempotency('key-twice-111', defaults, store, handler);
    expect(second).toEqual({ n: 1 });
    expect(called).toBe(1);
  });

  it('缺 key：抛 IDEMPOTENCY_KEY_INVALID', async () => {
    const store = new MemStore();
    await expect(
      runWithIdempotency(undefined, defaults, store, async () => Promise.resolve(1)),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_INVALID' });
  });

  it('key 太短：抛 IDEMPOTENCY_KEY_INVALID', async () => {
    const store = new MemStore();
    await expect(
      runWithIdempotency('short', defaults, store, async () => Promise.resolve(1)),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_INVALID' });
  });

  it('handler 抛错：不缓存结果，释放锁', async () => {
    const store = new MemStore();
    await expect(
      runWithIdempotency('key-error-abc', defaults, store, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // 再次调用：应当能重新进入 handler
    let called = 0;
    await runWithIdempotency('key-error-abc', defaults, store, async () => {
      called++;
      return Promise.resolve(1);
    });
    expect(called).toBe(1);
  });
});
