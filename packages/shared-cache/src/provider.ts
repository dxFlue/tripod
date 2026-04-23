/**
 * `CacheProvider` —— 统一缓存接口。业务代码通过 DI 拿到实现不关心底层。
 *
 * M2 默认有 `InMemoryCacheProvider`（单进程）。
 * 生产多实例部署时业务切到 adapter 层的 `cache-redis`（阶段 2 交付）。
 *
 * **结构兼容 `IdempotencyStore`**（shared-contract）：`@Idempotent` 装饰器直接注入 CacheProvider。
 */
export interface CacheProvider {
  /**
   * 读值。miss 返回 undefined。
   *
   * @param key - 缓存键；建议走 `namespace:entity:id` 格式
   */
  get<T = string>(key: string): Promise<T | undefined>;

  /**
   * 写值并设 TTL。ttlSec <= 0 视为"永不过期"（生产慎用）。
   */
  set(key: string, value: unknown, ttlSec?: number): Promise<void>;

  /**
   * 原子性 setIfNotExists（SETNX 语义）。用于分布式锁 / idempotency 入口。
   *
   * @returns true = 成功写入（之前不存在）；false = 已存在（未写入）
   */
  setNX(key: string, value: unknown, ttlSec: number): Promise<boolean>;

  /**
   * 删键。不存在也不报错。
   */
  del(key: string): Promise<void>;

  /**
   * 查 key 是否存在（不管值是什么）。
   */
  has(key: string): Promise<boolean>;

  /**
   * 查 key 剩余 TTL（秒）。
   * - 不存在返回 -2
   * - 无 TTL（永久）返回 -1
   */
  ttl(key: string): Promise<number>;

  /**
   * 按前缀删（常用于 invalidate 某 entity 的全部 cache）。
   */
  delByPrefix(prefix: string): Promise<number>;
}

/** 便于 DI 的 token（NestJS `@Inject(CACHE_PROVIDER)` 用） */
export const CACHE_PROVIDER = Symbol.for('tripod.shared-cache.CacheProvider');
