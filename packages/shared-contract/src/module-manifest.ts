/**
 * Tripod 模块清单 —— `defineModuleManifest()` 的返回值。
 *
 * 每个业务 module（order / product / customer 等）通过 `manifest.ts` 声明自己的
 * 权限节点 / 事件 / 状态机 transitions / 导出类型。runtime 不强依赖 manifest（业务
 * 代码直接用 service 即可），但它是 AI 读代码 + 生成权限 UI + 审计日志归类 + 测试
 * 计划的 SoT（single source of truth）。
 */
export interface TripodModuleManifest {
  /** 模块名，kebab-case（与目录名一致） */
  readonly name: string;
  /** 版本（通常跟 app 版本走，M2 固定 '0.1.0'） */
  readonly version: string;
  /** 权限节点清单（PermissionId 格式：`domain:resource:action`） */
  readonly permissions?: readonly string[];
  /** 业务审计事件名清单（audit log 的 event 字段取值） */
  readonly auditEvents?: readonly string[];
  /** 状态机 transitions（shared-workflow 用；key = 状态机名，value = 合法转移对） */
  readonly transitions?: Readonly<Record<string, readonly StateTransition[]>>;
  /** 模块 exports 的 DTO 类型名（给 gen:crud / 文档生成用） */
  readonly exportTypes?: readonly string[];
  /** 模块 feature flag 依赖（key 名） */
  readonly featureFlags?: readonly string[];
}

export interface StateTransition {
  readonly from: string;
  readonly to: string;
  readonly requires?: readonly string[]; // permission ids required
}

/**
 * 定义 Tripod 模块清单。编译期类型校验（如 transitions key 存在、permissions 格式）。
 *
 * 函数本身是 identity（runtime 直接返回入参），仅用于类型推导。
 *
 * @example
 * // apps/server/src/order/order.manifest.ts
 * import { defineModuleManifest } from '@tripod-stack/shared-contract';
 *
 * export const orderManifest = defineModuleManifest({
 *   name: 'order',
 *   version: '0.1.0',
 *   permissions: ['order:read:own', 'order:read:all', 'order:write:own'],
 *   auditEvents: ['order.created', 'order.shipped', 'order.cancelled'],
 *   transitions: {
 *     OrderStatus: [
 *       { from: 'DRAFT', to: 'CONFIRMED' },
 *       { from: 'CONFIRMED', to: 'SHIPPED' },
 *       { from: 'CONFIRMED', to: 'CANCELLED' },
 *     ],
 *   },
 *   exportTypes: ['OrderDto', 'CreateOrderDto'],
 *   featureFlags: ['order.allow-backorder'],
 * });
 */
export function defineModuleManifest<T extends TripodModuleManifest>(manifest: T): T {
  return manifest;
}
