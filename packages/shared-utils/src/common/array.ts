/**
 * 判断值是否 null 或 undefined（TS 类型守卫）。
 *
 * @example
 * const items: (T | null)[] = [...];
 * const present = items.filter((x): x is T => !isNullish(x));
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * 数组去重。保留首次出现顺序。
 * Set 的 iteration 保持插入顺序（ES2015+），天然稳定。
 *
 * @example
 * unique([1, 2, 1, 3, 2]) // [1, 2, 3]
 * unique(['a', 'b', 'a']) // ['a', 'b']
 */
export function unique<T>(arr: readonly T[]): T[] {
  return [...new Set(arr)];
}

/**
 * 数组去重（按 key 提取函数）。
 *
 * @example
 * uniqueBy([{ id: 1, x: 'a' }, { id: 1, x: 'b' }, { id: 2, x: 'c' }], (o) => o.id)
 * // [{ id: 1, x: 'a' }, { id: 2, x: 'c' }]
 */
export function uniqueBy<T, K>(arr: readonly T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  const result: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.add(k);
      result.push(item);
    }
  }
  return result;
}

/**
 * 按固定大小分片。常用于批量请求（避免 URL / body 超限）。
 *
 * @param arr - 输入数组
 * @param size - 每块大小（必须 > 0）
 * @throws {Error} `size <= 0` 时
 *
 * @example
 * chunk([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 */
export function chunk<T>(arr: readonly T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk size must be > 0');
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * 按 key 分组。值是每组的元素数组。
 *
 * @example
 * groupBy([{ type: 'a', v: 1 }, { type: 'b', v: 2 }, { type: 'a', v: 3 }], (o) => o.type)
 * // Map { 'a' => [{type:'a',v:1},{type:'a',v:3}], 'b' => [{type:'b',v:2}] }
 */
export function groupBy<T, K>(arr: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const result = new Map<K, T[]>();
  for (const item of arr) {
    const k = key(item);
    const existing = result.get(k);
    if (existing !== undefined) existing.push(item);
    else result.set(k, [item]);
  }
  return result;
}
