# @tripod-stack/shared-contract

Tripod API 契约层：HTTP envelope + 错误映射 + 分页 helper + CorrelationContext ALS + `@Idempotent` / `@WithCorrelation` 装饰器 + `defineModuleManifest` + API versioning。

## 依赖位置

- **层级**：基础层（阶段 1）
- **依赖**：`shared-types`、`shared-utils`；`reflect-metadata`（peer，装饰器用）
- **被谁依赖**：所有业务 shared-\* + apps/server（controllers + interceptors + exception filter）

## 公共 API

### HTTP Envelope

| 名称              | 签名                                            | 作用                                   |
| ----------------- | ----------------------------------------------- | -------------------------------------- |
| `ok(data, meta?)` | `<T>(data: T, meta?: ApiMeta) => ApiSuccess<T>` | 产成功响应                             |
| `err(error)`      | `(error: ErrorBody) => ApiFailure`              | 产失败响应（**通常由 filter 自动产**） |
| `isApiSuccess(r)` | type guard                                      | 判成功                                 |

### 业务异常

| 名称                   | 作用             | 错误码                       |
| ---------------------- | ---------------- | ---------------------------- |
| `BusinessException`    | 所有业务异常基类 | 自定义                       |
| `TenantIsolationError` | 租户隔离违规特例 | `TENANT_ISOLATION_VIOLATION` |

### 错误码 → HTTP status

| 名称                                  | 签名                                     | 作用                     |
| ------------------------------------- | ---------------------------------------- | ------------------------ |
| `getHttpStatus(code)`                 | `(code: ErrorCode\|string) => number`    | 查默认映射，未知返回 500 |
| `registerStatusMapping(code, status)` | `(code, status) => void`                 | 业务注册自定义映射       |
| `getDefaultMapping()`                 | `() => Readonly<Record<string, number>>` | 诊断/文档用              |

### 分页

| 名称                            | 签名                                   | 作用                       |
| ------------------------------- | -------------------------------------- | -------------------------- |
| `normalizePagination(q?)`       | `(q?: PaginationDto) => PaginationDto` | 硬上限 + 互斥处理          |
| `paginate(items, limit, opts?)` | 见源码                                 | 组装 `PaginationResult<T>` |
| `parseSortString(s)`            | `(s?: string) => SortDto[]`            | 解析 `?sort=a:asc,b:desc`  |

### CorrelationContext（ALS）

| 名称                              | 签名                                    | 作用           |
| --------------------------------- | --------------------------------------- | -------------- |
| `withCorrelationContext(ctx, fn)` | `<T>(ctx, fn: () => T) => T`            | 开启上下文边界 |
| `getCorrelationContext()`         | `() => CorrelationContext \| undefined` | 读上下文       |
| `requireCorrelationContext()`     | `() => CorrelationContext`（无则抛）    | 强读           |
| `generateCorrelationId()`         | `() => CorrelationId`                   | UUID v4        |

### 装饰器

| 装饰器               | 作用                                 | 运行时                |
| -------------------- | ------------------------------------ | --------------------- |
| `@WithCorrelation()` | 标记类/方法需上下文（ESLint / 诊断） | 仅元数据              |
| `@Idempotent(opts?)` | 标记方法幂等                         | `IDEMPOTENT_METADATA` |

#### `@Idempotent` 运行流程（由 apps 的 `IdempotencyInterceptor` 执行）

1. 读 `Idempotency-Key` header（或走 `keyFrom` 自定义函数）
2. `store.get(resultKey)` — 命中 → 回放缓存（短路）
3. miss → `store.setNX(lockKey, ..., lockTtlSec)`：失败抛 `IDEMPOTENCY_IN_FLIGHT`（409）
4. 执行原方法
5. 成功 → `store.set(resultKey, response, ttlSec)` + 释放锁
6. 失败 → 仅释放锁（不缓存错误，下次重试）

**key 校验**：长度 8–128。超出抛 `IDEMPOTENCY_KEY_INVALID`（400）。

#### `runWithIdempotency` — 手动执行

| 参数      | 类型                          | 说明            |
| --------- | ----------------------------- | --------------- |
| `key`     | `string \| undefined`         | Idempotency-Key |
| `options` | `Required<IdempotentOptions>` | TTL 配置        |
| `store`   | `IdempotencyStore`            | 存储后端        |
| `handler` | `() => Promise<T>`            | 原方法          |

#### `IdempotencyStore` 接口

```ts
interface IdempotencyStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
  setNX(key: string, value: string, ttlSec: number): Promise<boolean>;
  del(key: string): Promise<void>;
}
```

**生产环境注入**：`shared-cache` 的 Redis adapter 实现了 `CacheProvider`，它结构兼容 `IdempotencyStore`。

