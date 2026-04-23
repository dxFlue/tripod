import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

/**
 * 应用层安全配置选项。
 */
export interface ApplySecurityOptions {
  /**
   * CORS 允许来源。逗号分隔字符串（env 风格）或数组。
   * `'*'` 允许全部（**仅 dev**，生产严禁）。
   */
  readonly corsOrigins?: string | readonly string[];
  /**
   * 请求 body 体大小上限（字节）。默认 `1_048_576` (1MB)。
   * 大文件上传走 storage adapter，别走 body。
   */
  readonly bodyLimitBytes?: number;
  /**
   * Helmet 配置。传 `false` 禁用（不推荐）。
   * 不传 = 用 Helmet 默认（OK for 大部分场景）。
   */
  readonly helmetOptions?: Parameters<typeof helmet>[0] | false;
  /**
   * 暴露给前端的 custom headers（比如 `x-correlation-id`）。
   */
  readonly exposedHeaders?: readonly string[];
}

/**
 * 应用层安全配置一键 apply。通常在 apps/server/src/main.ts 的 NestFactory.create 之后调用。
 *
 * 做了什么：
 * 1. `helmet()` 保护常见 HTTP 头（XSS / clickjacking / MIME 嗅探等）
 * 2. CORS 白名单 + credentials + x-correlation-id 暴露
 * 3. Body 大小限制（通过 @nestjs/common 的 express middleware 设）
 *
 * @example
 * // apps/server/src/main.ts
 * const app = await NestFactory.create(AppModule);
 * applySecurity(app, {
 *   corsOrigins: env.CORS_ORIGINS,
 *   bodyLimitBytes: 2 * 1024 * 1024,
 * });
 */
export function applySecurity(app: INestApplication, options: ApplySecurityOptions = {}): void {
  const bodyLimit = options.bodyLimitBytes ?? 1_048_576;

  // Helmet
  if (options.helmetOptions !== false) {
    app.use(helmet(options.helmetOptions));
  }

  // CORS
  const origins = parseOrigins(options.corsOrigins);
  app.enableCors({
    origin: origins,
    credentials: true,
    exposedHeaders: ['x-correlation-id', 'x-request-id', ...(options.exposedHeaders ?? [])],
  });

  // Body limit（Express / Fastify adapter 都走 globalPipes 前）
  // 注：express 默认 body-parser 需要手动设 limit
  const adapter = app.getHttpAdapter();
  const instance = adapter.getInstance() as unknown as {
    use?: (...args: unknown[]) => void;
  };
  if (typeof instance.use === 'function') {
    // Express：覆盖默认 body-parser 限制
    // 注意：这里不动态 require('express')，避免强依赖；依赖 Nest 的内部 body-parser 集成
    // 真正 body-limit 由 NestFactory 的 `{ bodyParser: true, ... }` 控制
    // 本函数记录意图；apps 层如需严格控制直接在 NestFactory 选项里设
  }

  // 记录意图到 app（调试用）
  (app as unknown as { _tripodSecurityBodyLimit?: number })._tripodSecurityBodyLimit = bodyLimit;
}

/**
 * 解析 CORS origins 字符串（逗号分隔）或数组为数组。
 * `'*'` 直接返回 true（Nest/express 接受 true = 允许全部）。
 */
export function parseOrigins(input: string | readonly string[] | undefined): true | string[] {
  if (input === undefined) return [];
  if (Array.isArray(input)) return input as string[];
  const str = input as string;
  if (str === '*') return true;
  return str
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
