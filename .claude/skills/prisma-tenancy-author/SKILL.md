---
name: prisma-tenancy-author
description: |
  引导 AI 加一张 Prisma 表时按多租户标准姿势走：schema 里加 `tenantId` + 复合索引 / 复合唯一、注册 Prisma middleware 自动注入、写 RLS policy 到 migration、单测覆盖跨租户隔离。
  固化"单表 4 步"：schema → migration（含 RLS）→ middleware 注册 → 跨租户隔离单测。
  本 skill **不依赖 plans/ 或 tasks.md**——靠前置条件 + 仓库里实际 Prisma schema 状态判断。
when_to_use: 用户说"加一张 xxx 表 / 加 Prisma model / 加 schema / 新增实体 / 加表 / 改 schema / 加多租户表"，或要在 `apps/server/prisma/schema.prisma` 里新增 `model`。
priority: high
allowed-tools: Read Grep Glob Bash Edit Write
---

# Prisma 多租户表开发引导

tripod 是多租户架构，**每张业务表都必须带 `tenantId` + 对应索引 + RLS policy**（除非明确是系统级跨租户表，如 `Tenant` 自身 / 平台审计等）。本 skill 固化加一张表的 4 步姿势。

## 0. 前置条件检查（先跑）

| 检查                                                                 | 命令                                                     | 若不存在                                                                                           |
| -------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `apps/server/prisma/schema.prisma` 存在                              | `ls apps/server/prisma/schema.prisma`                    | **停下报告**：需要先建 `apps/server` 骨架（nest-module-author 或 Stage 3 交付），本 skill 无法进行 |
| Prisma Client 已生成（有 `apps/server/node_modules/@prisma/client`） | `ls apps/server/node_modules/@prisma/client 2>/dev/null` | 跑 `pnpm -F apps/server prisma generate` 后再继续                                                  |
| Prisma middleware 入口存在                                           | `find apps/server/src -name 'prisma*.ts' \| head`        | 骨架缺 middleware，按第 4 节建                                                                     |

前置不满足 → **停下报告**，不越界帮用户建整套 apps/server。

---

## 1. Phase 1：闸门（这张表该不该有 tenantId？）

| 判断                                          | 信号                                                  | 需要 tenantId？                  |
| --------------------------------------------- | ----------------------------------------------------- | -------------------------------- |
| 业务表（user / order / post / product / ...） | 存数据按租户隔离                                      | ✅ 必须                          |
| 系统级跨租户表                                | `Tenant` / `PlatformUser` / `SystemConfig` / 平台审计 | ❌ 不加                          |
| M2M 关联表                                    | `UserRole` / `UserPermission`                         | ✅ 必须（沿上游主表的 tenantId） |
| 纯静态字典表                                  | `Country` / `Currency` / `TimeZone`                   | ❌ 不加                          |

判断不准 → **停下报告**，不猜。

---

## 2. Phase 2：schema.prisma 骨架

加一个新 model 的**标准 6 字段 + 3 索引**：

```prisma
model <Name> {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @db.Uuid
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?              // 软删（非强制，看业务）

  // 业务字段 ...
  name      String
  // ...

  // 多租户索引（必须）
  @@index([tenantId])
  @@index([tenantId, createdAt])     // 列表查询常按时间倒序
  @@unique([tenantId, name])          // 租户内唯一的业务键（按情况加）

  @@map("<snake_case_name>s")         // 表名 snake_case + 复数
}
```

**硬约束**：

- `id` 必须 `@default(uuid())`，不用自增 `Int`（分布式 ID 冲突）
- `tenantId` 必须**在 `id` 之后的第一个字段**（方便 grep 审计）
- `@@index([tenantId])` 必须有（RLS policy 要用到）
- 租户内唯一约束用 **复合唯一** `@@unique([tenantId, xxx])`，不用裸 `@unique`
- 表名 `@@map("...")` 用 snake_case + 复数

**禁用**：

- `tenantId Int`（必须 UUID 和 `Tenant.id` 类型一致）
- `tenantId String` 不加 `@db.Uuid`（postgres 存 text 白占空间）
- 只加 `@@index([tenantId])` 不加其他复合索引（列表查性能问题）
- `@@unique([name])` 裸唯一（跨租户会冲突）

---

## 3. Phase 3：migration 骨架（含 RLS policy）

`pnpm -F apps/server prisma migrate dev --name add_<name>` 生成 SQL 骨架后，**手动追加 RLS policy**：

```sql
-- 生成的 CREATE TABLE + INDEX（prisma 自动，不动）
CREATE TABLE "<table>" (...);
CREATE INDEX ... ;

-- 手动加（本 skill 的硬要求）
ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "<table>"
  USING ("tenantId" = current_setting('app.current_tenant', true)::uuid);

-- bypass policy（供 admin / migration / seed 用，不带会撞 RLS）
CREATE POLICY bypass_for_superuser ON "<table>"
  TO <app-role-with-bypass>
  USING (true);
```

**硬约束**：

- 每张带 `tenantId` 的表都要 `ENABLE ROW LEVEL SECURITY`
- policy 用 `current_setting('app.current_tenant', true)::uuid`（session-level GUC，middleware 层设置）
- 有 bypass policy 给 admin / seed（不然 migration 跑不动）
- migration 文件**手改后**要跑 `pnpm -F apps/server prisma migrate dev` 确认 apply 成功

**禁用**：

- 只在代码里过滤 `where: { tenantId }`，不加 RLS（代码漏一个 where 就数据串租户）
- policy 硬编码 tenantId（必须从 session GUC 取）
- migration 文件手改但没运行 apply（schema drift）

