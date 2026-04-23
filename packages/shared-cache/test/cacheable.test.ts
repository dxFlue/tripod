import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { buildCacheKey, Cacheable, getCacheableOptions } from '../src/cacheable.js';

class Svc {
  @Cacheable({ ttlSec: 60, namespace: 'orders' })
  getOrder(_id: string): string {
    return 'x';
  }

  @Cacheable()
  defaults(): void {
    /* noop */
  }

  unmarked(): void {
    /* noop */
  }
}

describe('@Cacheable', () => {
  it('读出自定义选项', () => {
    const opts = getCacheableOptions(Svc.prototype, 'getOrder');
    expect(opts?.ttlSec).toBe(60);
    expect(opts?.namespace).toBe('orders');
  });

  it('默认选项', () => {
    const opts = getCacheableOptions(Svc.prototype, 'defaults');
    expect(opts?.ttlSec).toBe(300);
    expect(opts?.namespace).toBe('');
  });

  it('未标记方法返回 undefined', () => {
    expect(getCacheableOptions(Svc.prototype, 'unmarked')).toBeUndefined();
  });
});

describe('buildCacheKey', () => {
  it('有 namespace', () => {
    const opts = getCacheableOptions(Svc.prototype, 'getOrder');
    expect(opts).toBeDefined();
    const key = buildCacheKey(
      'Svc',
      'getOrder',
      opts as Required<Parameters<typeof buildCacheKey>[2]>,
      ['abc'],
    );
    expect(key).toBe('orders:["abc"]');
  });

  it('无 namespace fallback 到 className:method', () => {
    const opts = getCacheableOptions(Svc.prototype, 'defaults');
    const key = buildCacheKey(
      'Svc',
      'defaults',
      opts as Required<Parameters<typeof buildCacheKey>[2]>,
      [],
    );
    expect(key).toBe('Svc:defaults:[]');
  });
});
