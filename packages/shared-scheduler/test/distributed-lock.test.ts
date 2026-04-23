import { InMemoryCacheProvider } from '@tripod-stack/shared-cache';
import { describe, expect, it, vi } from 'vitest';

import { DistributedLock } from '../src/distributed-lock.js';

describe('DistributedLock', () => {
  it('首次 acquire 成功，返回 release 函数', async () => {
    const cache = new InMemoryCacheProvider();
    const lock = new DistributedLock(cache, () => {
      /* suppress warn */
    });
    const release = await lock.acquire('my-job', 60);
    expect(release).not.toBeNull();
    await release?.();
  });

  it('第二次 acquire 同 key：返回 null', async () => {
    const cache = new InMemoryCacheProvider();
    const lock = new DistributedLock(cache, () => {
      /* noop */
    });
    const r1 = await lock.acquire('my-job', 60);
    const r2 = await lock.acquire('my-job', 60);
    expect(r1).not.toBeNull();
    expect(r2).toBeNull();
    await r1?.();
    const r3 = await lock.acquire('my-job', 60);
    expect(r3).not.toBeNull();
  });

  it('release 是幂等的（即便锁过期也不崩）', async () => {
    const cache = new InMemoryCacheProvider();
    const lock = new DistributedLock(cache, () => {
      /* noop */
    });
    const release = await lock.acquire('job', 0.05); // 50ms
    await new Promise((r) => setTimeout(r, 80));
    await expect(release?.()).resolves.toBeUndefined();
  });

  it('ttlSec <= 0：抛 RangeError', async () => {
    const cache = new InMemoryCacheProvider();
    const lock = new DistributedLock(cache, () => {
      /* noop */
    });
    await expect(lock.acquire('k', 0)).rejects.toBeInstanceOf(RangeError);
  });

  it('in-memory cache 会触发 warning log', () => {
    const warn = vi.fn();
    new DistributedLock(new InMemoryCacheProvider(), warn);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('InMemoryCacheProvider'),
      expect.objectContaining({ impl: 'in-memory' }),
    );
  });

  it('withLock：抢到锁执行 fn', async () => {
    const cache = new InMemoryCacheProvider();
    const lock = new DistributedLock(cache, () => {
      /* noop */
    });
    const r = await lock.withLock('job', 60, async () => Promise.resolve(42));
    expect(r).toEqual({ skipped: false, value: 42 });
  });

  it('withLock：抢不到锁返回 skipped:true', async () => {
    const cache = new InMemoryCacheProvider();
    const lock = new DistributedLock(cache, () => {
      /* noop */
    });
    await lock.acquire('busy', 60);
    const r = await lock.withLock('busy', 60, async () => {
      throw new Error('should not run');
    });
    expect(r).toEqual({ skipped: true });
  });

  it('withLock：fn 抛错时锁仍被释放', async () => {
    const cache = new InMemoryCacheProvider();
    const lock = new DistributedLock(cache, () => {
      /* noop */
    });
    await expect(
      lock.withLock('k', 60, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    // 再次抢应能成功
    const r = await lock.acquire('k', 60);
    expect(r).not.toBeNull();
  });
});
