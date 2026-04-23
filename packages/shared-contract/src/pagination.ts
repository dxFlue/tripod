import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  type PaginationDto,
  type PaginationResult,
  type SortDto,
  type SortOrder,
} from '@tripod-stack/shared-types';

/**
 * 标准化分页 query。处理硬约束：
 * - 无 limit → 走 DEFAULT_PAGE_LIMIT（20）
 * - limit > MAX_PAGE_LIMIT（100）→ 强制降到 100
 * - page 和 cursor 互斥（同时传：以 cursor 为准，page 丢弃）
 * - limit / page 为非正数：抛 RangeError
 *
 * @returns 标准化后的 PaginationDto（字段齐全，limit 一定有值）
 *
 * @example
 * normalizePagination({ limit: 150 })    // { limit: 100 }（硬上限截断）
 * normalizePagination({ limit: 20, page: 3 })
 * normalizePagination({ cursor: 'xxx', page: 5 })  // { limit: 20, cursor: 'xxx' } page 被丢
 */
export function normalizePagination(
  q: PaginationDto = {},
): Required<Pick<PaginationDto, 'limit'>> & PaginationDto {
  if (q.limit !== undefined && q.limit <= 0) {
    throw new RangeError(`limit must be positive, got ${String(q.limit)}`);
  }
  if (q.page !== undefined && q.page <= 0) {
    throw new RangeError(`page must be positive, got ${String(q.page)}`);
  }

  const limit = Math.min(q.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  if (q.cursor !== undefined && q.cursor !== '') {
    return { limit, cursor: q.cursor };
  }
  if (q.page !== undefined) {
    return { limit, page: q.page };
  }
  return { limit };
}

/**
 * 组装 service 层返回的 PaginationResult。
 *
 * @param items - 本页 items（长度可能是 limit + 1 用于探测 hasMore）
 * @param limit - 业务希望返回的条数上限
 * @param opts.total - 可选：总数（cursor 模式通常不算；page 模式才带）
 * @param opts.getCursor - 可选：从最后一条 item 提取 nextCursor 的函数
 *
 * @example
 * // cursor 分页：多查一条判断 hasMore
 * const rows = await prisma.order.findMany({ take: limit + 1, cursor: ... });
 * const hasMore = rows.length > limit;
 * const items = rows.slice(0, limit);
 * return paginate(items, limit, { getCursor: (o) => o.id });
 */
export function paginate<T>(
  items: readonly T[],
  limit: number,
  opts: {
    readonly total?: number;
    readonly getCursor?: (item: T) => string;
  } = {},
): PaginationResult<T> {
  const hasMore = items.length >= limit;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && opts.getCursor !== undefined && last !== undefined
      ? opts.getCursor(last)
      : undefined;

  const result: PaginationResult<T> = {
    items,
    hasMore,
    limit,
    ...(opts.total !== undefined ? { total: opts.total } : {}),
    ...(nextCursor !== undefined ? { nextCursor } : {}),
  };
  return result;
}

/**
 * 解析 `?sort=field1:asc,field2:desc` 字符串为 SortDto 数组。
 * 非法段静默跳过（不抛错，避免因客户端手误影响主流程）。
 *
 * @example
 * parseSortString('createdAt:desc,priority:asc')
 * // [{ field: 'createdAt', order: 'desc' }, { field: 'priority', order: 'asc' }]
 *
 * parseSortString('createdAt')          // [{ field: 'createdAt', order: 'asc' }]（默认 asc）
 * parseSortString('')                    // []
 * parseSortString('a:wrong,b:desc')     // [{ field: 'b', order: 'desc' }]（wrong 被跳）
 */
export function parseSortString(sort: string | undefined): SortDto[] {
  if (sort === undefined || sort === '') return [];
  const parsed: SortDto[] = [];
  for (const raw of sort.split(',')) {
    const segment = raw.trim();
    if (segment.length === 0) continue;
    const [fieldRaw, orderRaw] = segment.split(':').map((x) => x.trim());
    if (fieldRaw === undefined || fieldRaw.length === 0) continue;
    let order: SortOrder;
    if (orderRaw === 'desc') order = 'desc';
    else if (orderRaw === 'asc' || orderRaw === undefined) order = 'asc';
    else continue;
    parsed.push({ field: fieldRaw, order });
  }
  return parsed;
}
