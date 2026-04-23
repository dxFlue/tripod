import 'reflect-metadata';

/**
 * 元数据 key —— 标记类 / 方法必须在 CorrelationContext 内执行。
 */
export const WITH_CORRELATION_METADATA = Symbol.for('tripod.shared-contract.with-correlation');

/**
 * `@WithCorrelation()` 装饰器 —— 标记此处逻辑需要上下文（仅是元数据标记）。
 * 真正的上下文开启由 Nest HTTP Interceptor / BullMQ 消费者包装器负责。
 *
 * 本装饰器配合自定义 ESLint 规则或运行时守卫使用：
 * - 运行时守卫：业务 service 里调 `requireCorrelationContext()` 会在无上下文时抛错
 * - ESLint 扩展：后续版本提供 `tripod/require-correlation-decorator` 规则（默认关闭）
 *
 * @example
 * @WithCorrelation()
 * @Injectable()
 * export class OrderService {
 *   async create(...) {
 *     const ctx = requireCorrelationContext();
 *     // ...
 *   }
 * }
 */
export function WithCorrelation(): ClassDecorator & MethodDecorator {
  return ((target: object, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) => {
    if (propertyKey !== undefined) {
      // 方法装饰
      Reflect.defineMetadata(WITH_CORRELATION_METADATA, true, target, propertyKey);
    } else {
      // 类装饰
      Reflect.defineMetadata(WITH_CORRELATION_METADATA, true, target);
    }
  }) as ClassDecorator & MethodDecorator;
}

/**
 * 检查类 / 方法是否带 @WithCorrelation 标记。
 */
export function hasWithCorrelation(target: object, propertyKey?: string | symbol): boolean {
  if (propertyKey !== undefined) {
    return Reflect.getMetadata(WITH_CORRELATION_METADATA, target, propertyKey) === true;
  }
  return Reflect.getMetadata(WITH_CORRELATION_METADATA, target) === true;
}
