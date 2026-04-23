import { Decimal } from 'decimal.js';

/**
 * 金额 / 精确计算统一走 Decimal。
 *
 * **不要**用 JS `number` 做金额运算（0.1 + 0.2 = 0.30000000000000004 这种浮点坑）。
 * 数据库里金额列建议用 `Decimal(18, 4)` 或 `Decimal(14, 2)`，查询时用 Prisma 的
 * `Decimal` 类型（内部也是 decimal.js）。
 */

export { Decimal };

/** 常量 0（Decimal 实例）。 */
export const ZERO: Decimal = new Decimal(0);
/** 常量 1（Decimal 实例）。 */
export const ONE: Decimal = new Decimal(1);

/**
 * 把 string / number / Decimal 包成 Decimal。
 * - number 会先 `.toString()` 再构造（避免浮点精度）
 * - Decimal 直接返回（无拷贝开销）
 *
 * @example
 * toDecimal('99.99')
 * toDecimal(100)
 * toDecimal(new Decimal('1.23'))
 */
export function toDecimal(value: string | number | Decimal): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(typeof value === 'number' ? value.toString() : value);
}

/**
 * 求和。支持任意数量 Decimal-likes。空列表返回 0。
 *
 * @example
 * sum('1.1', '2.2', '3.3').toString() // '6.6'
 * sum() // Decimal(0)
 */
export function sum(...values: readonly (string | number | Decimal)[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(toDecimal(v)), ZERO);
}

/**
 * 按四舍五入（ROUND_HALF_UP）保留 N 位小数。
 * 会计合规：对账单金额常用 2 位；税率 / 汇率用 4 位。
 *
 * @param value - 要舍入的值
 * @param decimals - 小数位数，默认 2
 *
 * @example
 * roundHalfUp('1.125', 2).toString() // '1.13'
 * roundHalfUp('1.124', 2).toString() // '1.12'
 */
export function roundHalfUp(value: string | number | Decimal, decimals = 2): Decimal {
  return toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}
