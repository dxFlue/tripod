import { getCorrelationContext } from '@tripod-stack/shared-contract';
import { pino, stdTimeFunctions, type Logger, type LoggerOptions } from 'pino';

import type { LogLevel } from '../shared/log-level.js';
import { DEFAULT_REDACT_PATHS } from '../shared/redact-rules.js';

export interface CreateLoggerOptions {
  /** 日志级别；默认读 env `LOG_LEVEL` 或 'info'。 */
  readonly level?: LogLevel;
  /** 是否开启 pretty（本地开发）。默认根据 `NODE_ENV !== 'production'`。 */
  readonly pretty?: boolean;
  /** app 名；附在每条日志上便于跨服务聚合时区分来源。 */
  readonly appName?: string;
  /** 额外 redact 路径；会和默认规则合并去重。 */
  readonly additionalRedactPaths?: readonly string[];
  /**
   * 自动从 shared-contract 的 ALS CorrelationContext 注入 correlationId / tenantId / userId
   * 到每条日志。默认 `true`。
   */
  readonly correlationAware?: boolean;
  /** 已有 pino options，直接透传（高级用法）。 */
  readonly extraOptions?: LoggerOptions;
}

/**
 * 创建 Pino logger。自带 redaction + ALS CorrelationContext 自动注入。
 *
 * **约定**：
 * - 业务写日志的第一参数是结构化对象，第二参数是短动词 message
 *   - ✓ `logger.info({ orderId }, 'order created')`
 *   - ✗ `logger.info(\`order \${orderId} created\`)`
 * - 不要 `console.log` —— `no-console` ESLint 规则拦
 * - `correlationAware: true`（默认）时 ALS 有上下文自动拾取；无上下文时跳过，不崩
 *
 * @example
 * const logger = createLogger({ appName: 'tripod-server' });
 * withCorrelationContext({ correlationId: 'x', tenantId: 't-1' }, () => {
 *   logger.info({ orderId }, 'order created');
 *   // 输出自动带 correlationId + tenantId
 * });
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const level = options.level ?? (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';
  const pretty = options.pretty ?? process.env.NODE_ENV !== 'production';
  const appName = options.appName;
  const correlationAware = options.correlationAware ?? true;

  const mergedRedactPaths = [
    ...new Set([...DEFAULT_REDACT_PATHS, ...(options.additionalRedactPaths ?? [])]),
  ];

  const mixin: LoggerOptions['mixin'] = correlationAware
    ? () => {
        const ctx = getCorrelationContext();
        if (ctx === undefined) return {};
        const mixed: Record<string, unknown> = { correlationId: ctx.correlationId };
        if (ctx.tenantId !== undefined) mixed.tenantId = ctx.tenantId;
        if (ctx.userId !== undefined) mixed.userId = ctx.userId;
        if (ctx.requestId !== undefined) mixed.requestId = ctx.requestId;
        if (ctx.traceId !== undefined) mixed.traceId = ctx.traceId;
        return mixed;
      }
    : undefined;

  const pinoOptions: LoggerOptions = {
    level,
    redact: {
      paths: mergedRedactPaths,
      censor: '[Redacted]',
    },
    base: appName !== undefined ? { app: appName } : null,
    timestamp: stdTimeFunctions.isoTime,
    ...(mixin !== undefined ? { mixin } : {}),
    ...options.extraOptions,
  };

  if (pretty) {
    pinoOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    };
  }

  return pino(pinoOptions);
}
