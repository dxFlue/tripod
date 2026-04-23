import dayjs, { type Dayjs } from 'dayjs';

/**
 * Tenant 时区相关 helper。
 *
 * 背景：tripod 多租户场景下，每个 tenant 有自己的 `timezone` 字段（IANA 时区名，
 * 如 `Asia/Shanghai`）。所有和"今天/昨天/某月第几天"相关的业务逻辑必须走 tenant
 * 时区，不能用 server 本地时区（server 通常 UTC 或运维决定）。
 *
 * **前置条件**：调用这些函数前必须 `initDayjs()`。否则 `dayjs().tz()` 会抛
 * "dayjs(...) .tz is not a function"。
 */

/**
 * 获取 tenant 时区下"今天 0 点"的 Dayjs 对象。
 * 常见用法：按 tenant 当地日分析日报。
 *
 * @param tenantTimezone - IANA 时区，如 `'Asia/Shanghai'`
 * @param base - 参考时刻，默认 `dayjs()`（now）
 * @returns tenant 时区下的"今日零点"对应 Dayjs（内部是 UTC 时刻，显示按 tz）
 *
 * @example
 * startOfTenantDay('Asia/Shanghai')
 *   // 上海 2026-04-22 00:00:00（对应 UTC 的 2026-04-21 16:00:00）
 *
 * startOfTenantDay('Asia/Tokyo', dayjs('2026-04-22T15:30:00Z'))
 *   // 东京 2026-04-23 00:00:00（对应 UTC 的 2026-04-22 15:00:00）
 */
export function startOfTenantDay(tenantTimezone: string, base?: Dayjs | Date | string): Dayjs {
  const ref = base !== undefined ? dayjs(base) : dayjs();
  return ref.tz(tenantTimezone).startOf('day');
}

/**
 * 获取 tenant 时区下某时刻是"当月第几天"（1-31）。
 *
 * @example
 * dayOf('Asia/Shanghai', '2026-04-22T23:00:00Z') // 23（UTC 23:00 在上海已经 4-23 了）
 */
export function dayOf(tenantTimezone: string, base?: Dayjs | Date | string): number {
  const ref = base !== undefined ? dayjs(base) : dayjs();
  return ref.tz(tenantTimezone).date();
}

/**
 * 格式化为 tenant 时区的本地时间字符串。
 *
 * @param tenantTimezone - IANA 时区
 * @param base - 要格式化的时刻
 * @param format - dayjs format 字符串，默认 `'YYYY-MM-DD HH:mm:ss'`
 *
 * @example
 * formatTenantDate('Asia/Shanghai', new Date()) // '2026-04-22 15:30:00'
 * formatTenantDate('America/New_York', new Date(), 'YYYY-MM-DD hh:mm A z')
 *   // '2026-04-22 03:30 AM EDT'
 */
export function formatTenantDate(
  tenantTimezone: string,
  base: Dayjs | Date | string,
  format = 'YYYY-MM-DD HH:mm:ss',
): string {
  return dayjs(base).tz(tenantTimezone).format(format);
}

/**
 * 判断两个时刻在 tenant 时区下是否"同一天"。
 * 用于"今天的订单"这类查询的跨日处理。
 */
export function isSameTenantDay(
  tenantTimezone: string,
  a: Dayjs | Date | string,
  b: Dayjs | Date | string,
): boolean {
  return dayjs(a).tz(tenantTimezone).isSame(dayjs(b).tz(tenantTimezone), 'day');
}
