import type { CacheProvider } from './provider.js';

interface Entry {
  value: unknown;
  expiresAt?: number;
}

/**
 * `InMemoryCacheProvider` —— 单进程 Map 缓存。
 *
 * ⚠ **仅适合单实例部署 / 开发 / 测试**。生产多实例时**必须**切到 adapter 层的
 * `cache-redis` —— 否则分布式锁退化为本地锁，idempotency 回放跨实例失效。
 *
 * 内部 Map + 惰性过期（get 时检查 expiresAt）；没有定时扫描任务（避免 setInterval 泄漏）。
 */
export class InMemoryCacheProvider implements CacheProvider {
  private readonly store = new Map<string, Entry>();

  public async get<T = string>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (entry === undefined) return Promise.resolve(undefined);
    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return Promise.resolve(undefined);
    }
    return Promise.resolve(entry.value as T);
  }

  public async set(key: string, value: unknown, ttlSec?: number): Promise<void> {
    const entry: Entry =
      ttlSec !== undefined && ttlSec > 0
        ? { value, expiresAt: Date.now() + ttlSec * 1000 }
        : { value };
    this.store.set(key, entry);
    return Promise.resolve();
  }

  public async setNX(key: string, value: unknown, ttlSec: number): Promise<boolean> {
    const existing = await this.get(key);
    if (existing !== undefined) return false;
    await this.set(key, value, ttlSec);
    return true;
  }

  public async del(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  public async has(key: string): Promise<boolean> {
    const v = await this.get(key);
    return v !== undefined;
  }

  public async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (entry === undefined) return Promise.resolve(-2);
    if (entry.expiresAt === undefined) return Promise.resolve(-1);
    const remainMs = entry.expiresAt - Date.now();
    if (remainMs <= 0) {
      this.store.delete(key);
      return Promise.resolve(-2);
    }
    return Promise.resolve(Math.ceil(remainMs / 1000));
  }

  public async delByPrefix(prefix: string): Promise<number> {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return Promise.resolve(count);
  }

  /** 清空所有缓存。**仅测试 / 诊断用**。 */
  public clear(): void {
    this.store.clear();
  }
}
