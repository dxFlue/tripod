import { ErrorCode } from '@tripod-stack/shared-types';
import { z } from 'zod';

/**
 * `EnvValidationError` —— 启动期 env 校验失败抛的错误。
 *
 * 消费方约定：
 * - apps 的 main.ts 应 `catch` 并打印 `formatIssues()` 到 stderr，然后 process.exit(1)
 * - 测试时用 `err.issues` 断言具体问题字段
 */
export class EnvValidationError extends Error {
  public readonly code = ErrorCode.SYSTEM_CONFIG_INVALID;
  public readonly issues: readonly z.ZodIssue[];

  constructor(issues: readonly z.ZodIssue[]) {
    super(`Env validation failed with ${String(issues.length)} issue(s)`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }

  /**
   * 人肉可读的问题列表（每行一条）。适合直接 `console.error(err.formatIssues())`。
   */
  public formatIssues(): string {
    return this.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
  }
}

/**
 * 加载 + 校验 env。
 *
 * @param schema - Zod schema（通常是 `baseEnvSchema` 或用 `mergeSchemas()` 拼接的业务 schema）
 * @param source - env 源，默认 `process.env`。测试时可传 fixture
 * @returns schema 推断的类型安全 env 对象（含 coerce / default 后的最终值）
 * @throws {EnvValidationError} env 不合 schema 时
 *
 * @example
 * // apps/server/src/main.ts
 * import { baseEnvSchema, loadEnv, EnvValidationError } from '@tripod-stack/shared-config';
 *
 * try {
 *   const env = loadEnv(baseEnvSchema);
 *   // env.DATABASE_URL, env.JWT_SECRET 等都有类型安全
 * } catch (err) {
 *   if (err instanceof EnvValidationError) {
 *     console.error('Env validation failed:\n' + err.formatIssues());
 *     process.exit(1);
 *   }
 *   throw err;
 * }
 */
export function loadEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  try {
    // zod v3 的 parse() 在严格泛型上下文中返回 any；运行时已由 schema 校验保证合法。
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return schema.parse(source);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new EnvValidationError(err.issues);
    }
    throw err;
  }
}

/**
 * 合并两个 Zod object schema。保留各自字段，重名时后者覆盖前者。
 *
 * @example
 * import { z } from 'zod';
 * import { baseEnvSchema, mergeSchemas } from '@tripod-stack/shared-config';
 *
 * const appSchema = z.object({
 *   STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
 *   FEATURE_X_ENABLED: z.coerce.boolean().default(false),
 * });
 *
 * const fullSchema = mergeSchemas(baseEnvSchema, appSchema);
 * const env = loadEnv(fullSchema);
 */
export function mergeSchemas<
  A extends z.ZodObject<z.ZodRawShape>,
  B extends z.ZodObject<z.ZodRawShape>,
>(a: A, b: B): z.ZodObject<A['shape'] & B['shape']> {
  return a.merge(b) as z.ZodObject<A['shape'] & B['shape']>;
}
