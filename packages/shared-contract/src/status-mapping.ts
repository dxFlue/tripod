import { ErrorCode } from '@tripod-stack/shared-types';

/**
 * 错误码 → HTTP status 映射。
 * 未列出的 code 默认 500。业务扩展 code 时若需要非 500 自行注册（`registerStatusMapping()`）。
 */
const DEFAULT_MAPPING: Readonly<Record<string, number>> = Object.freeze({
  // 400 Bad Request
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.VALIDATION_MISSING_FIELD]: 400,
  [ErrorCode.VALIDATION_INVALID_FORMAT]: 400,
  [ErrorCode.IDEMPOTENCY_KEY_INVALID]: 400,

  // 401 Unauthorized（前端自动触发退登）
  [ErrorCode.AUTH_UNAUTHENTICATED]: 401,
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 401,
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 401,
  [ErrorCode.AUTH_TOKEN_INVALID]: 401,
  [ErrorCode.AUTH_TOKEN_REVOKED]: 401,
  [ErrorCode.AUTH_OTP_EXPIRED]: 401,
  [ErrorCode.AUTH_OTP_INVALID]: 401,
  [ErrorCode.AUTH_SESSION_INVALID]: 401,
  [ErrorCode.AUTH_MAGIC_LINK_EXPIRED]: 401,
  [ErrorCode.AUTH_MAGIC_LINK_INVALID]: 401,

  // 403 Forbidden
  [ErrorCode.PERMISSION_DENIED]: 403,
  [ErrorCode.PERMISSION_SCOPE_INSUFFICIENT]: 403,
  [ErrorCode.TENANT_SUSPENDED]: 403,
  [ErrorCode.TENANT_INACTIVE]: 403,
  [ErrorCode.TENANT_ISOLATION_VIOLATION]: 403,
  [ErrorCode.AUTH_ACCOUNT_LOCKED]: 403,
  [ErrorCode.AUTH_ACCOUNT_DISABLED]: 403,

  // 404 Not Found
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.TENANT_NOT_FOUND]: 404,

  // 409 Conflict
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.DUPLICATE_KEY]: 409,
  [ErrorCode.RESOURCE_LOCKED]: 409,
  [ErrorCode.RESOURCE_STATE_INVALID]: 409,
  [ErrorCode.IDEMPOTENCY_IN_FLIGHT]: 409,

  // 429 Too Many Requests
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.AUTH_OTP_RATE_LIMITED]: 429,
  [ErrorCode.TENANT_QUOTA_EXCEEDED]: 429,

  // 500 / 503 SYSTEM
  [ErrorCode.SYSTEM_UNKNOWN]: 500,
  [ErrorCode.SYSTEM_INTERNAL_ERROR]: 500,
  [ErrorCode.SYSTEM_CONFIG_INVALID]: 500,
  [ErrorCode.SYSTEM_MAINTENANCE]: 503,
  [ErrorCode.SYSTEM_DB_CONNECTION_FAILED]: 503,
  [ErrorCode.SYSTEM_REDIS_CONNECTION_FAILED]: 503,
  [ErrorCode.SYSTEM_DEPENDENCY_TIMEOUT]: 504,

  // QUEUE
  [ErrorCode.QUEUE_JOB_FAILED]: 500,
  [ErrorCode.QUEUE_JOB_TIMEOUT]: 504,
  [ErrorCode.QUEUE_DEAD_LETTER]: 500,
});

const customMapping = new Map<string, number>();

/**
 * 拿错误码对应的 HTTP status。未配置返回 500（SYSTEM_INTERNAL_ERROR 的默认值）。
 */
export function getHttpStatus(code: ErrorCode | string): number {
  return customMapping.get(code) ?? DEFAULT_MAPPING[code] ?? 500;
}

/**
 * 注册业务自定义 code → HTTP status 映射。重复注册以最后一次为准。
 *
 * @example
 * // 业务扩展 code
 * registerStatusMapping('ORDER_CANNOT_CANCEL_AFTER_SHIPPED', 409);
 * registerStatusMapping('PAYMENT_GATEWAY_TIMEOUT', 504);
 */
export function registerStatusMapping(code: string, httpStatus: number): void {
  if (httpStatus < 100 || httpStatus > 599) {
    throw new RangeError(`Invalid HTTP status: ${String(httpStatus)}`);
  }
  customMapping.set(code, httpStatus);
}

/**
 * 清空自定义映射（仅测试用）。
 *
 * @internal
 */
export function _clearStatusMapping(): void {
  customMapping.clear();
}

/**
 * 拿默认映射表的副本（诊断 / 文档生成用）。
 */
export function getDefaultMapping(): Readonly<Record<string, number>> {
  return DEFAULT_MAPPING;
}
