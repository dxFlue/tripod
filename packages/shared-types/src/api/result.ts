import type { ErrorBody } from '../errors/error-body.js';

/**
 * API 响应统一 envelope。
 * 后端 shared-contract 的 ok() / err() 负责产出；前端 shared-api-client 负责解包。
 *
 * 用 discriminated union 强制 `success` 分支判断：
 *
 * @example
 * if (result.success) {
 *   // result.data 可用
 * } else {
 *   // result.error 可用
 * }
 */
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/** 成功响应。`data` 永远是业务期望的数据类型。 */
export interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
  readonly meta?: ApiMeta;
}

/** 失败响应。`error` 永远是 ErrorBody。 */
export interface ApiFailure {
  readonly success: false;
  readonly error: ErrorBody;
}

/** 额外元数据（主要给分页 / 版本化提示用）。 */
export interface ApiMeta {
  readonly correlationId?: string;
  readonly pagination?: PaginationMeta;
  readonly apiVersion?: string;
  readonly deprecation?: {
    readonly deprecated: true;
    readonly sunsetDate?: string;
    readonly message?: string;
  };
}

/** 分页元数据（响应里返回的实际页位置信息）。 */
export interface PaginationMeta {
  readonly page?: number;
  readonly limit: number;
  readonly total?: number;
  readonly hasMore: boolean;
  readonly nextCursor?: string;
}
