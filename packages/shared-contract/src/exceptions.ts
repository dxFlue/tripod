import { ErrorCode } from '@tripod-stack/shared-types';

/**
 * 业务异常基类。所有 throw 必须是 BusinessException 或其子类 —— 永远不裸 throw string 或 new Error()。
 *
 * 全局 ExceptionFilter 捕 BusinessException 后：
 * 1. 读 code → 查 status-mapping 拿 HTTP status
 * 2. 读 message → 用 i18n 翻译（可被 Accept-Language 覆盖）
 * 3. 读 details → 放 ErrorBody.details
 * 4. 从 ALS 拿 correlationId
 * 5. 产 ErrorBody 包进 err() envelope 返回
 *
 * @example
 * throw new BusinessException(ErrorCode.ORDER_INVALID_STATE, 'Order is already shipped', {
 *   orderId,
 *   currentState: 'SHIPPED',
 *   attemptedAction: 'cancel',
 * });
 */
export class BusinessException extends Error {
  public readonly code: ErrorCode | string;
  public readonly details?: Readonly<Record<string, unknown>> | readonly unknown[];
  public override readonly cause?: unknown;

  constructor(
    code: ErrorCode | string,
    message?: string,
    details?: Readonly<Record<string, unknown>> | readonly unknown[],
    options?: { cause?: unknown },
  ) {
    super(message ?? code);
    this.name = 'BusinessException';
    this.code = code;
    if (details !== undefined) this.details = details;
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

/**
 * Tenant 隔离违规的特例，单独子类便于审计日志分级。
 */
export class TenantIsolationError extends BusinessException {
  constructor(message = 'Cross-tenant access denied', details?: Readonly<Record<string, unknown>>) {
    super(ErrorCode.TENANT_ISOLATION_VIOLATION, message, details);
    this.name = 'TenantIsolationError';
  }
}
