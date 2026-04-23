/**
 * Pino 级别统一定义。前后端共享，避免 string 硬编码。
 */
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * 数字优先级（用于跨日志系统兼容）。Pino 自带这套，重复声明以便前端静态引用。
 */
export const LOG_LEVEL_VALUES: Readonly<Record<LogLevel, number>> = Object.freeze({
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
});

export function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}