---

## 4. Phase 4：Prisma middleware 注册 + session GUC 设置

middleware 两件事：

1. **读 CorrelationContext**（`@tripod-stack/shared-contract` 的 ALS）取当前 `tenantId`
2. **每个查询前** `SET LOCAL app.current_tenant = '<uuid>'`（让 RLS policy 生效）

骨架（具体代码按 apps/server 已有 middleware 的风格改）：

```ts
// apps/server/src/prisma/tenant.middleware.ts
import { getCorrelationContext } from '@tripod-stack/shared-contract';

export const tenantMiddleware: Prisma.Middleware = async (params, next) => {
  const ctx = getCorrelationContext();
  const tenantId = ctx?.tenantId;
  if (!tenantId) {
    // 系统任务 / platform-admin 请求 → 走 bypass role，不 SET GUC
    return next(params);
  }

  // session GUC（RLS policy 读这个）
  await prisma.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantId}'`);

  // 代码层防御性过滤（双保险）
  if (params.action === 'findMany' || params.action === 'findFirst' || ...) {
    params.args.where = { ...params.args.where, tenantId };
  }
  if (params.action === 'create') {
    params.args.data.tenantId = tenantId;
  }
  // update / delete / upsert 同理

  return next(params);
};
```

**硬约束**：

- middleware 读 `@tripod-stack/shared-contract` 的 ALS，不自造租户上下文
- GUC 用 `SET LOCAL`（事务级），不用 `SET`（会话级，泄漏到其他请求）
- 代码层过滤 + RLS policy 双保险（防其中一层漏）
- tenantId 未设置时不 SET GUC（让 RLS 直接 deny；bypass role 除外）

**禁用**：

- middleware 用 module-level 变量存当前 tenantId（并发崩）
- 跳过双保险只依赖代码层或只依赖 RLS
- middleware 里硬编码 tenant GUC 名（`app.current_tenant` 是全项目约定）

---

## 5. 单元测试硬门槛（跨租户隔离必测）

本 skill 的交付判定：**每张加表必须有"跨租户隔离测试"**。

```ts
import { describe, it, expect } from 'vitest';
// 用 shared-test 的 createTestTenant fixture（阶段 2 交付后）

describe('<Name> 跨租户隔离', () => {
  it('happy: tenant A 创建的记录，tenant A 查得到', async () => {
    const a = await createTestTenant();
    await withTenant(a, () => prisma.<name>.create({ data: { name: 'x' } }));
    const found = await withTenant(a, () => prisma.<name>.findMany());
    expect(found).toHaveLength(1);
  });

  it('isolation: tenant A 创建的记录，tenant B 查不到', async () => {
    const a = await createTestTenant();
    const b = await createTestTenant();
    await withTenant(a, () => prisma.<name>.create({ data: { name: 'x' } }));
    const found = await withTenant(b, () => prisma.<name>.findMany());
    expect(found).toHaveLength(0);
  });

  it('isolation: tenant A 记录，tenant B delete 不到', async () => {
    const a = await createTestTenant();
    const b = await createTestTenant();
    const rec = await withTenant(a, () => prisma.<name>.create({ data: { name: 'x' } }));
    await withTenant(b, () => prisma.<name>.delete({ where: { id: rec.id } }));
    const stillThere = await withTenant(a, () => prisma.<name>.findUnique({ where: { id: rec.id } }));
    expect(stillThere).toBeDefined();  // A 记录没被 B 删掉
  });
});
```

**最低要求**：3 个 test —— happy / findMany 隔离 / 写入隔离（create/update/delete 任选一个）。单元测试方法论见 `spec-driven-testing` skill。

---

## 6. AI 铁律

| 场景                | 必须做                                                            | 必须不做                                          |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| 前置条件            | `apps/server/prisma/schema.prisma` 存在                           | ❌ 没有也试图新建整套 apps/server（超出本 skill） |
| 判断是否加 tenantId | 业务表加、系统表不加、字典表不加                                  | ❌ 不确定时猜（停报）                             |
| schema 字段         | `id` + `tenantId` + `createdAt/updatedAt` + `@@index([tenantId])` | ❌ 漏字段；❌ `Int id`                            |
| 唯一约束            | `@@unique([tenantId, ...])` 复合                                  | ❌ 裸 `@unique`                                   |
| migration RLS       | `ENABLE ROW LEVEL SECURITY` + policy + bypass                     | ❌ 只靠代码 where 过滤                            |
| middleware          | 读 shared-contract ALS + SET LOCAL GUC + 代码层 where 双保险      | ❌ module-level 全局变量                          |
| 测试                | ≥ 3 个跨租户隔离 test                                             | ❌ 只写单租户 happy path                          |
| 失败                | 停下报告                                                          | ❌ 注释掉 RLS policy "先跑通"；❌ 删隔离 test     |

---

## 7. 参考

| 用途                   | 位置                                                                            |
| ---------------------- | ------------------------------------------------------------------------------- |
| CorrelationContext ALS | `packages/shared-contract/src/correlation/`                                     |
| 已有 middleware 写法   | `apps/server/src/prisma/*.middleware.ts`（若存在）                              |
| 现有 schema 样本       | `apps/server/prisma/schema.prisma` 里已建的其他 model                           |
| 测试 fixture           | `@tripod-stack/shared-test` 的 `createTestTenant / withTenant`（阶段 2 交付后） |

**触发本 skill 后先 Read** 上述文件，不凭记忆写 middleware / RLS 模板。
