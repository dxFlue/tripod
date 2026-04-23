import { describe, expect, it } from 'vitest';

import { parseOrigins } from '../src/security-setup.js';

describe('parseOrigins', () => {
  it('undefined → 空数组', () => {
    expect(parseOrigins(undefined)).toEqual([]);
  });

  it('数组直接返回', () => {
    expect(parseOrigins(['http://a', 'http://b'])).toEqual(['http://a', 'http://b']);
  });

  it('逗号分隔字符串', () => {
    expect(parseOrigins('http://a , http://b,http://c')).toEqual([
      'http://a',
      'http://b',
      'http://c',
    ]);
  });

  it('"*" 返回 true', () => {
    expect(parseOrigins('*')).toBe(true);
  });

  it('空串 → 空数组', () => {
    expect(parseOrigins('')).toEqual([]);
  });

  it('过滤空段', () => {
    expect(parseOrigins('a,,b,')).toEqual(['a', 'b']);
  });
});
