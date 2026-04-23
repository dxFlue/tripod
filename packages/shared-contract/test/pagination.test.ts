import { describe, expect, it } from 'vitest';

import { normalizePagination, paginate, parseSortString } from '../src/pagination.js';

describe('normalizePagination', () => {
  it('空入参：走默认 limit=20', () => {
    expect(normalizePagination()).toEqual({ limit: 20 });
    expect(normalizePagination({})).toEqual({ limit: 20 });
  });

  it('limit 上限截断到 100', () => {
    expect(normalizePagination({ limit: 500 })).toEqual({ limit: 100 });
  });

  it('cursor 优先，page 被丢', () => {
    expect(normalizePagination({ limit: 30, page: 5, cursor: 'x' })).toEqual({
      limit: 30,
      cursor: 'x',
    });
  });

  it('只有 page', () => {
    expect(normalizePagination({ page: 3 })).toEqual({ limit: 20, page: 3 });
  });

  it('limit / page 非正：抛 RangeError', () => {
    expect(() => normalizePagination({ limit: 0 })).toThrow(RangeError);
    expect(() => normalizePagination({ limit: -5 })).toThrow(RangeError);
    expect(() => normalizePagination({ page: 0 })).toThrow(RangeError);
  });
});

describe('paginate', () => {
  it('hasMore=false 当 items 少于 limit', () => {
    const r = paginate([1, 2], 20);
    expect(r.items).toEqual([1, 2]);
    expect(r.hasMore).toBe(false);
    expect(r.limit).toBe(20);
    expect(r.nextCursor).toBeUndefined();
  });

  it('hasMore=true 当 items >= limit', () => {
    const r = paginate([1, 2, 3], 3);
    expect(r.hasMore).toBe(true);
  });

  it('getCursor 在 hasMore 时产出 nextCursor', () => {
    const r = paginate([{ id: '1' }, { id: '2' }], 2, {
      getCursor: (o) => o.id,
    });
    expect(r.nextCursor).toBe('2');
  });

  it('total 被透传', () => {
    const r = paginate([1], 20, { total: 42 });
    expect(r.total).toBe(42);
  });
});

describe('parseSortString', () => {
  it('解析单字段', () => {
    expect(parseSortString('field:desc')).toEqual([{ field: 'field', order: 'desc' }]);
  });

  it('解析多字段', () => {
    expect(parseSortString('a:asc,b:desc')).toEqual([
      { field: 'a', order: 'asc' },
      { field: 'b', order: 'desc' },
    ]);
  });

  it('省略 order 默认 asc', () => {
    expect(parseSortString('field')).toEqual([{ field: 'field', order: 'asc' }]);
  });

  it('空串返回空数组', () => {
    expect(parseSortString('')).toEqual([]);
    expect(parseSortString(undefined)).toEqual([]);
  });

  it('跳过非法 order', () => {
    expect(parseSortString('a:wrong,b:desc')).toEqual([{ field: 'b', order: 'desc' }]);
  });
});