### 模块清单

| 名称                             | 签名                      | 作用                                          |
| -------------------------------- | ------------------------- | --------------------------------------------- |
| `defineModuleManifest(manifest)` | identity 函数，仅类型推导 | 给 AI / gen:crud / 权限 UI / 审计归类提供 SoT |
| `TripodModuleManifest`           | interface                 | 清单结构                                      |
| `StateTransition`                | `{ from, to, requires? }` | 状态机转移                                    |

### API 版本化

| 名称                            | 签名                                                | 作用                              |
| ------------------------------- | --------------------------------------------------- | --------------------------------- |
| `getDeprecationHeaders(info)`   | `(info: DeprecationInfo) => Record<string, string>` | 产 Deprecation/Sunset/Link header |
| `isDeprecatedResponse(headers)` | `(headers) => boolean`                              | 前端 console.warn 用              |

## 使用示例

### Golden path：Controller 返回 envelope

```ts
import { Controller, Get } from '@nestjs/common';
import { ok, paginate, normalizePagination } from '@tripod-stack/shared-contract';

@Controller('orders')
export class OrderController {
  @Get()
  async list(@Query() q: PaginationDto) {
    const { limit, cursor } = normalizePagination(q);
    const rows = await this.orderService.list({ limit: limit + 1, cursor });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    return ok(paginate(items, limit, { getCursor: (o) => o.id }), {
      pagination: { limit, hasMore, nextCursor: hasMore ? rows[limit - 1].id : undefined },
    });
  }
}
```

### 抛业务错误

```ts
import { BusinessException } from '@tripod-stack/shared-contract';
import { ErrorCode } from '@tripod-stack/shared-types';

if (order.status === 'SHIPPED') {
  throw new BusinessException(ErrorCode.RESOURCE_STATE_INVALID, 'Order is already shipped', {
    orderId,
    currentState: order.status,
    attemptedAction: 'cancel',
  });
}
```

### 幂等创建订单

```ts
import { Idempotent } from '@tripod-stack/shared-contract';

@Controller('orders')
export class OrderController {
  @Post()
  @Idempotent({ ttlSec: 3600 })
  async create(@Body() dto: CreateOrderDto) {
    return this.orderService.create(dto);
  }
}

// 客户端
fetch('/api/v1/orders', {
  method: 'POST',
  headers: { 'Idempotency-Key': crypto.randomUUID() },
  body: JSON.stringify(dto),
});
```

### 模块清单

```ts
// apps/server/src/order/order.manifest.ts
import { defineModuleManifest } from '@tripod-stack/shared-contract';

export const orderManifest = defineModuleManifest({
  name: 'order',
  version: '0.1.0',
  permissions: ['order:read:own', 'order:read:all', 'order:write:own'],
  auditEvents: ['order.created', 'order.shipped'],
  transitions: {
    OrderStatus: [
      { from: 'DRAFT', to: 'CONFIRMED' },
      { from: 'CONFIRMED', to: 'SHIPPED' },
    ],
  },
});
```

## 反模式 ❌ vs 正确 ✅

### 1. 不要 throw 裸字符串 / Error

❌

```ts
throw new Error('bad state'); // 无错误码，前端分支判断失效
throw 'forbidden'; // 完全不合法
```

✅

```ts
throw new BusinessException(ErrorCode.RESOURCE_STATE_INVALID, 'bad state');
```

### 2. 不要在业务 service 手动传 correlationId

❌

```ts
async createOrder(dto, correlationId) { ... }     // 每个函数多一个参数，传错/漏传灾难
```

✅

```ts
async createOrder(dto) {
  const { correlationId } = requireCorrelationContext();  // ALS 自动拾取
}
```

### 3. 不要手写分页计算

❌

```ts
const page = q.page || 1;
const limit = Math.min(q.limit || 20, 100); // 复制 hard constraints 到处散
```

✅

```ts
const { limit, page } = normalizePagination(q);
```

### 4. 不要缓存含敏感字段的 idempotent response

⚠ **注意**：`runWithIdempotency` 会 `JSON.stringify(response)` 存缓存。response 里不要带明文 token / 敏感字段（已是 90% 场景 — 但要 review）。

## 相关

- `@tripod-stack/shared-types` — `ErrorCode` / `ApiResult<T>` / `PaginationDto`
- `@tripod-stack/shared-cache` — `CacheProvider` 结构兼容 `IdempotencyStore`
- `@tripod-stack/shared-logger` — 配合 ALS 自动注入 correlationId 到日志
- plan-full `§shared-contract §Idempotency 实现细节`
- plan-full `§shared-contract §API 版本化策略`
- plan-full `§shared-contract §分页/排序/筛选统一 Query 语法`
