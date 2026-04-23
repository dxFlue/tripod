import type { ApiFailure, ApiMeta, ApiSuccess, ErrorBody } from '@tripod-stack/shared-types';

/**
 * 产出成功响应 envelope。Controller 里业务 service 返回的 data 包一层。
 *
 * @param data - 业务数据（随便什么形状）
 * @param meta - 可选元数据（分页 / API 版本 / deprecation）
 *
 * @example
 * return ok(await this.orderService.list());
 * return ok(result, { pagination: { limit: 20, hasMore: true, nextCursor: '...' } });
 */
export function ok<T>(data: T, meta?: ApiMeta): ApiSuccess<T> {
  const result: ApiSuccess<T> =
    meta !== undefined ? { success: true, data, meta } : { success: true, data };
  return result;
}

/**
 * 产出失败响应 envelope。**通常不直接用** —— 由全局 Exception filter 捕 BusinessException 后自动产出。
 * 仅特殊场景（如 GraphQL resolver / custom guard 手动返回）才直接用。
 *
 * @param error - ErrorBody（含 code / message / correlationId / timestamp 等）
 */
export function err(error: ErrorBody): ApiFailure {
  return { success: false, error };
}

/**
 * 判断 ApiResult 是否成功（类型守卫）。前端 / 测试用。
 *
 * @example
 * if (isApiSuccess(result)) {
 *   // result.data 可用
 * } else {
 *   // result.error 可用
 * }
 */
export function isApiSuccess<T>(result: ApiSuccess<T> | ApiFailure): result is ApiSuccess<T> {
  return result.success;
}
