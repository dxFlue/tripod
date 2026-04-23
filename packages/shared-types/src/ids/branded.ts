/**
 * Branded ID 类型。运行时是 string，但类型系统拒绝 string ↔ branded 互转，
 * 防止业务误把 UserId 当 TenantId 传、或反之。
 *
 * 构造 branded 值：用对应的 `asXxx(raw)` 工厂函数（会做 UUID/格式校验）。
 */
declare const brand: unique symbol;

/** 泛型 branded 基类型。不直接使用，走子类型。 */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

/** 租户 ID（UUID v7 或业务约定格式）。 */
export type TenantId = Brand<string, 'TenantId'>;
/** 用户 ID（UUID v7）。 */
export type UserId = Brand<string, 'UserId'>;
/** 权限节点 ID。`<domain>:<resource>:<action>` 格式，如 `order:read:own`。 */
export type PermissionId = Brand<string, 'PermissionId'>;
/** 请求追溯 ID（UUID v7，每请求一个）。 */
export type CorrelationId = Brand<string, 'CorrelationId'>;
/** 幂等 key（客户端传的 Idempotency-Key header 值，SHA-256 或 UUID）。 */
export type IdempotencyKey = Brand<string, 'IdempotencyKey'>;

/**
 * 把 raw string 断言为 TenantId。**不做格式校验** —— 仅类型层面标记。
 * 适合已经由 Prisma / JWT 等可信源产出、知道是合法 tenant id 的场景。
 *
 * 需要格式校验时用 `parseTenantId()`（返回 Result，防无效输入）。
 *
 * @example
 * const id = asTenantId('123e4567-e89b-12d3-a456-426614174000');
 */
export function asTenantId(raw: string): TenantId {
  return raw as TenantId;
}

/** @see asTenantId */
export function asUserId(raw: string): UserId {
  return raw as UserId;
}

/** @see asTenantId */
export function asPermissionId(raw: string): PermissionId {
  return raw as PermissionId;
}

/** @see asTenantId */
export function asCorrelationId(raw: string): CorrelationId {
  return raw as CorrelationId;
}

/** @see asTenantId */
export function asIdempotencyKey(raw: string): IdempotencyKey {
  return raw as IdempotencyKey;
}

/**
 * UUID v7 / v4 格式校验正则（两种 variant 都接受）。
 * v7 是 tripod 默认（时间有序），v4 作为兼容。
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 校验 raw 是否为合法 UUID（v4 或 v7）。不通过返回 null，不抛。
 *
 * @example
 * const id = parseUuid(rawInput);
 * if (id === null) throw new BadRequestException(...);
 */
export function parseUuid(raw: string): string | null {
  return UUID_REGEX.test(raw) ? raw : null;
}

/**
 * 权限 ID 格式校验：`<domain>:<resource>:<action>`
 * 三段，每段 [a-z0-9_-]+
 */
const PERMISSION_ID_REGEX = /^[a-z0-9_-]+:[a-z0-9_-]+:[a-z0-9_-]+$/;

/**
 * 校验权限 ID 合法。
 *
 * @example
 * parsePermissionId('order:read:own')  // 'order:read:own'
 * parsePermissionId('invalid')          // null
 */
export function parsePermissionId(raw: string): PermissionId | null {
  return PERMISSION_ID_REGEX.test(raw) ? (raw as PermissionId) : null;
}
