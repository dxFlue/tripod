/**
 * API 版本化策略：URL /api/v1/... /api/v2/... 并存。Controller 在 Route 上声明版本，
 * 老版本接口 deprecated 时响应头带 `Deprecation` + `Sunset` 通知客户端升级。
 *
 * 本模块只提供**响应 header 辅助**；实际路由前缀和版本化由 apps/server 的 Router 负责。
 */

export interface DeprecationInfo {
  /** 是否 deprecated */
  readonly deprecated: true;
  /** 可选：弃用日期（ISO 8601） */
  readonly since?: string;
  /** 计划下线日期（ISO 8601，必填） */
  readonly sunsetDate: string;
  /** 推荐替代路径 */
  readonly replacement?: string;
}

/**
 * 产出 Deprecation + Sunset response header 键值对。
 * NestJS interceptor 或 Route 里设置到 response 上。
 *
 * @example
 * // apps/server/src/order/v1/order.controller.ts
 * @Get()
 * list(@Res() res: Response) {
 *   Object.entries(getDeprecationHeaders({ deprecated: true, sunsetDate: '2027-01-01', replacement: '/api/v2/orders' }))
 *     .forEach(([k, v]) => res.setHeader(k, v));
 *   return res.json(ok(data));
 * }
 */
export function getDeprecationHeaders(info: DeprecationInfo): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {
    // RFC 8594 Deprecation header - "true" or HTTP-date
    Deprecation: info.since !== undefined ? new Date(info.since).toUTCString() : 'true',
    // RFC 8594 Sunset header - HTTP-date
    Sunset: new Date(info.sunsetDate).toUTCString(),
  };
  if (info.replacement !== undefined) {
    headers.Link = `<${info.replacement}>; rel="successor-version"`;
  }
  return headers;
}

/**
 * 判断响应元数据里是否带 deprecation 标记（前端 console.warn 提醒开发者升级用）。
 */
export function isDeprecatedResponse(headers: Readonly<Record<string, string>>): boolean {
  return headers.deprecation !== undefined || headers.Deprecation !== undefined;
}
