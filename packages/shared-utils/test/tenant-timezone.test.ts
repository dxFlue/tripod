import { beforeAll, describe, expect, it } from 'vitest';

import { initDayjs } from '../src/dayjs/init.js';
import {
  dayOf,
  formatTenantDate,
  isSameTenantDay,
  startOfTenantDay,
} from '../src/time/tenant-timezone.js';

beforeAll(() => {
  initDayjs();
});

describe('startOfTenantDay', () => {
  it('上海时区 0 点 = UTC 前一天 16:00', () => {
    const start = startOfTenantDay('Asia/Shanghai', '2026-04-22T03:00:00Z');
    // 上海 2026-04-22 00:00 = UTC 2026-04-21 16:00
    expect(start.toISOString()).toBe('2026-04-21T16:00:00.000Z');
  });

  it('东京时区 0 点 = UTC 前一天 15:00', () => {
    const start = startOfTenantDay('Asia/Tokyo', '2026-04-22T10:00:00Z');
    expect(start.toISOString()).toBe('2026-04-21T15:00:00.000Z');
  });
});

describe('dayOf', () => {
  it('UTC 23:00 在上海已经是次日', () => {
    // UTC 2026-04-22 23:00 = 上海 2026-04-23 07:00
    expect(dayOf('Asia/Shanghai', '2026-04-22T23:00:00Z')).toBe(23);
  });

  it('UTC 00:00 在上海是同日 08:00', () => {
    expect(dayOf('Asia/Shanghai', '2026-04-22T00:00:00Z')).toBe(22);
  });
});

describe('formatTenantDate', () => {
  it('按默认格式输出 tenant 本地时间', () => {
    const result = formatTenantDate('Asia/Shanghai', '2026-04-22T00:00:00Z');
    expect(result).toBe('2026-04-22 08:00:00');
  });

  it('自定义格式', () => {
    const result = formatTenantDate('UTC', '2026-04-22T00:00:00Z', 'YYYY/MM/DD');
    expect(result).toBe('2026/04/22');
  });
});

describe('isSameTenantDay', () => {
  it('上海时区同一天的跨 UTC 零点判定', () => {
    // UTC 2026-04-21 17:00 和 2026-04-22 15:00 → 上海都是 2026-04-22
    expect(isSameTenantDay('Asia/Shanghai', '2026-04-21T17:00:00Z', '2026-04-22T15:00:00Z')).toBe(
      true,
    );
  });

  it('不同天', () => {
    expect(isSameTenantDay('Asia/Shanghai', '2026-04-21T15:00:00Z', '2026-04-22T15:00:00Z')).toBe(
      false,
    );
  });
});
