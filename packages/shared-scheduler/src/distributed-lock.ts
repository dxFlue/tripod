import type { CacheProvider } from '@tripod-stack/shared-cache';
import { InMemoryCacheProvider } from '@tripod-stack/shared-cache';

const defaultLogger = (msg: string, extra?: Record<string, unknown>): void => {
  const tail = extra !== undefined ? ' ' + JSON.stringify(extra) : '';
  process.stderr.write(`${msg}${tail}\n`);
};

/**
 * 基于 CacheProvider 的分布式锁。生产环境 CacheProvider 必须是 Redis 实现
 * （adapters/cache-redis，阶段 2 交付）；in-memory 时**仅适合单实例部署**。
 *
 * 构造时检测 CacheProvider 类型 —— 是 `InMemoryCacheProvider` 就打警告（通过传入的 logger）。
 */
export class DistributedLock {
  public constructor(
    private readonly cache: CacheProvider,
    private readonly logger: (msg: string, extra?: Record<string, unknown>) => void = defaultLogger,
  ) {
    if (cache instanceof InMemoryCacheProvider) {
      this.logger(
        'DistributedLock: backed by InMemoryCacheProvider — safe only for single-instance deployments',
        { impl: 'in-memory' },
      );
    }
  }

  /**
   * 尝试加锁。成功返回释放函数；失败返回 null（锁被别人持有）。
   *
   * @param key - 锁的唯一标识（通常是任务名）
   * @param ttlSec - 锁超时保护（防死锁），必须大于 0
   *
   * @example
   * const release = await lock.acquire('order-cleanup', 300);
   * if (release === null) return; // 别人在跑
   * try {
   *   await doWork();
   * } finally {
   *   await release();
   * }
   */
  public async acquire(key: string, ttlSec: number): Promise<(() => Promise<void>) | null> {
    if (ttlSec <= 0) throw new RangeError(`ttlSec must be > 0, got ${String(ttlSec)}`);
    const lockKey = `lock:${key}`;
    const owner = `${String(process.pid)}-${Math.random().toString(36).slice(2, 10)}`;
    const acquired = await this.cache.setNX(lockKey, owner, ttlSec);
    if (!acquired) return null;
    return async () => {
      const current = await this.cache.get(lockKey);
      if (current === owner) {
        await this.cache.del(lockKey);
      }
      // 若 current !== owner 说明锁已过期被别人抢了，不强删（否则会删掉别人的锁）
    };
  }

  /**
   * 高阶包装 —— 自动 acquire + 调 fn + 自动 release。
   * 锁抢不到时返回 `{ skipped: true }`。
   *
   * @example
   * const result = await lock.withLock('order-cleanup', 300, () => cleanupOrders());
   * if (result.skipped) logger.info({ key: 'order-cleanup' }, 'scheduler skipped (held by other instance)');
   */
  public async withLock<T>(
    key: string,
    ttlSec: number,
    fn: () => Promise<T>,
  ): Promise<{ skipped: true } | { skipped: false; value: T }> {
    const release = await this.acquire(key, ttlSec);
    if (release === null) return { skipped: true };
    try {
      const value = await fn();
      return { skipped: false, value };
    } finally {
      await release();
    }
  }
}
