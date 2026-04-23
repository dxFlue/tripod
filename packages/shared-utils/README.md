# @tripod-stack/shared-utils

dayjs 统一 init + Decimal 金额运算 + tenant 时区 helper + 通用数组/异步 helper。

## 依赖位置

- **层级**：基础层（阶段 1）
- **依赖**：`shared-types`、`dayjs`、`decimal.js`
- **被谁依赖**：`shared-contract` / `shared-logger` / `shared-i18n` / 业务层所有 service

## 公共 API

### dayjs 初始化

| 名称                   | 签名            | 作用                                                                                      | 错误 |
| ---------------------- | --------------- | ----------------------------------------------------------------------------------------- | ---- |
| `initDayjs()`          | `() => void`    | **必须** apps 入口首行调用；注册 utc/timezone/customParseFormat/relativeTime 四插件；幂等 | —    |
| `isDayjsInitialized()` | `() => boolean` | 诊断用                                                                                    | —    |

### Tenant 时区 helper（调用前必须 `initDayjs()`）

| 名称                                  | 签名                                                | 作用                           |
| ------------------------------------- | --------------------------------------------------- | ------------------------------ |
| `startOfTenantDay(tz, base?)`         | `(tz: string, base?: Dayjs\|Date\|string) => Dayjs` | tenant 时区今日零点            |
| `dayOf(tz, base?)`                    | `(tz: string, base?) => number`                     | tenant 时区当月第几天          |
| `formatTenantDate(tz, base, format?)` | `(tz, base, fmt='YYYY-MM-DD HH:mm:ss') => string`   | tenant 本地格式化              |
| `isSameTenantDay(tz, a, b)`           | `(tz, a, b) => boolean`                             | 两时刻在 tenant 时区是否同一天 |

### Decimal 金额

| 名称                        | 签名                                      | 作用                              |
| --------------------------- | ----------------------------------------- | --------------------------------- |
| `Decimal`                   | (re-export from `decimal.js`)             | 高精度数字构造                    |
| `ZERO` / `ONE`              | `Decimal` 常量                            | 常用值                            |
| `toDecimal(v)`              | `(v: string\|number\|Decimal) => Decimal` | 包装（number 走 toString 防浮点） |
| `sum(...vs)`                | `(...vs: DecLike[]) => Decimal`           | 求和（空列表 = 0）                |
| `roundHalfUp(v, decimals?)` | `(v: DecLike, decimals=2) => Decimal`     | 四舍五入 N 位                     |

### 通用 helper

| 名称                       | 签名                                               | 作用                                |
| -------------------------- | -------------------------------------------------- | ----------------------------------- |
| `isNullish(x)`             | type guard `is null \| undefined`                  | null/undefined 判断                 |
| `unique(arr)`              | `<T>(arr: T[]) => T[]`                             | 去重（保序）                        |
| `uniqueBy(arr, key)`       | `<T,K>(arr: T[], key: (x: T) => K) => T[]`         | 按 key 去重                         |
| `chunk(arr, size)`         | `<T>(arr: T[], size: number) => T[][]`             | 分片（size≤0 抛错）                 |
| `groupBy(arr, key)`        | `<T,K>(arr: T[], key: (x: T) => K) => Map<K, T[]>` | 分组                                |
| `delay(ms)`                | `(ms: number) => Promise<void>`                    | 延时                                |
| `withTimeout(p, ms, msg?)` | `<T>(p: Promise<T>, ms, msg?) => Promise<T>`       | 超时保护，超时抛 `TimeoutError`     |
| `retry(fn, opts?)`         | `<T>(fn, opts?) => Promise<T>`                     | 指数退避（默认 3 次、100ms 起、×2） |

## 安装

```jsonc
{
  "dependencies": {
    "@tripod-stack/shared-utils": "workspace:*",
  },
}
```

## 使用示例

### Golden path：app 启动 + tenant 日报

```ts
// apps/server/src/main.ts
import { initDayjs } from '@tripod-stack/shared-utils';
initDayjs(); // ⭐ 必须在 bootstrap 前

// 业务 service
import { startOfTenantDay, formatTenantDate } from '@tripod-stack/shared-utils';

async function todayOrders(tenantId: TenantId, tenantTz: string) {
  const startUtc = startOfTenantDay(tenantTz).toISOString();
  return prisma.order.findMany({
    where: { tenantId, createdAt: { gte: startUtc } },
  });
}
```

### 金额：多条明细求和后四舍五入到分

```ts
import { sum, roundHalfUp } from '@tripod-stack/shared-utils';

const total = roundHalfUp(sum(...items.map((i) => i.price.mul(i.qty))), 2);
```

### 重试：幂等外部调用

```ts
import { retry } from '@tripod-stack/shared-utils';

const result = await retry(() => externalApi.post(url, body), {
  attempts: 5,
  baseMs: 200,
  shouldRetry: (e: any) => e.response?.status >= 500 || e.response?.status === 429,
});
```

## 反模式 ❌ vs 正确 ✅

### 1. 不要用 number 做金额运算

❌

```ts
const total = 0.1 + 0.2; // 0.30000000000000004
const tax = price * 0.03;
```

✅

```ts
import { toDecimal } from '@tripod-stack/shared-utils';
const total = toDecimal(0.1).plus(0.2); // '0.3'
const tax = toDecimal(price).mul('0.03');
```

### 2. 不要用 server 本地时区判"今天"

❌

```ts
const today0 = dayjs().startOf('day'); // server 时区，业务报表不准
```

✅

```ts
import { startOfTenantDay } from '@tripod-stack/shared-utils';
const today0 = startOfTenantDay(tenant.timezone);
```

### 3. 不要让 initDayjs 晚于 dayjs().tz() 首次调用

❌

```ts
// main.ts
import './logger-setup'; // 这里面已经调了 dayjs().tz(...) → 没注册 timezone 插件 → 崩
import { initDayjs } from '@tripod-stack/shared-utils';
initDayjs();
```

✅

```ts
// main.ts
import { initDayjs } from '@tripod-stack/shared-utils';
initDayjs(); // ⭐ 首行
import './logger-setup';
```

### 4. 不要手写 retry 循环 + 固定 sleep

❌

```ts
for (let i = 0; i < 3; i++) {
  try {
    return await fn();
  } catch (e) {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
```

✅

```ts
return retry(fn, { attempts: 3, baseMs: 1000 });
```

## 相关

- `@tripod-stack/shared-types` — branded ID 类型（tenant/user）
- `@tripod-stack/shared-i18n` — 使用本包的 dayjs + Decimal 做日期 / 金额本地化展示
- plan-full `§shared-utils` — 完整设计
- plan-full `§i18n §时区` — tenant 时区契约
