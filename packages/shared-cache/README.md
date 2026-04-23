# @tripod-stack/shared-cache

`CacheProvider` 接口 + `InMemoryCacheProvider`（M2 默认单进程实现）+ `@Cacheable()` 方法装饰器。

**生产多实例部署 ⚠ 必须**通过 adapter 层切 `cache-redis`（阶段 2 交付）。

## 依赖位置

- **层级**：基础层（阶段 1）
- **依赖**：`shared-types` / `shared-contract`（结构兼容 `IdempotencyStore`）
- **被谁依赖**：`shared-scheduler`（用 setNX 做分布式锁）、apps 全部

## 公共 API

### `CacheProvider` 接口

| 方法                        | 签名                                       | 作用                              |
| --------------------------- | ------------------------------------------ | --------------------------------- |
| `get<T>(key)`               | `(key: string) => Promise<T \| undefined>` | 读值；miss 返回 undefined         |
| `set(key, value, ttlSec?)`  | `(key, value, ttlSec?) => Promise<void>`   | 写（`ttlSec<=0` 永久）            |
| `setNX(key, value, ttlSec)` | `(key, value, ttlSec) => Promise<boolean>` | SETNX 原子写（锁用）              |
| `del(key)`                  | `(key) => Promise<void>`                   | 删（幂等）                        |
| `has(key)`                  | `(key) => Promise<boolean>`                | 是否存在                          |
| `ttl(key)`                  | `(key) => Promise<number>`                 | `-2`=不存在 / `-1`=永久 / >0=秒数 |
| `delByPrefix(prefix)`       | `(prefix) => Promise<number>`              | 批删，返回删除数                  |

### `InMemoryCacheProvider`

单进程 Map 实现。⚠ **生产慎用**。

| 额外方法  | 作用               |
| --------- | ------------------ |
| `clear()` | 清空所有，仅测试用 |

### `@Cacheable()`

| 元素                                       | 签名                                  | 作用               |
| ------------------------------------------ | ------------------------------------- | ------------------ |
| `Cacheable(opts?)`                         | `MethodDecorator`                     | 标记方法结果可缓存 |
| `CacheableOptions`                         | `{ namespace?, ttlSec?=300, keyFn? }` | 选项               |
| `getCacheableOptions(target, key)`         | metadata reader                       | 拦截器读取用       |
| `buildCacheKey(class, method, opts, args)` | `(...) => string`                     | 生成缓存键         |

运行时拦截逻辑由 apps 的 `CacheInterceptor` 实现（读 `CACHEABLE_METADATA` + 注入 `CacheProvider`）。

### DI Token

| 名称             | 用途                                                          |
| ---------------- | ------------------------------------------------------------- |
| `CACHE_PROVIDER` | `Symbol`，NestJS `@Inject(CACHE_PROVIDER)` 注入 CacheProvider |

## 使用示例

### Golden path：方法级缓存

```ts
import { Injectable, Inject } from '@nestjs/common';
import { Cacheable, CACHE_PROVIDER, type CacheProvider } from '@tripod-stack/shared-cache';

@Injectable()
export class OrderService {
  constructor(@Inject(CACHE_PROVIDER) private readonly cache: CacheProvider) {}

  @Cacheable({ ttlSec: 60, namespace: 'order-summary' })
  async getSummary(tenantId: TenantId) {
    return this.aggregate(tenantId);
  }

  async invalidateAll() {
    await this.cache.delByPrefix('order-summary:');
  }
}
```

### 作为 @Idempotent 的 store

```ts
import { runWithIdempotency, type IdempotencyStore } from '@tripod-stack/shared-contract';
import { InMemoryCacheProvider } from '@tripod-stack/shared-cache';

const cache = new InMemoryCacheProvider();
const store: IdempotencyStore = {
  get: (k) => cache.get(k),
  set: (k, v, ttl) => cache.set(k, v, ttl),
  setNX: (k, v, ttl) => cache.setNX(k, v, ttl),
  del: (k) => cache.del(k),
};
```

(生产环境 adapter `cache-redis` 会直接实现 `IdempotencyStore`，无需包装)

## 反模式 ❌ vs 正确 ✅

### 1. 不要生产多实例跑 InMemory

❌

```ts
// 生产 2 台机器 + InMemoryCacheProvider
// → SETNX 只锁本机 → idempotency 可能重复执行 → 付款重复
```

✅

```ts
// apps/server/src/cache.module.ts 按 NODE_ENV 选
provide: CACHE_PROVIDER,
useClass: process.env.NODE_ENV === 'production' ? RedisCacheProvider : InMemoryCacheProvider,
```

### 2. 不要缓存大对象 / 含敏感字段

❌

```ts
@Cacheable({ ttlSec: 3600 })
async getUserWithToken() { return { ..., accessToken } }  // token 泄漏
```

✅

```ts
@Cacheable({ ttlSec: 3600 })
async getUserProfile() { return this.sanitize(user) }
```

### 3. 不要手动拼 cache key

❌

```ts
const key = `orders:${tenantId}:${id}`; // 业务到处拼，易错 + 租户前缀忘写 = 跨租户污染
```

✅

```ts
@Cacheable({ namespace: 'orders', keyFn: ([tid, id]) => `${tid}:${id}` })
async getOrder(tenantId: TenantId, id: string) { ... }
```

## 相关

- `@tripod-stack/shared-contract` — `IdempotencyStore` 接口（CacheProvider 结构兼容）
- `@tripod-stack/shared-scheduler` — 使用 CacheProvider 做分布式锁
- `adapters/cache-redis/`（阶段 2 交付） — 生产 Redis 实现
- plan-full `§shared-cache`
