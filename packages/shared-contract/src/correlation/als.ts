import { AsyncLocalStorage } from 'node:async_hooks';

import {
  asCorrelationId,
  type CorrelationContext,
  type CorrelationId,
} from '@tripod-stack/shared-types';

/**
 * 进程级 ALS（AsyncLocalStorage），承载请求上下文。
 * 业务 service 通过 `getCorrelationContext()` 即时拿到当前请求的 tenantId / userId / correlationId，
 * 无需沿调用链手动传。
 *
 * **生命周期约束**：
 * - 仅在 Nest HTTP Interceptor / BullMQ worker / scheduler 任务**边界**开启
 * - 业务代码不应手动 `run()`
 * - 测试可用 `withCorrelationContext()` 包 setup
 */
const storage = new AsyncLocalStorage<CorrelationContext>();

/**
 * 在给定上下文里运行 fn（同步或异步）。HTTP Interceptor 使用。
 *
 * @example
 * // Nest interceptor
 * intercept(ctx, next) {
 *   const correlationContext = buildContextFromRequest(ctx.switchToHttp().getRequest());
 *   return withCorrelationContext(correlationContext, () => next.handle());
 * }
 */
export function withCorrelationContext<T>(context: CorrelationContext, fn: () => T): T {
  return storage.run(context, fn);
}

/**
 * 拿当前请求的上下文。边界外（没 run 过）返回 undefined。
 */
export function getCorrelationContext(): CorrelationContext | undefined {
  return storage.getStore();
}

/**
 * 强制拿上下文，缺失时抛错。业务确信在请求边界里可以用这个。
 *
 * @throws {Error} 不在边界内（常见：直接 node 脚本里调业务 service）
 */
export function requireCorrelationContext(): CorrelationContext {
  const ctx = storage.getStore();
  if (ctx === undefined) {
    throw new Error(
      'No CorrelationContext found. Make sure this code runs inside a request scope (HTTP / queue worker / scheduler job).',
    );
  }
  return ctx;
}

/**
 * 生成 UUID v4 作为 CorrelationId。边界启动时用（HTTP header 缺 x-correlation-id 时自动产）。
 */
export function generateCorrelationId(): CorrelationId {
  return asCorrelationId(crypto.randomUUID());
}
