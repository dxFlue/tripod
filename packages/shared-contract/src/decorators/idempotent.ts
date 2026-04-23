import 'reflect-metadata';

import { ErrorCode } from '@tripod-stack/shared-types';

import { BusinessException } from '../exceptions.js';

/**
 * `IdempotencyStore` —— @Idempotent() 依赖的后端接口。
 *
 * 结构上与 `CacheProvider`（shared-cache）兼容 —— 生产环境把 shared-cache 的 Redis adapter
 * 注入即可；单元测试用 `InMemoryIdempotencyStore`。
 *
 * **语义**：
 * - `setNX(key, value, ttlSec)` —— key 不存在时 set 并返回 true；已存在返回 false（这是 "锁" 的原语）
 * - `get(key)` —— 拿已完成请求的 response 快照；miss 返回 undefined
 * - `set(key, value, ttlSec)` —— 覆盖写（成功完成时把 response 缓存）
 */
export interface IdempotencyStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
  setNX(key: string, value: string, ttlSec: number): Promise<boolean>;
  del(key: string): Promise<void>;
}

/** @Idempotent 装饰器的元数据 key */
export const IDEMPOTENT_METADATA = Symbol.for('tripod.shared-contract.idempotent');

export interface IdempotentOptions {
  /** 幂等 key 来源：`'header'`（Idempotency-Key header，默认）或业务自提 function */
  readonly keyFrom?: 'header' | ((...args: unknown[]) => string);
  /** 结果缓存 TTL（秒），默认 24h */
  readonly ttlSec?: number;
  /** in-flight 锁 TTL（秒），防死锁；默认 60s */
  readonly lockTtlSec?: number;
}

/**
 * `@Idempotent()` 方法装饰器 —— 标记方法为幂等。
 *
 * 真正的拦截 + 回放逻辑由 apps 的 `IdempotencyInterceptor` 实现（它读 IDEMPOTENT_METADATA
 * + 注入 IdempotencyStore + 拦 request / response）。本装饰器只放元数据。
 *
 * **运行时流程**（由 apps 的 Interceptor 执行）：
 * 1. 读 `Idempotency-Key` header 或走业务 `keyFrom()` 函数
 * 2. 走 `store.get(key)`：命中 → 直接回放缓存的 response（短路）
 * 3. miss → `store.setNX(lockKey, 'in-flight', lockTtlSec)`
 *    - false（别人正在处理）→ 抛 `IDEMPOTENCY_IN_FLIGHT` (HTTP 409)
 *    - true → 继续执行原方法
 * 4. 方法返回 → `store.set(key, JSON(response), ttlSec)` + `store.del(lockKey)`
 * 5. 方法抛错 → `store.del(lockKey)`（不缓存错误响应，下次重试仍从头）
 *
 * **幂等 key 强约束**：
 * - 客户端必须传 `Idempotency-Key` header（UUID v7 或 SHA-256 推荐）
 * - 缺 header 时装饰器抛 `IDEMPOTENCY_KEY_INVALID` (HTTP 400)
 *
 * @example
 * @Controller('orders')
 * export class OrderController {
 *   @Post()
 *   @Idempotent({ ttlSec: 3600 })
 *   async create(@Body() dto: CreateOrderDto) {
 *     return this.orderService.create(dto);
 *   }
 * }
 */
export function Idempotent(options: IdempotentOptions = {}): MethodDecorator {
  const opts: Required<IdempotentOptions> = {
    keyFrom: options.keyFrom ?? 'header',
    ttlSec: options.ttlSec ?? 60 * 60 * 24,
    lockTtlSec: options.lockTtlSec ?? 60,
  };
  return (target, propertyKey) => {
    Reflect.defineMetadata(IDEMPOTENT_METADATA, opts, target, propertyKey);
  };
}

/** 读方法上的 @Idempotent 元数据。没加返回 undefined。 */
export function getIdempotentOptions(
  target: object,
  propertyKey: string | symbol,
): Required<IdempotentOptions> | undefined {
  const opts = Reflect.getMetadata(IDEMPOTENT_METADATA, target, propertyKey) as
    | Required<IdempotentOptions>
    | undefined;
  return opts;
}

/**
 * Idempotency 拦截器主逻辑（apps 的 NestJS interceptor 里调）。
 *
 * 输入 handler 本身和 store，返回包裹后的执行函数。Interceptor 自己负责从 Request 里
 * 拿 Idempotency-Key + 调 `runWithIdempotency()`。
 *
 * @throws {BusinessException} `IDEMPOTENCY_KEY_INVALID` 或 `IDEMPOTENCY_IN_FLIGHT`
 *
 * @example
 * // apps/server/src/interceptors/idempotency.interceptor.ts
 * async intercept(ctx, next) {
 *   const handler = ctx.getHandler();
 *   const opts = getIdempotentOptions(ctx.getClass().prototype, handler.name);
 *   if (!opts) return next.handle();
 *
 *   const req = ctx.switchToHttp().getRequest();
 *   const key = req.header('Idempotency-Key');
 *
 *   const result = await runWithIdempotency(
 *     key,
 *     opts,
 *     this.store,
 *     () => firstValueFrom(next.handle())
 *   );
 *   return of(result);
 * }
 */
export async function runWithIdempotency<T>(
  key: string | undefined,
  options: Required<IdempotentOptions>,
  store: IdempotencyStore,
  handler: () => Promise<T>,
): Promise<T> {
  if (key === undefined || key.length < 8 || key.length > 128) {
    throw new BusinessException(
      ErrorCode.IDEMPOTENCY_KEY_INVALID,
      'Idempotency-Key header is missing or malformed (expected 8–128 chars)',
    );
  }

  const resultKey = `idem:result:${key}`;
  const lockKey = `idem:lock:${key}`;

  // 1. 查已完成结果
  const cached = await store.get(resultKey);
  if (cached !== undefined) {
    return JSON.parse(cached) as T;
  }

  // 2. 抢 in-flight 锁
  const acquired = await store.setNX(lockKey, '1', options.lockTtlSec);
  if (!acquired) {
    throw new BusinessException(
      ErrorCode.IDEMPOTENCY_IN_FLIGHT,
      'A request with the same Idempotency-Key is being processed',
    );
  }

  try {
    const result = await handler();
    await store.set(resultKey, JSON.stringify(result), options.ttlSec);
    return result;
  } finally {
    await store.del(lockKey);
  }
}
