import { afterEach, describe, expect, it } from 'vitest';

import { _resetDayjsInit, initDayjs, isDayjsInitialized } from '../src/dayjs/init.js';

describe('initDayjs', () => {
  afterEach(() => {
    _resetDayjsInit();
  });

  it('初始化后 isDayjsInitialized 返回 true', () => {
    expect(isDayjsInitialized()).toBe(false);
    initDayjs();
    expect(isDayjsInitialized()).toBe(true);
  });

  it('重复调用幂等，不抛错', () => {
    expect(() => {
      initDayjs();
      initDayjs();
      initDayjs();
    }).not.toThrow();
  });
});
