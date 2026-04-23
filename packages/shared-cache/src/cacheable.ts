import 'reflect-metadata';

/** `@Cacheable` 元数据 key */
export const CACHEABLE_METADATA = Symbol.for('tripod.shared-cache.cacheable');

export interface CacheableOptions {
  /** cache key namespace，默认用 `<className>:<methodName>` */
  readonly namespace?: string;
  /** TTL 秒数，默认 300（5 分钟） */
  readonly ttlSec?: number;
  /** 从方法参数生成 key 后缀，默认 `JSON.stringify(args)` */
  readonly keyFn?: (args: readonly unknown[]) => string;
}

/**
 * `@Cacheable()` 方法装饰器 —— 方法级结果缓存。
 *
 * 真正的拦截 + 读写 CacheProvider 逻辑由 apps 的 `CacheInterceptor` 执行（它读
 * CACHEABLE_METADATA + 注入 CacheProvider）。本装饰器只放元数据。
 *
 * **注意事项**：
 * - 仅缓存方法 **返回值**，不缓存副作用
 * - key 包含所有参数；含 tenantId 时自动租户隔离
 * - 参数含不可序列化对象（Buffer / File / class instance）时用自定义 `keyFn`
 *
 * @example
 * @Injectable()
 * export class OrderService {
 *   @Cacheable({ ttlSec: 60, namespace: 'order-summary' })
 *   async getSummary(tenantId: TenantId) {
 *     return this.aggregate(tenantId);
 *   }
 * }
 */
export function Cacheable(options: CacheableOptions = {}): MethodDecorator {
  const opts: Required<CacheableOptions> = {
    namespace: options.namespace ?? '',
    ttlSec: options.ttlSec ?? 300,
    keyFn: options.keyFn ?? ((args) => JSON.stringify(args)),
  };
  return (target, propertyKey) => {
    Reflect.defineMetadata(CACHEABLE_METADATA, opts, target, propertyKey);
  };
}

/** 读方法上的 @Cacheable 元数据 */
export function getCacheableOptions(
  target: object,
  propertyKey: string | symbol,
): Required<CacheableOptions> | undefined {
  return Reflect.getMetadata(CACHEABLE_METADATA, target, propertyKey) as
    | Required<CacheableOptions>
    | undefined;
}

/**
 * 生成 cache key：`<namespace>:<keyFn(args)>`。namespace 空时 fallback 到 `<className>:<method>`。
 */
export function buildCacheKey(
  className: string,
  method: string | symbol,
  options: Required<CacheableOptions>,
  args: readonly unknown[],
): string {
  const ns = options.namespace || `${className}:${String(method)}`;
  return `${ns}:${options.keyFn(args)}`;
}
