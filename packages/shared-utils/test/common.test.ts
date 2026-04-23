import { describe, expect, it } from 'vitest';

import { chunk, groupBy, isNullish, unique, uniqueBy } from '../src/common/array.js';
import { delay, retry, withTimeout } from '../src/common/async.js';

describe('isNullish', () => {
  it.each([
    [null, true],
    [undefined, true],
    [0, false],
    ['', false],
    [false, false],
    [[], false],
    [{}, false],
  ])('isNullish(%p) = %p', (input, expected) => {
    expect(isNullish(input)).toBe(expected);
  });
});

describe('unique', () => {
  it('去重保持顺序', () => {
    expect(unique([1, 2, 1, 3, 2])).toEqual([1, 2, 3]);
  });

  it('空数组', () => {
    expect(unique([])).toEqual([]);
  });
});

describe('uniqueBy', () => {
  it('按 key 去重，保留首次', () => {
    const input = [
      { id: 1, x: 'a' },
      { id: 1, x: 'b' },
      { id: 2, x: 'c' },
    ];
    expect(uniqueBy(input, (o) => o.id)).toEqual([
      { id: 1, x: 'a' },
      { id: 2, x: 'c' },
    ]);
  });
});

describe('chunk', () => {
  it('均分', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('size 大于数组长度', () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });

  it('size <= 0 抛错', () => {
    expect(() => chunk([1, 2], 0)).toThrow('chunk size must be > 0');
    expect(() => chunk([1, 2], -1)).toThrow('chunk size must be > 0');
  });
});

describe('groupBy', () => {
  it('按 key 分组', () => {
    const result = groupBy(
      [
        { type: 'a', v: 1 },
        { type: 'b', v: 2 },
        { type: 'a', v: 3 },
      ],
      (o) => o.type,
    );
    expect(result.get('a')).toEqual([
      { type: 'a', v: 1 },
      { type: 'a', v: 3 },
    ]);
    expect(result.get('b')).toEqual([{ type: 'b', v: 2 }]);
  });
});

describe('delay', () => {
  it('等待至少 50ms', async () => {
    const start = Date.now();
    await delay(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40); // 允许少量误差
  });
});

describe('withTimeout', () => {
  it('完成快于超时：返回结果', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000);
    expect(result).toBe('ok');
  });

  it('超时：抛 TimeoutError', async () => {
    const slow = new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
    await expect(withTimeout(slow, 50)).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});

describe('retry', () => {
  it('首次成功', async () => {
    let count = 0;
    const result = await retry(async () => {
      count++;
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(count).toBe(1);
  });

  it('前两次失败，第三次成功', async () => {
    let count = 0;
    const result = await retry(
      async () => {
        count++;
        if (count < 3) throw new Error('fail');
        return 'ok';
      },
      { attempts: 3, baseMs: 1 },
    );
    expect(result).toBe('ok');
    expect(count).toBe(3);
  });

  it('全部失败，抛最后一次的错', async () => {
    let count = 0;
    await expect(
      retry(
        async () => {
          count++;
          throw new Error(`fail ${String(count)}`);
        },
        { attempts: 2, baseMs: 1 },
      ),
    ).rejects.toThrow('fail 2');
    expect(count).toBe(2);
  });

  it('shouldRetry=false 时立即停止', async () => {
    let count = 0;
    await expect(
      retry(
        async () => {
          count++;
          throw new Error('fatal');
        },
        { attempts: 5, baseMs: 1, shouldRetry: () => false },
      ),
    ).rejects.toThrow('fatal');
    expect(count).toBe(1);
  });
});
