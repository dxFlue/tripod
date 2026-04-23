import { extend } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

let initialized = false;

/**
 * 初始化 dayjs 四插件：utc / timezone / customParseFormat / relativeTime。
 * 幂等：多次调用安全（dayjs 内部 extend 已 dedup）。
 *
 * **所有 app 入口必须首行调用**（apps/server/src/main.ts / apps/*-web/src/main.tsx / apps/*-mobile/App.tsx）。
 * 否则 tenant 时区 helper / relative 时间展示会行为异常。
 *
 * @example
 * // apps/server/src/main.ts
 * import { initDayjs } from '@tripod-stack/shared-utils';
 * initDayjs();
 * // 之后再 bootstrap Nest
 */
export function initDayjs(): void {
  if (initialized) return;
  extend(utc);
  extend(timezone);
  extend(customParseFormat);
  extend(relativeTime);
  initialized = true;
}

/**
 * 判断 dayjs 插件已初始化。测试 / 诊断用。
 */
export function isDayjsInitialized(): boolean {
  return initialized;
}

/**
 * 重置 init 状态。**仅测试用**。
 *
 * @internal
 */
export function _resetDayjsInit(): void {
  initialized = false;
}
