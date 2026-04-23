import type { CorrelationId, TenantId, UserId } from '../ids/branded.js';

/**
 * CorrelationContext — 请求级上下文。由 shared-logger 的 ALS
 * （AsyncLocalStorage）承载，所有 logger / audit / notification 调用自动拾取。
 *
 * 业务代码**不应**手动传递，直接 `logger.info({}, 'msg')` 即可。
 *
 * 扩展字段：业务可以通过 `Record<string, unknown>` 的 extra 字段附加。
 */
export interface CorrelationContext {
  readonly correlationId: CorrelationId;
  readonly tenantId?: TenantId;
  readonly userId?: UserId;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly spanId?: string;
  readonly sourceIp?: string;
  readonly userAgent?: string;
  readonly extra?: Readonly<Record<string, unknown>>;
}

/** 从 HTTP header name 约定 */
export const CORRELATION_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';
export const TRACE_ID_HEADER = 'traceparent';
