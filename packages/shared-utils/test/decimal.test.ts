import { describe, expect, it } from 'vitest';

import { Decimal, ONE, ZERO, roundHalfUp, sum, toDecimal } from '../src/money/decimal.js';

describe('常量', () => {
  it('ZERO / ONE 是 Decimal 实例', () => {
    expect(ZERO).toBeInstanceOf(Decimal);
    expect(ONE).toBeInstanceOf(Decimal);
    expect(ZERO.toString()).toBe('0');
    expect(ONE.toString()).toBe('1');
  });
});

describe('toDecimal', () => {
  it('number → Decimal（走 toString 避免浮点坑）', () => {
    expect(toDecimal(0.1).plus(toDecimal(0.2)).toString()).toBe('0.3');
  });

  it('string → Decimal', () => {
    expect(toDecimal('99.99').toString()).toBe('99.99');
  });

  it('Decimal 直接返回', () => {
    const d = new Decimal('1.23');
    expect(toDecimal(d)).toBe(d); // 同一引用
  });
});

describe('sum', () => {
  it('混合类型求和', () => {
    expect(sum('1.1', 2.2, new Decimal('3.3')).toString()).toBe('6.6');
  });

  it('空参数返回 0', () => {
    expect(sum().toString()).toBe('0');
  });
});

describe('roundHalfUp', () => {
  it('1.125 → 1.13（四舍五入）', () => {
    expect(roundHalfUp('1.125', 2).toString()).toBe('1.13');
  });

  it('1.124 → 1.12', () => {
    expect(roundHalfUp('1.124', 2).toString()).toBe('1.12');
  });

  it('默认 2 位', () => {
    expect(roundHalfUp('1.155').toString()).toBe('1.16');
  });

  it('4 位（汇率场景）', () => {
    expect(roundHalfUp('1.234567', 4).toString()).toBe('1.2346');
  });
});
