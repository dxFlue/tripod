/**
 * 分页 / 排序 / 筛选 Query DTO。
 *
 * 硬约束（plan-full §shared-contract §分页硬约束）：
 * - `limit` 上限 100（超了后端强制降到 100 + 回 deprecation warning）
 * - `cursor` 和 `page` 二选一，推荐 cursor（大数据集翻页稳定）
 * - `sort` 支持多字段，格式 `field:asc,field2:desc`，后端解析成 SortDto[]
 */

/** 分页请求 DTO（Query string）。页位置用 page 或 cursor 二选一。 */
export interface PaginationDto {
  /** 每页条数，默认 20，上限 100 */
  readonly limit?: number;
  /** 基于页码的分页（1-based），与 cursor 互斥 */
  readonly page?: number;
  /** 基于游标的分页（opaque string），与 page 互斥 */
  readonly cursor?: string;
}

/** 排序 DTO。多字段数组形式。 */
export interface SortDto {
  readonly field: string;
  readonly order: SortOrder;
}

/** 排序方向。 */
export type SortOrder = 'asc' | 'desc';

/** 筛选 DTO。键是字段名，值由业务 schema 解释。 */
export type FilterDto = Readonly<Record<string, FilterValue>>;

/**
 * 筛选值。支持标量、数组、区间。
 * - 标量：`{ status: 'active' }`
 * - 数组（in 语义）：`{ status: ['active', 'pending'] }`
 * - 区间：`{ createdAt: { gte: '2026-01-01', lt: '2026-02-01' } }`
 */
export type FilterValue =
  | string
  | number
  | boolean
  | null
  | readonly (string | number)[]
  | FilterRange;

/** 筛选区间 */
export interface FilterRange {
  readonly gte?: string | number;
  readonly gt?: string | number;
  readonly lte?: string | number;
  readonly lt?: string | number;
}

/**
 * 分页查询返回结果（业务 service 层返回给 controller）。
 * items / hasMore / nextCursor 是 cursor 模式的约定；page 模式下 total + page 有值。
 */
export interface PaginationResult<T> {
  readonly items: readonly T[];
  readonly total?: number;
  readonly hasMore: boolean;
  readonly nextCursor?: string;
  readonly limit: number;
}

/** 分页上限常量 — shared-contract 校验 DTO 用 */
export const MAX_PAGE_LIMIT = 100;
/** 分页默认值 */
export const DEFAULT_PAGE_LIMIT = 20;
