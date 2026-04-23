# 全栈代码模板体系（Web + Mobile + Server）— 详细设计档案

> **⚠️ AI 日常会话请首先加载 `plans/design/tripod-core.md`**（约 380 行），本文件是详细设计档案 / 论证与示例，AI 只在 core 不足以回答时按主题 grep 本文件。
>
> 本文件内容与 core 有重合但更详细。矛盾时以本文件 + 代码为准。core 见 [tripod-core.md](./tripod-core.md)。

## Context

**目标**：建设一套可复用的代码模板体系，使未来启动新项目时：

- 拉下模板即可直接写业务，不必重复搭建登录 / HTTP 客户端 / 错误处理 / 权限 / i18n / 错误上报 / CI/CD
- 对差异化需求（不同登录方式、不同权限模型、不同存储等）通过 **Adapter 模式**接入，不改基建
- 覆盖多种项目形态：门户站、管理后台（ERP 类重型）、商城 Web / Mobile、管理端 Mobile

**当前阶段**：方法论 & 架构决策阶段，尚无代码产出。本文档是后续逐步建设的纲领。

**文档定位**：本项目所有文档都是**写给 AI 读的协议**，不是写给人维护的说明书。AI 是主要配置者 / 代码生成者 / 问题诊断者；人只负责审阅 AI 的改动。因此：

- 文档里的每一条约定都假定 AI 会严格遵守，请当作不可违反的契约
- "不做 X" 类声明比"应该做 Y"更重要（AI 擅长补功能，不擅长克制）
- 命令输出、配置文件、schema 优先机器可读格式；markdown 只用于高层契约
- AI 首次进入项目会话时，默认执行 `tripod snapshot --json` 拉全景，再按需读本文件具体章节

---

## Anti-patterns（AI 必读禁令）

**本章是 AI 进入会话后最先读的契约。** 所有以下能力 M2 阶段**明确不做**，AI 生成代码 / 提建议 / 回答问题时**不得主动补回**。仅当用户明确要求时才加，且先更新本章（从禁令移到"已激活"）。

### 权限系统（shared-permission）

- **不加** BUTTON / FIELD 独立节点类型（只用 PAGE / ACTION / DATA_SCOPE 三类）
- **不用** 4 档 scope（own/assigned/team/all），只用 **own / all** 两档
- **不做** `FieldPermissionInterceptor` / `@RequireField` 装饰器（字段脱敏用 service 层显式 `delete dto.xxx`）
- **不做** `ScopeBuilder` 抽象（data-scope 用 service 层显式 where 分支）
- **不做** tenant 自定义权限节点（L2 低代码路线已否决）
- **不接** Casbin / Cerbos / openFGA 外置引擎
- 不做 `hasPermission` 的 scope rank 匹配（就一行 `includes` 检查）

### 工作流（shared-workflow）

- **不自实现** 状态机 DSL（`defineStateMachine` / guards / hooks / onEnter 都不要）
- **不默认加** Outbox 事件表（`OutboxEvent` / `OutboxPublisher` / `OutboxStatus` 不建）
- **不做** `machineVersion` 列 + `name@version` registry
- **不抽** BullMQ `FlowProducer` 封装 + Processor 基类
- **不做** SLA timeout 调度（状态定义里的 `timeout: { after, event }` 不实现）
- 状态转换只用：**状态字段 + 乐观锁 + `{Entity}StateHistory` 表 + Prisma 事务**，service 层手写每个动作方法

### 审计（shared-audit）

- **不建** `BusinessAuditLogEntity` 多对多表（关联实体塞 `metadata.relatedEntities`）
- **不做** 月分区 / 冷数据 S3 parquet / DuckDB / Athena / ES / OpenSearch / ClickHouse 同步
- **不做** `@AuditAction` / `@AuditEntities` / `@AuditDiff` 装饰器 + `AuditInterceptor` AOP
- **不做** Prisma middleware 自动审计兜底（会产生字段变更噪音）
- 埋点只用：service 层显式 `await this.audit.log({ action, entityType, entityId, correlationId, summary, diff })`

### 存储（shared-storage）

- **不做** multipart 分片协议（`/files/upload/init|status|chunk|complete|abort` 全砍）
- **不建** `FileUploadSession` 表 / 孤儿清理 CRON
- **不做** hash-wasm 流式 sha256 / localStorage 断点续传 / pause-resume-cancel UX
- **不做** 前端并发分片控制 / 单用户 session 配额
- 上传只支持：**单次上传 ≤100MB，XHR 进度 + 失败重试**
- `StorageProvider` 接口**不含** `startMultipart / uploadPart / completeMultipart / abortMultipart` 四方法
- 不预留 `fileHash / providerMultipartId / chunkSize` 字段

### 观察栈（shared-logger + observability）

- **不默认起** Prometheus / Grafana / Tempo / Jaeger / Loki / Promtail
- **不做** Grafana dashboards 预置 / `alerts.yml` 告警规则
- **不做** `shared-logger/server/metrics.ts`（Prometheus client）
- **不加** 自定义 metrics 打点（`http_requests_total` 等都不做）
- OTEL 代码插桩保留但 `OTEL_ENDPOINT` 默认为空（trace 不导出）
- 观察栈 docker-compose profile 只含 **GlitchTip 单容器**

### i18n

- **不接** Tolgee / Crowdin / Lokalise 翻译平台（M2 只用本地 JSON）

### 通知（shared-notification）

- M2 adapter 只 **email-smtp + realtime-sse** 两个
- **不预登记** SMS / 推送 / 企业微信 / 钉钉 / 飞书 / webhook 各类 adapter
- **不做** 批量合并（Debounce）/ 速率控制 / quiet hours / 紧急通道多渠道回退（接口预留但 M2 不实现）

### 鉴权（shared-auth）

- M2 adapter 装 **auth-email-password + auth-username-password + auth-email-otp + auth-magic-link + recovery-email-link** 共 5 个（业务按 `tripod.config.yaml` 的 `auth.credential` 数组自由组合启用）
- **不预登记** SMS / OAuth / WeChat / WeCom / DingTalk / SSO / MFA 各类 adapter
- `MfaChallenger` / `MfaResolver` / `RecoveryProvider` 接口 M2 预留，默认 resolver 始终返回空

### 通用

- **不做** Schema-driven 表单 / ProTable / 低代码配置平台（代码驱动 CRUD 是铁律）
- **不做** "Tier 2 adapter 清单预埋"（除上文 M2 ★ 外，其他 adapter 新建包时再登记，不在 plan / manifest.yaml 里列名）
- **不做** Session Policy 除 `MaxDevicesPolicy` + `SingleGlobalPolicy` 以外的实现

### AI 行为准则

- 遇到"要不要加 X"时，**先查本章**。如果 X 在禁令里，直接答"plan 明确不做，除非你明确要求"
- 用户说"未来可能要 X"时，不要主动埋接口 / 预留字段 / 建目录占位。**真要时再一次性加**
- 改代码时发现自己正在写禁令里的模式，立即停手，反问用户

---

## CLAUDE.md 完整内容规范（AI 协议层）

**本章是 `CLAUDE.md` 的 source of truth**。项目根目录的 `CLAUDE.md` 就是本章节内容的固化副本，AI 每次会话自动加载。任何协议变更先改本章，再同步到 `CLAUDE.md`。

### 1. 会话开局协议

AI 进入 tripod 项目的任何会话，**前三步固定**：

1. **读取 Anti-patterns 章节**（上文） — 明确当前禁令边界
2. **跑 `tripod snapshot --json`** — 拿到当前 config / env / hot-spot / migration / git 全景
3. **判断用户意图所属类别**（见下文语义映射表） — 不要直接动手，先对齐

例外：如果用户说"直接做 X"且 X 明显是简单操作（改一个字符串 / 查一个文件），允许跳过步骤 2。

**Skill 自动加载**：Claude Code 会自动识别 `.claude/skills/`（模板已预置 `spec-driven-testing` + `graph-code-analysis`）。AI 看到用户说"新增模块 / 写个 XX 页面 / 帮我设计功能"时**必走** `/spec-driven-testing` 流程，不得先跳去写代码。详见 §3。

### 2. 语义动作 → CLI 命令映射表

用户自然语言 → AI 执行的确定性命令序列。表中未列的诉求一律先跑步骤 1 的 snapshot，再问用户对齐意图。

| 用户说的话                          | AI 执行的命令                                                                                                                                                                                              | 备注                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| "用 tripod 新建项目" / "开个新项目" | 先问 recipe（默认问纯 ERP / ERP+商城 / 多分公司），再跑 `pnpm create tripod <name> --recipe=<r>`                                                                                                           | 先看 `tripod recipe list`                        |
| "加个门户 / 官网"                   | `tripod add-app portal`                                                                                                                                                                                    | 自动触发 docker-compose / nginx / CI patch       |
| "加个商城"                          | `tripod add-app mall-web` + 可选 `mall-mobile`                                                                                                                                                             | 默认两个都装，用户说"只要 web"就单装             |
| "加个移动管理端 / 现场扫码"         | `tripod add-app admin-mobile`                                                                                                                                                                              |                                                  |
| "加个超管 / 总部管理 / SaaS 超管"   | `tripod add-app platform` + `tripod platform:seed`                                                                                                                                                         | seed 要用户提供 email                            |
| "不要审批流 / 不要工作流"           | `tripod remove workflow`                                                                                                                                                                                   | feature 保守 disable，代码保留                   |
| "换 S3 存储 / OSS / COS"            | `tripod add-adapter storage.backend=s3` + 提示补 env                                                                                                                                                       | 先 `tripod remove-adapter storage.backend=local` |
| "加微信登录 / OAuth / SMS 登录"     | 新建 `adapters/auth-<provider>/` 包 + `tripod add-adapter auth.credential=<name>`                                                                                                                          | Anti-patterns 说不预登记，所以是新建而非装已有   |
| "开 MFA / 双因素"                   | `tripod add-adapter mfa.totp=mfa-totp`（新建包） + `tripod platform:enroll-mfa`                                                                                                                            |                                                  |
| "加 changeset / release 这个改动"   | 读 `docs/release-rules.md` + 跑 `tripod changeset-context` + 写 `.changeset/<two-words>.md` + 告诉用户级别选择理由 + 等确认                                                                                | 永远不自己 commit                                |
| "发版 / 上线"                       | 走 `infra/deploy/build.sh <version>` 流程，**不要**帮用户跑 —— 提醒用户手动                                                                                                                                | 部署动作用户亲自做                               |
| "新增订单模块 / 写个订单管理"       | **强制走 §3 完整流程**：`/spec-driven-testing order` 写 spec → `generate order` 出测试计划 → `pnpm tripod gen:crud order` 脚手架 → `/spec-driven-testing implement order` 补三层测试跑绿 → `tripod doctor` | 禁止跳 spec / test；例外见 §3 末尾               |
| "权限不对 / 某按钮看不到"           | 先 `tripod doctor` + 读用户 JWT claims + grep `*.permissions.ts`                                                                                                                                           | 诊断路径确定                                     |
| "env 缺 / 配置不对"                 | 跑 `tripod env:validate secrets/.env.prod` + `tripod env:doctor`                                                                                                                                           | 给出缺失清单                                     |
| "升级状态机 / 加新状态"             | 改 `<resource>.manifest.ts`（见 §6）+ 改 service 方法 + 加 migration                                                                                                                                       | manifest 先改                                    |
| "加个定时任务"                      | 用 `@Scheduled` 装饰器，不要直接 new Cron                                                                                                                                                                  |                                                  |
| "观察栈 / 监控接起来"               | 参考 `未来升级路径`（观察性章节），不要在 M2 阶段主动加                                                                                                                                                    |                                                  |

### 3. 新增业务模块完整流程（Spec → 脚手架 → 测试，强制顺序）

当用户说"新增 order 资源 / 写个订单管理"，AI **必须**按 Step 0 → 4 顺序执行，不得跳步。

#### Step 0：写 Spec（skill：spec-driven-testing）

- 触发：`/spec-driven-testing <resource>`
- 产出：`docs/specs/<resource>.md`（功能 / 角色 / 业务规则 / 状态 / 界面 / edge cases / 跨功能关联）
- 规则：
  - skill 交互式逐步引导，AI **不代填**，等用户答
  - Edge cases ≥ 5 个（直接变成 Track A 测试用例）
  - Spec 只写"用户能做什么"，不写 API / 数据表 / DTO 等实现细节（Spec 是**需求层**）
- 若 `docs/specs/` 已有 ≥ 1 份其他 spec：跑 `/spec-driven-testing review` 跨 spec 一致性审查

#### Step 1：生成测试计划

- 触发：`/spec-driven-testing generate <resource>`
- 产出：`docs/specs/<resource>.test-plan.md`
- 三轨互补：
  - **Track A**（用户 edge case）：从 spec §7 取 EC-NNN → 映射为 TC-<PREFIX>-A01..
  - **Track B**（代码扫描）：调 `/graph-code-analysis`；greenfield 无代码时自动 skip
  - **Track C**（Spec 推导）：按 spec §3 F-NNN + §4 BR-NNN 系统展开 ~40 用例
- 合并去重后得最终 TC-<PREFIX>-01..NN，每条带 `Tier: Unit | API | UI`

#### Step 2：脚手架 + 8 项勾选

**首选** `pnpm tripod gen:crud <resource>`（一条命令产出全部脚手架）。手写必须同时完成以下 **8 项勾选**，漏一项就是未完成：

```
[ ] 1. prisma model：<resource> 表带 tenantId / deletedAt / createdBy / createdAt / updatedAt
       + 复合索引 [tenantId, createdAt] + RLS policy
[ ] 2. <resource>.manifest.ts（见 §6）：声明 states / transitions / permissions / audits / notifications
[ ] 3. <resource>.permissions.ts：声明 PAGE / ACTION / DATA_SCOPE 节点
[ ] 4. <resource>.service.ts：所有 state 转换方法 + service 层显式 audit.log() + displaydto 字段脱敏
[ ] 5. <resource>.controller.ts：加 @RequirePermission 装饰器 / 加 @Idempotent 装饰器（写操作）
[ ] 6. 若涉及通知：<resource>.notification-types.ts 注册 NotificationType + 模板 key
[ ] 7. 若有业务错误：shared-types/error-codes.ts 加枚举 + shared-i18n/locales/*/errors.json 补翻译
[ ] 8. 若有状态机：prisma 加 {Entity}StateHistory 表 + state 字段 + stateVersion 乐观锁列
```

**Spec 反查**：AI 做完 gen:crud 后，对照 spec 的每条 `F-NNN` / `BR-NNN` 找到实现代码的对应行，缺漏当场补。

#### Step 3：生成测试代码 + 跑绿（skill：spec-driven-testing）

- 触发：`/spec-driven-testing implement <resource>`（默认三层都出；`implement <name> unit|api|ui` 按层分别跑）
- 产出路径：
  - **Unit**（Vitest）：`apps/server/src/<resource>/*.spec.ts` 及各 shared 包的内部 spec
  - **API E2E**（Playwright）：`tests/api/<resource>.spec.ts`
  - **UI E2E**（Playwright）：`tests/ui/<resource>.spec.ts`
- **强制闭环**：`pnpm test` 必须全绿
  - 失败 TC **禁删除**、**禁 `.skip`**、**禁 `expect(...).not.toBe(...)` 水测**
  - 只改实现让测试过，不改测试让代码过
  - 实在无法实现的 TC → 停手问用户（spec 是否有误 / 是否要改需求）
- 多租户隔离：所有 E2E 走 `shared-test` 的 `createTestTenant` fixture（见 §shared-test）

#### Step 4：一致性自检

- `tripod doctor` 全绿（manifest ↔ 代码 ↔ migration ↔ env 四方一致）
- `pnpm lint` / `pnpm typecheck` 全绿（AI 自检协议 §代码规范详细设计的六步）
- 产物自查：
  - `docs/specs/<resource>.md` ✓
  - `docs/specs/<resource>.test-plan.md` ✓
  - `apps/server/prisma/migrations/*<resource>*/migration.sql` ✓
  - `apps/server/src/<resource>/*.{manifest,permissions,service,controller}.ts` ✓
  - `apps/server/src/<resource>/*.spec.ts` + `tests/api/<resource>.spec.ts` + `tests/ui/<resource>.spec.ts`（按层级筛）✓
  - 缺一不"完成"

#### 跳步条件（仅这三种，其他必走全流程）

- 纯内部脚本 / 一次性 migration 修复 / 纯文档 PR — 不算"业务模块"，不生成长期测试
- 用户明确说"这一版不写测试 / 先跳过测试" — 必须在 commit message + PR description 记录"延迟测试补回"
- 改动只改已有模块**样式 / 文案 / 本地化**，不改业务行为 — 跳 Step 0-1，直接走既有回归

**自检**：完成后跑 `tripod doctor` 必须全绿。

### 4. 新增字段 / 改 schema 的关联改动

```
[ ] 1. prisma/schema.prisma 改 model
[ ] 2. prisma migrate dev --name <descriptive> 生成 migration
[ ] 3. 如涉及敏感字段（cost / salary / phone / id-card）：加 permission node + service 层显式 delete 脱敏
[ ] 4. 如涉及必填且无默认：明确通知用户"旧数据需回填"，不要自己瞎写默认
[ ] 5. 更新对应 <resource>.manifest.ts
[ ] 6. 如字段进入 API 响应：检查 OpenAPI codegen 是否自动更新（orval 跑一次）
```

### 5. 新增 env 变量的关联改动

```
[ ] 1. packages/shared-config/src/env.ts 的 Zod schema 加字段
[ ] 2. 跑 tripod env:gen-example > infra/deploy/.env.prod.example 同步模板
[ ] 3. secrets/.env.prod 加真值（不进 git）
[ ] 4. tripod env:validate secrets/.env.prod 通过
[ ] 5. 使用该 env 的代码走 import { env } from '@tripod-stack/shared-config'，不直接读 process.env
```

### 6. 业务模块 manifest.ts 约定

每个业务资源（order / sku / customer / ...）配一份 `<resource>.manifest.ts` 纯声明文件。**运行时不驱动任何行为**，只作为 AI 读取模块全貌的"索引卡"，避免 AI 为了搞清状态/权限/审计得 grep 整个 service 目录。

```ts
// apps/server/src/sales-order/sales-order.manifest.ts
import { defineModuleManifest } from '@tripod-stack/shared-contract';

export const SALES_ORDER_MANIFEST = defineModuleManifest({
  resource: 'sales-order',
  displayName: '销售订单',

  // 状态机摘要（真值在 service 方法里，这里只列给 AI 看）
  states: [
    'draft',
    'pending-approval',
    'approved',
    'picking',
    'packed',
    'shipped',
    'completed',
    'rejected',
    'cancelled',
  ],
  transitions: [
    { from: 'draft', event: 'SUBMIT', to: 'pending-approval' },
    {
      from: 'pending-approval',
      event: 'APPROVE',
      to: 'approved',
      permission: 'sales-order:approve',
    },
    {
      from: 'pending-approval',
      event: 'REJECT',
      to: 'rejected',
      permission: 'sales-order:approve',
    },
    { from: 'approved', event: 'PICK', to: 'picking', permission: 'sales-order:pick' },
    // ...
  ],

  // 权限节点摘要（真值在 <resource>.permissions.ts）
  permissions: [
    { id: 'sales-order:list-page', type: 'PAGE' },
    { id: 'sales-order:read-all', type: 'ACTION' },
    { id: 'sales-order:read-own', type: 'DATA_SCOPE' },
    { id: 'sales-order:create', type: 'ACTION' },
    { id: 'sales-order:approve', type: 'ACTION' },
    { id: 'sales-order:read-cost', type: 'ACTION', sensitive: true },
  ],

  // 审计动作摘要（真值在 service 方法里 audit.log 调用）
  audits: ['submitted', 'approved', 'rejected', 'picked', 'packed', 'shipped', 'cancelled'],

  // 通知类型摘要（真值在 <resource>.notification-types.ts）
  notifications: ['sales-order:approved', 'sales-order:rejected', 'sales-order:shipped'],

  // 关联实体（用于 audit.log 的 relatedEntities / 跨实体反查）
  relatedEntities: ['sku', 'customer', 'warehouse'],

  // 敏感字段（service 层需显式 delete 的字段）
  sensitiveFields: [{ field: 'costPrice', requires: 'sales-order:read-cost' }],
});
```

**AI 阅读优先级**：进入 `apps/server/src/<resource>/` 目录时，**先读 `<resource>.manifest.ts`** 建立全局认知，再读 service / controller / permissions 细节。

**规则**：

- manifest **必须**与真实代码一致（AI 改 service 加新状态时，同步改 manifest）
- 无 manifest 的模块视为"AI 不可信任"—— AI 维护时第一件事是补 manifest
- `tripod doctor` 检查每个 resource 目录是否有 manifest + manifest 与 service 实际状态是否一致（对照 `state: '...'` 字符串出现的集合）
- `defineModuleManifest` 是 runtime 零开销的类型标注（只用于 IDE 跳转 + AI 检索）

### 7. Hot-spot 文件修改规则

AI 改代码时**不得删除** `tripod:*-start` / `tripod:*-end` 这对 magic comment。

- 标记**之间**：`tripod add-app` / `tripod add` / `tripod add-adapter` 的自动写入区
- 标记**之外**：用户手写代码区，AI 想改必须是用户显式要求的业务修改
- 如果 AI 必须在标记外做改动（如用户要求重构），改动后**必须跑 `tripod doctor`** 确认标记完整
- 发现标记丢失：跑 `tripod repair <file>` 恢复，不要硬写

Hot-spot 文件清单（CLI 唯一会自动写的 TS 文件）：

- `apps/server/src/app.module.ts`（`tripod:imports` + `tripod:module-imports`）
- `prisma/seed.ts`（`tripod:seed-calls`）
- `packages/shared-config/src/env.schema.ts`（`tripod:env-fields`）
- `packages/shared-auth/src/strategies/index.ts`（`tripod:credential-providers`）

其他 TS 文件 CLI 永不自动写，AI 可正常编辑。

### 8. 脚手架产物识别

由 `pnpm tripod gen:<kind> <name>` 生成的文件顶部带 magic comment：

```ts
// tripod:generated-by gen:crud sales-order
// 本文件由脚手架产出，AI 修改前请阅读 apps/server/src/sales-order/sales-order.manifest.ts
```

AI 改这些文件时：

- 保留 `tripod:generated-by` 注释（让后续 AI 知道它是脚手架产物）
- 改动超过 50% 或已脱离脚手架结构时，把注释改为 `// tripod:manually-edited from gen:crud sales-order`

`tripod.manifest.yaml` 的 `generators:` 段声明每个 generator 的 outputs 清单（见 §9），让 AI 在改造前能预测"gen:crud 原本会产哪些文件"。

### 9. 失败剧本

遇到 CLI 报错时的固定诊断顺序：

| 症状                                                      | 诊断命令                          | 可能原因 & 修复                                                                                               |
| --------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `tripod add-app X` 报 hot-spot 标记缺失                   | `tripod doctor`                   | 用户重构过 app.module.ts / seed.ts；跑 `tripod repair <file>` 或按 `docs/manual-patches/<action>.md` 手工接入 |
| `tripod doctor` 报 feature disabled 但 module 还在 import | 读 snapshot.unaligned[]           | 用户手改了 app.module.ts；让 AI 找到并注释掉对应 import                                                       |
| `tripod env:validate` 失败                                | 读失败报告的 missing/invalid 列表 | 补 `secrets/.env.prod` 对应字段；字段来源是 `packages/shared-config/src/env.ts` Zod schema                    |
| `pnpm dev` 启动崩溃 "DATABASE_URL missing"                | 先 `tripod env:validate`          | 大概率是 `.env.local` 没生成，跑 `cp infra/deploy/.env.prod.example .env.local` 填本地值                      |
| prisma migrate 报 "column does not exist"                 | 读 git log 是否有人直接改 DB      | 让用户先 `prisma migrate resolve` 或从备份恢复，不要自己 `db push`                                            |
| `tripod add-adapter X=Y` 报 adapter 包不存在              | 检查 `adapters/<Y>/` 目录是否存在 | Anti-patterns 规则：Tier 2 adapter 不预登记，AI 需要先新建 `adapters/<Y>/` 包骨架                             |

### 10. 关于工具使用的禁令

AI 在 tripod 项目里**不得**：

- 直接跑 `docker compose up` / `pnpm dev` 等长时运行命令（交给用户）
- 直接跑 `git push` / `git commit -am` / 部署脚本（用户手动确认）
- 绕过 hot-spot 标记直接改 app.module.ts / seed.ts
- 跳过 `tripod env:validate` 直接修改 `secrets/.env.prod`（先验证再改）
- 主动新建 Tier 2 adapter 包（除非用户明确要求）
- 主动补上 Anti-patterns 章节禁止的能力

### 11. 与本章节的关系

`CLAUDE.md` 的其他部分（发版流程细节、CI workflow 细节、secrets 管理细节）由各章节的"…供 AI 读"子节提供，本章是顶层骨架。AI 加载顺序：

```
CLAUDE.md（= 本章 + 分章 AI 指令）
  → Anti-patterns（本文件顶部）
    → tripod.manifest.yaml（机器可读 source of truth）
      → tripod snapshot --json（运行时状态）
        → <resource>.manifest.ts（每个业务模块的索引卡）
          → 具体代码文件
```

---

## 技术栈决策

### 已定

| 层            | 选型                                                                                                                                                                                                                                                                                                                                                                                                                                             | 备注                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Backend       | **NestJS** ✅                                                                                                                                                                                                                                                                                                                                                                                                                                    | 已敲定；Python 补位留在 Tier 2 |
| 前端 Web      | **React 19.x**                                                                                                                                                                                                                                                                                                                                                                                                                                   | 用户明确指定                   |
| Mobile        | **React Native**                                                                                                                                                                                                                                                                                                                                                                                                                                 | 用户明确指定                   |
| Monorepo 工具 | **pnpm + Turborepo**（推荐）                                                                                                                                                                                                                                                                                                                                                                                                                     | 心智负担最低，RN Metro 兼容稳  |
| 首批项目形态  | 管理后台（ERP 类）、门户网站、Mobile App                                                                                                                                                                                                                                                                                                                                                                                                         | 商城暂不在首批                 |
| 业务重点      | 仓储管理 + 销售管理（百万~千万级数据）                                                                                                                                                                                                                                                                                                                                                                                                           | 影响 ORM、报表、队列选型       |
| 基建范围      | 多租户（Platform Admin + Tenant Admin + RLS）/ 登录鉴权（Provider + Session Policy + MFA）/ 权限（PermissionNode 3 type）/ 工作流（状态字段 + 乐观锁 + history 表）/ 存储（backend-proxy + 单次上传 ≤100MB）/ 通知（多渠道 + SSE）/ i18n（四语言） / 业务审计（单表 + CorrelationId）/ 观察性（GlitchTip + OTEL 插桩 + Pino stdout）/ 部署（本地 build.sh + scp + Docker + Changesets，**无 CI / 无 HTTPS 接入**）/ 上传下载 + 富文本 + 文件预览 |                                |

### Python 补位（Tier 2，默认不启用）

模板预留一个 `apps/analytics/` 空位 + NestJS Microservice transport 配置，当某项目出现**复杂聚合报表**或**大 Excel 批处理**硬瓶颈时才启用，避免默认方案复杂化。

### 后端核心栈

| 项                      | 选型                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 框架                    | **NestJS**                                                                                                                        |
| ORM                     | **Prisma**                                                                                                                        |
| DB                      | **PostgreSQL**                                                                                                                    |
| 缓存/队列               | **Redis + BullMQ**（作为应用后端使用对 RSALv2/SSPLv1 协议无影响；未来规模/风险变化时可零改动切 Valkey）                           |
| API 风格                | **REST + OpenAPI**（@nestjs/swagger 自动生成）                                                                                    |
| 鉴权                    | **Access + Refresh Token + Passport**，access 15min in memory，refresh 7–30d in httpOnly cookie / RN keychain                     |
| 时间处理                | **dayjs**（`utc` / `timezone` / `customParseFormat` / `relativeTime` 插件）— 和前端统一；所有 DB `timestamptz` 字段进出都走 dayjs |
| 金额 / 数量（精确小数） | **decimal.js** + Prisma `Decimal` 字段；DTO 用 `@Type(() => String) @IsDecimal()`；禁 `number` 参与金额/库存计算                  |

### 前端核心栈

| 项                      | 选型                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 业务状态                | **Zustand**                                                                                                               |
| 服务端态                | **TanStack Query**                                                                                                        |
| 表单                    | **React Hook Form + Zod**                                                                                                 |
| API Client 生成         | **orval / openapi-typescript**（从 NestJS 导出的 OpenAPI 生成类型化 client）                                              |
| HTTP 底层               | **axios**                                                                                                                 |
| i18n                    | **i18next + react-i18next**（Web / RN 通用）                                                                              |
| 时间处理                | **dayjs**（+ `utc` / `timezone` / `customParseFormat` / `relativeTime` 插件）— 前后端统一，禁直接 `new Date()` 做业务逻辑 |
| 金额 / 数量（精确小数） | **decimal.js**（前后端统一）— 和 Prisma `Decimal` 字段原生兼容；API 传输用 string；禁 `number` 直接参与金额运算           |

### Web UI 库（按 app 类型区分）

| App 类型                 | 默认 UI 库                        | 理由                                                                        |
| ------------------------ | --------------------------------- | --------------------------------------------------------------------------- |
| **admin-web / platform** | **AntD 5**                        | B 端管理后台事实标准（国内 ERP）；ProTable / 复杂表单现成；完整权限场景方案 |
| **portal / mall-web**    | **shadcn/ui**（Radix + Tailwind） | C 端 / 公开内容，设计更自由；copy-paste 源码灵活；SEO / 性能好              |

两栈并存**不冲突**（都用 Tailwind + React），一个项目的 admin-web 和 portal 可以用不同库。`shared-web-ui` 只含 UI 库无关逻辑组件 + hook，UI 重组件（Login 页 / Layout）各 app 自己用自己的 UI 库写。

**换 UI 库**：业务不喜欢默认库 → 跑 `/swap-ui-library` skill。三栈互换（AntD ↔ shadcn ↔ MUI ↔ Arco）有完整映射文档支撑，AI 自动完成 + smoke-test 验证。

### Mobile 核心栈

| 项             | 选型                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 框架           | **Expo（SDK 52+）+ New Architecture**                                                                                                     |
| 样式           | **NativeWind**（Tailwind 思维跨端复用）                                                                                                   |
| UI 组件库      | **Gluestack UI v2**（admin-mobile / mall-mobile 默认，NativeBase v3 继任者，copy-paste 风格类 shadcn，与 NativeWind 深度集成，AI 改友好） |
| 状态/数据/表单 | 与 Web 保持一致（Zustand / TanStack Query / RHF+Zod）                                                                                     |
| 构建           | **EAS Build 免费额度**（30 次/月）默认使用；Tier 2 提供 `infra/mobile-selfhost/` 的 Fastlane + self-hosted runner 参考                    |
| OTA 热更新     | **EAS Update 免费额度**（1000 MAU）默认使用；Tier 2 提供 expo-updates + 自托管 bundle（S3/MinIO/R2）参考实现（expo-open-ota）             |
| 证书管理       | Tier 2：fastlane match（私有 Git + 加密证书）                                                                                             |

Mobile 换 UI 库：Gluestack ↔ Tamagui ↔ RN Paper 有 `/swap-ui-library` skill 的 mobile mapping 支撑。

### 工程化

| 项                     | 选型                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 单测 / 集成            | **Vitest + Testing Library**（前后端统一）                                                                                               |
| E2E                    | **Playwright**                                                                                                                           |
| 部署                   | **Docker Engine + Compose**（Apache 2.0）起步，开发机 Docker Desktop 在小团队免费条件下适用；后续无缝切 K8s                              |
| 错误上报               | **GlitchTip**（MIT，兼容 Sentry SDK；依赖只需 Postgres + Redis，比 Sentry 自托管轻 10 倍）M2 唯一默认；未来：Sentry SaaS / 自托管 Sentry |
| APM / Trace            | **OpenTelemetry 代码插桩 M2 保留**（`OTEL_ENDPOINT` 可空），未来真需要时接 Tempo / Jaeger 零代码改动                                     |
| 结构化日志 / 指标      | **M2 只做 Pino → stdout**；Loki / Prometheus / Grafana 不默认起，真遇到线上问题时再开                                                    |
| Turborepo Remote Cache | 不启用（仅用本地缓存）；如需远程缓存，用 `ducktors/turborepo-remote-cache`（MIT）+ MinIO 自托管                                          |

### 固化 vs Adapter 分界（AI 必读）

目标是"各功能点都能适配外部工具"，但**不是所有东西都留 adapter**。换的成本 >> 留接口的价值时，固化比灵活更合理。AI 看到"固化"项就知道**不要幻想换别的**。

#### 固化项（无 adapter，换 = 架构层变更）

| 类别         | 选型                             | 为什么固化                                                                        |
| ------------ | -------------------------------- | --------------------------------------------------------------------------------- |
| Backend 框架 | NestJS                           | 换 = 整个 server 重写                                                             |
| ORM          | Prisma                           | schema / migration 都绑 Prisma；换 = 所有 DB 访问重写                             |
| DB           | Postgres                         | RLS / timestamptz / 部分索引 / JSONB 全栈依赖；换 MySQL 需大量改造                |
| 队列         | Redis + BullMQ                   | BullMQ API + 依赖 Redis；换 Kafka/SQS = 所有 Processor 重写                       |
| 日志库       | Pino                             | 换 log lib 是工具层重写；固化 + 通过 transport 配置调输出格式足够                 |
| Scheduler    | @nestjs/schedule                 | 和 NestJS 深度绑；外部定时器（K8s CronJob / APScheduler）是基础设施层而非 adapter |
| 前端框架     | React 19                         | 换 = 整个 Web + Mobile 重写                                                       |
| Mobile 框架  | Expo + RN                        | 换 Flutter = Mobile 全部重写                                                      |
| 前端状态     | Zustand                          | API 最简 + hook 自然；换 Redux Toolkit 是风格偏好，不是能力差异                   |
| 服务端态     | TanStack Query                   | 事实标准；换 SWR = 风格偏好                                                       |
| 表单         | React Hook Form + Zod            | 固化组合，gen:crud 产出绑这套                                                     |
| HTTP client  | axios（shared-api-client 包装）  | 拦截器 / progress / 重试 生态成熟                                                 |
| 样式         | NativeWind (RN) / Tailwind (Web) | gen:crud 产出绑这套                                                               |
| i18n 库      | i18next + react-i18next          | 后端单 key 匹配前端成熟组件                                                       |

这些项**换意味着重写大模块 / 整个 app**，不属于 "adapter 能解决" 的范畴。CLI 不会提供 `tripod swap-framework` 类命令。

#### 中间类：UI 库（默认 + 可换，有 skill 辅助）

UI 组件库不完全是固化（业务可换），也不是标准 adapter（没接口稳定性）。介于两者之间：

| App 类型                   | 默认 UI 库          | 换库机制                                                                    |
| -------------------------- | ------------------- | --------------------------------------------------------------------------- |
| admin-web / platform       | **AntD 5**          | `/swap-ui-library` skill：AntD ↔ shadcn ↔ MUI ↔ Arco，有完整 props 映射文档 |
| portal / mall-web          | **shadcn/ui**       | 同上                                                                        |
| admin-mobile / mall-mobile | **Gluestack UI v2** | `/swap-ui-library` skill：Gluestack ↔ Tamagui ↔ RN Paper                    |

换 UI 库**不是零改动**（要动 import 路径 + props 重命名 + 少量特殊用法调整），但有 skill 辅助 + smoke-test 验证，AI 可独立完成。**业务侧不需要薄封装层**，直接用 AntD / shadcn 各自原生 API；日常开发轻量，罕见换库事件走 skill。

#### Adapter 项（接口稳定，换实现 = 零业务代码改动）

| 能力                | 接口                          | M2 ★                                                                                    | Tier 2 ☆                                                                                         |
| ------------------- | ----------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 凭证登录            | `CredentialProvider`          | auth-email-password / auth-username-password / **auth-email-otp** / **auth-magic-link** | oauth-google / oauth-wechat / sms / SSO                                                          |
| Session 策略        | `SessionPolicy`               | MaxDevicesPolicy / SingleGlobalPolicy                                                   | PerAppPolicy                                                                                     |
| 密码恢复            | `RecoveryProvider`            | recovery-email-link                                                                     | recovery-sms / recovery-security-question                                                        |
| MFA                 | `MfaProvider`                 | （接口留，实现 M6）                                                                     | mfa-totp / mfa-webauthn                                                                          |
| 存储                | `StorageProvider`             | storage-local                                                                           | storage-s3 / storage-oss / storage-cos / storage-minio                                           |
| 通知通道            | `ChannelProvider`             | channel-email-smtp / channel-realtime-sse                                               | channel-sms / channel-push / channel-wecom / channel-dingtalk / channel-feishu / channel-webhook |
| 实时通道            | `RealtimeChannel`             | realtime-sse                                                                            | realtime-websocket / realtime-mqtt                                                               |
| 错误上报            | `ErrorReporter`               | glitchtip（Sentry SDK）                                                                 | sentry-saas                                                                                      |
| i18n 后端           | `I18nBackend`                 | i18n-file                                                                               | tolgee / crowdin / lokalise                                                                      |
| 审计后端            | `AuditBackend`                | audit-postgres                                                                          | audit-clickhouse / audit-es                                                                      |
| 缓存                | `CacheProvider`               | cache-redis                                                                             | cache-in-memory / cache-memcached                                                                |
| 前端埋点            | `AnalyticsProvider`           | analytics-null                                                                          | posthog / mixpanel / ga / segment                                                                |
| Feature flag        | `FeatureFlagProvider`         | flag-local                                                                              | flag-unleash / flag-launchdarkly                                                                 |
| **Mobile Push**     | `PushProvider`（M2 接口）     | （M5 实现 fcm / apns）                                                                  | 极光 / 个推 / 统一推送联盟                                                                       |
| **Mobile DeepLink** | `DeepLinkResolver`（M2 接口） | （M5 实现 expo-linking）                                                                | universal-link / app-link / 自定义 scheme                                                        |
| Secrets 管理        | `SecretsProvider`             | local-dotenv                                                                            | sops / vault / doppler / aws-secrets-manager                                                     |
| **支付**（mall）    | `PaymentProvider`             | **payment-mock**                                                                        | stripe / alipay / wechat-pay                                                                     |
| **物流**（mall）    | `ShippingProvider`            | **shipping-mock**                                                                       | sf / zto / yt / shippo                                                                           |
| **搜索**（mall）    | `SearchProvider`              | pg-fulltext（内置）                                                                     | meilisearch / elasticsearch / algolia                                                            |
| K8s 部署            | -                             | docker-compose                                                                          | k8s-helm-chart                                                                                   |

**判据**：能通过一致接口替换的、有明确 SaaS / 云服务候选的、"换一家供应商"是常见需求的 → 留 adapter。基础设施层选型（DB / 队列 / 框架）不在此列。

---

## 依赖策略：默认免费可用 + Tier 2 开源替代

默认依赖必须满足：**在目标使用场景（自建应用后端、小团队开发）下免费可用**。不强制 OSI 严格开源，原因是：

- 追求的是"快速启动新项目"的实用性，不是协议纯粹性
- Redis / Docker / Expo 等生态广、稳定、社区资料最多，切换成本低
- 未来规模/风险变化时再换，协议兼容或迁移成本都较低（Redis ↔ Valkey 零改动）

每项基建组件必须同时在 `adapters/` 或 `infra/` 提供**开源自托管替代方案**作为 Tier 2，当：

- 公司规模超过 Docker Desktop 免费门槛
- Expo 免费额度不够
- 担心 Redis 协议长期风险
- 需要完全自主可控

时可直接切换。每引入新依赖必须在 PR 说明中列出 License 类型和 Tier 2 替代路径。

---

## 自托管边界声明（AI 讨论部署时必读）

### Tripod 基建自身：100% 单机 docker 可自托管

M2 默认栈一台服务器 `docker-compose up` 即可跑，**零外部引用**。组成：

| 服务      | 镜像                  | 用途                                   |
| --------- | --------------------- | -------------------------------------- |
| postgres  | `postgres:17`         | 主 DB                                  |
| redis     | `redis:8-alpine`      | 缓存 / 队列 / 分布式锁 / idempotency   |
| minio     | `minio/minio`         | S3 兼容对象存储（storage adapter）     |
| mailhog   | `mailhog/mailhog`     | 开发 SMTP（生产换中继 / 自建 Postfix） |
| glitchtip | `glitchtip/glitchtip` | 错误上报（Sentry 协议兼容）            |

加上 server / admin-web / platform / portal 业务容器，5~6 个容器即全套。所有 npm 包（NestJS / Prisma / React / Expo / axios / dayjs / Pino / ...）都是代码库，不依赖任何外部服务。

### 所有 M2 默认 adapter 都是本地实现

```
storage-local / notification-smtp / realtime-sse / auth-email-password /
audit-postgres / cache-redis / error-reporting-glitchtip / i18n-file /
analytics-null / flag-local / secrets-local-dotenv / push-null
```

都不需要外部引用。

### 业务 adapter 接口（不属 tripod 自托管范围）

下列 adapter 的**接口**在 tripod 里（接口稳定，便于项目组接入），但**具体接哪家 SaaS 是业务项目决定**，不是 tripod 要自托管的东西：

| 类别                                                         | 典型场景                | 说明                                                                                                        |
| ------------------------------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| 商业支付（Stripe / 支付宝 / 微信支付）                       | B2C 商城                | B2B ERP 不需要；真要接属业务对接第三方，不是 tripod 基建                                                    |
| OAuth 第三方登录（Google / GitHub / 微信 / 企业微信 / 钉钉） | 社交登录 / 企业 SSO     | 依赖外部 IdP；tripod 提供 `CredentialProvider` 接口，默认只给 email-password                                |
| 短信 SMS（阿里云 / 腾讯云 / Twilio）                         | 验证码 / 营销           | 运营商通道，无自托管方案；tripod 提供 `ChannelProvider.sms` 接口                                            |
| Mobile 推送（FCM / APNs / 极光 / 统一推送联盟）              | iOS / Android 通知      | **Apple / Google 操作系统级政策，任何框架都不可自托管**；tripod 提供 `PushProvider` 接口，M2 默认 push-null |
| Mobile 打包签名 / 商店发布                                   | App Store / Google Play | Apple / Google 强制，不是 tripod 可解决的层级；EAS 免费 / 自备 macOS + Fastlane                             |

**关键判据**：tripod 提供接口稳定 → 业务项目需要时 `tripod add-adapter <slot>=<impl>` 按需接 → 具体外部依赖是业务选择。

### 讨论边界

- 问"tripod 能本地部署吗" → **基建栈 100% 本地**，上表 7~8 个容器即可
- 问"xxx adapter 自托管方案" → 分两类：
  - 技术上**可自托管**（analytics PostHog / flag Unleash / i18n Tolgee / secrets Vault / SSO Keycloak）→ Tier 2 需要时激活，`tripod add-adapter` 按需补 docker-compose 片段，**不预装**
  - 技术上**不可自托管**（FCM / APNs / 商业支付 / 商业 SMS）→ 业务选不选择的是它，tripod 只负责接口稳定
- 问"我要不要接 xxx SaaS" → 业务需求问题，不是 tripod 设计问题

### 反模式（AI 不要做）

- **预装 Tier 2**：把 PostHog / Unleash / Tolgee / Keycloak 等写进默认 compose — 每个项目装一堆用不上的容器占资源，违反"按需激活"
- **替业务决定接不接 SaaS**：用户不说接支付就不要建议接 Stripe；不说接社交登录就不要提 OAuth
- **把业务 adapter 的外部依赖说成"tripod 的外部引用"**：这混淆了"tripod 基建" 和 "项目业务侧第三方对接"的边界

---

## 模板交付总原则（AI 必读 — 所有 app 模板都遵守）

Tripod 模板不是"空骨架让业务填"，而是"**能跑的生产级半成品**"。三条总原则贯穿 7 种 app 模板设计：

### 原则 1：逻辑 adapter 完整实现 + UI 基础可替换

**定位**：tripod 提供**完整生产级逻辑**（业务不写），UI 只提供**基础骨架**（业务可整体替换）。

| 层                    | tripod 交付                                                                                                                                       | 业务职责                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Adapter 完整逻辑**  | 鉴权流 / 权限校验 / 错误处理 / refresh token / OTP 发送 + 校验 / 文件分片 / 通知发送 / 审计写入 / idempotency / 软删除 / RLS / ... 全套生产级实现 | 不写，不改                           |
| **hook / service 层** | `useAuth()` / `usePermission()` / `useNotifications()` / `PrismaService` / ... 暴露给业务                                                         | 调用即可                             |
| **UI 基础骨架**       | LoginPage / AppLayout / ErrorPages / NotificationCenter 等**能跑**的基础版本                                                                      | **可整体替换**（保留逻辑 hook 调用） |
| **业务模块**          | `gen:crud <resource>` 脚手架产出                                                                                                                  | 改字段 / 改状态流 / 加业务规则       |

**示例（登录场景）**：

- tripod 提供：`CredentialProvider` 接口 + `auth-email-password` / `auth-email-otp` / `auth-magic-link` 等 adapter **完整后端实现**（OTP 生成 / 防暴力破解 / Redis TTL / 发邮件走 channel / token 签发 / refresh 轮换 / 401 族检测），**前端 `useAuth()` hook 完整暴露**：`loginWithEmailPassword`, `requestEmailOtp`, `verifyEmailOtp`, `sendMagicLink`, ...
- tripod 提供：LoginPage 基础骨架 — 读 `tripod.config.yaml` 的 `auth.credential` 数组动态渲染 tab / 按钮
- 业务可以：**整体替换 LoginPage.tsx**（品牌插画 + 定制布局），保留 `useAuth()` hook 调用；登录逻辑保持不变

**UI 改三种程度**：

| 程度                 | 做什么                                         | 耗时    |
| -------------------- | ---------------------------------------------- | ------- |
| **轻改**（90% 场景） | 改 tailwind 色板 / logo / 文案                 | 30 分钟 |
| **中改**             | 替换某个子组件（如 EmailOtpForm 换自定义样式） | 半天    |
| **重改**             | 整个 LoginPage 从头写，hook 调用保持           | 1-2 天  |

### 原则 2：登录方式（和所有 adapter）按项目需求"组合选择"

业务通过 `tripod.config.yaml` **任意组合启用 adapter**，零业务代码改动：

```yaml
auth:
  credential: [email-password, email-otp] # 只要两种
  recovery: [email-link]
  mfa: [] # 不开 MFA
```

或：

```yaml
auth:
  credential: [email-otp, magic-link, oauth-wechat] # 三种
  recovery: [email-link]
  mfa: [totp]
```

`tripod add-adapter auth.credential=oauth-google` 一条命令增加，LoginPage 自动渲染新按钮。

**这套"组合选择"机制适用于所有 adapter 能力**：notification channel / storage backend / payment / analytics / feature flag / mfa / i18n backend 等。

### 原则 3：所有 tripod 文档 AI 友好（强制）

Tripod 所有文档（plans / docs / README / SKILL.md）**强制**遵守：

| 规则                       | 做什么                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| **结构化优先于散文**       | 表格 / 清单 / 代码示例，不写大段段落                                                                    |
| **决策结论前置**           | 先说"选 X"，再说理由；不让 AI 通读全文才知道结论                                                        |
| **每个概念一行定义**       | 不用"在某些情况下可能需要考虑..."这种虚描述                                                             |
| **代码示例可复制**         | 不用伪代码；示例即真实可运行                                                                            |
| **组件 / API 清单 = 表格** | 每个组件一行 props + 典型用法 + 禁用点                                                                  |
| **"AI 读解路径"小节**      | 每个大章节末尾有，列出 AI 处理典型诉求时的步骤                                                          |
| **单文件 ≤ 1000 行**       | 超了拆                                                                                                  |
| **配对文档约定**           | 每种 app 模板配 `docs/templates/<type>/{README, components, pages, customization, testing}.md` 五个文件 |

**AI 文档自检**：`tripod doctor` 检查 `docs/` 下 md 文件 —— 平均段落 > 80 字 warn（提示"拆清单"），单文件 > 1000 行 error。

### 三条原则的共同目的

**让 AI 能独立完成从 "拉下来" 到 "业务可上线" 的完整链路**：

```
用户: pnpm create tripod my-erp --recipe=erp-standard
AI:   [读 docs/templates/admin-web/customization.md]
      [跑 gen:crud 产出 customer/order 模块]
      [按用户要求改 UI（轻改色板 / 中改登录页 / 重改 LoginPage）]
      [跑 swap-ui-library skill 换 UI 库（如需）]
      [跑 smoke-test 验证]
      "完成，admin@demo.local / demo1234 可登录，业务跑通。"
```

业务方的人（含非工程师）只需要：告诉 AI 要什么业务 + 审阅产出。

---

## 架构关键原则

### 1. 基建层 UI-Agnostic

`shared-auth` / `shared-permission` / `shared-api-client` / `shared-i18n` / `shared-logger` 等**不依赖任何 UI 库**，只导出：

- Hooks（useAuth / usePermission / useApi）
- Stores（Zustand store factory）
- Primitives（守卫函数、装饰函数、guard HOC）
- 契约接口（TypeScript interface）

UI 库（AntD / shadcn / Arco / ...）由各 app 自选，基建不感知。这样切换 UI 库或引入新 UI 风格不影响基建包。

### 2. 代码驱动 CRUD，不做 Schema-driven / 低代码

**明确否决** Schema 驱动表单/表格（Formily / ProTable 这类）和低代码平台模式。理由：

- Schema 配置一旦脱离代码，维护和扩展成本反而高于直接写代码
- 类型安全和 IDE 支持被 JSON Schema 削弱
- 复杂业务逻辑（条件校验、联动、异步校验）Schema 表达力不足，最终都要 escape hatch，反而复杂度翻倍
- 团队上手成本高，代码 review 和调试流程被割裂

**替代方案**：以**代码 + 脚手架（scaffold generator）+ 约定**提效：

- 统一 `BasePage / BaseList / BaseForm` 组件封装分页、筛选、批量操作等通用交互
- 脚手架命令 `pnpm gen:crud order` 生成前后端 CRUD 代码骨架（controller + service + prisma model + DTO + page + list + form + hooks），直接读/改真实 TypeScript 文件
- 约定 React Hook Form + Zod + TanStack Query 的固定写法范式，文档和 code review 保证一致
- UI 库选定后（M3），脚手架产出的 JSX 基于 UI 库原生组件

权限系统的 L2（"admin 自定义页面挂权限"）**同步放弃**，只做 L1（开发者埋点 + admin 勾选角色）。

### 3. 长流程 / 多步骤工作流（详见"工作流引擎详细设计"章节）

仓储/销售的长流程采用**状态字段 + 乐观锁 + history 表 + Prisma 事务**：

- `packages/shared-workflow`：极薄包，只提供通用 state history 查询 API；状态判断 / 守卫 / 事务在各业务 service 自己写
- 状态转换原子性：乐观锁 update + 同事务写 `{Entity}StateHistory`
- 不自实现 DSL、不默认 Outbox、不抽 FlowProducer 封装 —— 真遇到瓶颈再按需加

#### NestJS vs FastAPI 对比结论

| 维度                | NestJS                                     | FastAPI                | 胜者    |
| ------------------- | ------------------------------------------ | ---------------------- | ------- |
| 前后端类型共享      | workspace 包零成本共享 DTO                 | 需 OpenAPI codegen     | NestJS  |
| Monorepo 包管理     | 单一 pnpm                                  | JS + Py 双栈           | NestJS  |
| ERP 重型后台        | DI / 装饰器 / Guard / Interceptor 正好对应 | 需自行组织             | NestJS  |
| Rust 扩展路径       | NAPI-RS（成熟）                            | PyO3 + maturin（成熟） | 平      |
| 部署镜像 & 冷启动   | 略轻                                       | 略快启动               | 平      |
| AI / 数据 / ML 生态 | 弱                                         | 强                     | FastAPI |
| 实时 / WebSocket    | 原生 Gateway                               | 弱                     | NestJS  |

**推荐路径**：以 NestJS 为主框架，未来若需 AI / ETL / 数据管道，以 NestJS Microservices 方式挂 FastAPI 侧车服务（Redis / NATS / gRPC），兼得两者优势。

### 4. CorrelationId 必达（跨进程可追溯）

所有跨进程调用（HTTP 入站/出站、BullMQ job、外部回调、SSE 推送）必须携带 `correlationId`，贯穿整条处理链路。

**约束**：

- HTTP middleware 读 `X-Correlation-Id` header，缺失则生成（`{resource}:{id}` 或 ULID）
- AsyncLocalStorage 保存 cid，pino logger 自动注入每行日志
- BullMQ job data 必带 `correlationId` 字段，worker 启动时恢复 ALS 上下文
- 出站 HTTP 调用自动把当前 cid 塞进 `X-Correlation-Id` header
- 外部回调（支付/物流）payload 必须能还原 cid（via metadata / orderId 反查）
- Sentry / GlitchTip tag、业务审计 log `correlationId` 列强制填充

**强制手段**：shared-contract 提供 `@WithCorrelation` 装饰器 + ESLint plugin 检测裸调 HTTP/queue 的场景，husky pre-push 必过。

### 5. tenantId 必达（多租户数据隔离）

所有 DB 操作必须走 `PrismaService`（内置 tenant middleware），禁止直接实例化 `new PrismaClient()`。

**约束**：

- 业务代码只能通过 `@Inject PrismaService` 取客户端；middleware 自动 `where tenantId` + 写时自动填
- 必须的跨 tenant 场景（platform admin / 后台脚本）显式调 `prisma.$unscoped(() => ...)` 开绕过，审计日志强制记录
- 每请求在事务里 `SET LOCAL app.tenant_id`，RLS 做兜底
- 新增业务表 generator 强制生成 `tenantId` 列 + RLS policy

**强制手段**：ESLint rule 禁止 `import { PrismaClient } from '@prisma/client'`（除 PrismaService 内部）；`pnpm lint:prisma` 扫 schema 强制每张业务表带 tenantId。

### 6. 外部写调用必须幂等

任何"写类"外部调用（支付、发货、第三方 API、对内关键 job）必须带 `Idempotency-Key`。

**约束**：

- `shared-contract` 提供 `IdempotencyInterceptor`：读 `Idempotency-Key` header（或 job data 里同名字段），Redis 记录 `(key, response)` 24h
- 重复请求直接返回首次结果，不再执行业务逻辑
- 内部 BullMQ job `jobId` 用业务幂等键（如 `pay:order-123:attempt-1`），BullMQ 天然去重
- 支付/物流等关键调用，`Idempotency-Key` 建议用 `{business}:{entityId}:{attempt}` 格式

**强制手段**：payment / shipping / notification 相关 controller 路由若未加 `@Idempotent()` 装饰器，CI 测试失败。

### 7. Secrets 禁入 Git

任何密钥、token、证书、数据库密码**永远不得**提交到代码仓库（包括 `.env` 文件）。

**约束**：

- 仓库只保留 `.env.example`（占位值）；真 `.env` / `secrets/.env.prod` 全部 gitignore
- 本地 `secrets/` 目录维护所有环境真值（.env.prod / .env.staging），打包时随产物一起 scp 到 server（M2 默认方案，见 CI/CD 章节）
- 本地磁盘必须启用加密（Mac FileVault / Win BitLocker），secrets 建议额外备份到 1Password / Bitwarden
- 打包前强制 `pnpm tripod env:validate secrets/.env.prod` 校验：缺失字段 / 非法格式 / 危险默认值任一命中则 fail-fast，阻断打包
- pre-commit hook：`gitleaks protect --staged` 阻断含密钥 commit
- 发现历史泄露：立即轮换对应密钥，不是 `git rm` 了事（历史永在）

**强制手段**：`.husky/pre-commit`（gitleaks）+ `build.sh` 首步（env:validate）双层防护，任一命中阻断。

### 8. 时间处理统一走 dayjs（禁 `new Date()` 做业务）

任何业务代码（API / service / controller / 前端）涉及"业务时间"的地方**只准用 dayjs**。

**约束**：

- 前后端统一 `dayjs` + 四个默认插件：`utc` / `timezone` / `customParseFormat` / `relativeTime`（M2 在 `shared-utils` 里统一 init，业务 import `dayjs` 即带插件）
- DB 层：所有时间字段用 `timestamptz`（`DateTime` in Prisma），UTC 存储；Controller 出入参用 ISO 8601 字符串
- 业务代码对时间做运算 / 比较 / 格式化 / 时区转换：`dayjs(x).utc().tz('Asia/Shanghai').add(7, 'day').format(...)`
- 用户展示：`shared-i18n` 导出 `formatDate(date, { locale, tz })` 工具，内部走 dayjs，组件层不直接调 dayjs 的 `.format()`（避免各处写死格式字符串）
- 解析非标准格式字符串：用 `dayjs(str, 'YYYY-MM-DD HH:mm:ss')`（`customParseFormat` 插件）
- 相对时间（"3 天前"）：`dayjs(x).fromNow()`（`relativeTime` 插件）

**禁**：

- `new Date()`、`Date.now()`（M2 例外：日志 / 审计 / 测试 fixture 里系统时间可用，但业务 service **不**得出现）
- `moment`（包体积大 + 已不活跃）/ `date-fns`（API 风格不同，保持单库）
- `toLocaleString()` / `toLocaleDateString()`（时区/locale 行为不可控）
- 字段名 `*Timestamp: number`（毫秒数字段）—— 统一 `*At: DateTime`

**强制手段**：ESLint rule `tripod/no-raw-date`（自定义）扫 `new Date()` / `Date.now()` 在 `apps/*/src/**` 和 `packages/shared-*/src/**` 使用，except `logger` / `audit` / `test` 子目录 allowlist。

### 9. 金额 / 数量（精确小数）走 decimal.js（禁 `number` 做业务）

任何业务语义上的"钱 / 数量 / 单位 / 汇率 / 百分比"字段，**禁用 JS `number`** 参与运算。

**约束**：

- 选型：**`decimal.js`**（前后端统一，默认精度 29，rounding 默认 `ROUND_HALF_EVEN` 银行家舍入）
- DB：Prisma `Decimal` 类型（精度/标度在 schema 声明，如 `@db.Decimal(18, 4)` 金额 / `@db.Decimal(18, 3)` 数量）
- 传输：API 层所有 `Decimal` 字段序列化为 **string**（`"123.4500"`），前端再 `new Decimal(str)` 解析
  - DTO 约定：`@Expose() @Type(() => String) @IsDecimal({ decimal_digits: '0,4' }) amount: string;`
  - 后端 `ClassSerializerInterceptor` + 全局 `Decimal → string` transformer（`shared-contract` 提供）
- 显示：`shared-i18n` 导出 `formatMoney(dec, { currency, locale })` / `formatQuantity(dec, { unit })` 工具，组件层不直接 `.toFixed()`
- 运算：`a.plus(b).times(c).dividedBy(d)` — decimal.js API；服务端事务里 sum/avg 走 Prisma `$queryRaw` 返回 `Decimal` 后再用 decimal.js 继续运算

**禁**：

- `number` 类型的金额 / 库存 / 数量字段（DTO / Entity / 前端 state 均禁）
- `parseFloat` / `Number()` 作用在金额字符串上
- 金额字段做 `a + b * c` 原生运算符
- `toFixed()` 做业务计算（只允许用在最终展示）

**强制手段**：

- ESLint rule `tripod/no-number-for-money`（自定义）：DTO 字段名匹配 `/(price|amount|cost|fee|total|quantity|qty|stock|rate|ratio|balance)$/i` 且类型是 `number` → error
- Prisma lint 检查：schema 里上述字段名必须是 `Decimal` 类型
- ESLint rule `tripod/no-parsefloat-on-money`：禁在 `apps/*/src/**` 用 `parseFloat` / `Number(string)`，例外走显式注释

---

## 多租户架构（模式 A：全局账号 + Membership）

### 账号与公司模型

- `User` 全局唯一（邮箱全局唯一）
- `Tenant`（= Company）独立实体
- `TenantMembership` 关联表：一个 User 可加入多家 Tenant
- **角色挂在 Membership 上**（不同公司里角色可不同，如 Alice 在 ACME 是 warehouse-manager、在 Globex 是 sales）

### 两层管理员

| 层级               | 身份                                              | 作用域      | 能力                                                          |
| ------------------ | ------------------------------------------------- | ----------- | ------------------------------------------------------------- |
| **Platform Admin** | User 表 `isPlatformAdmin=true`，不加入任何 tenant | 全局平台    | 创建/停用 Tenant、指定首位 tenant admin、全平台审计、系统配置 |
| **Tenant Admin**   | Membership.roles 含 `tenant-admin`                | 自己 tenant | 创建本公司员工、配置本公司角色、业务数据管理                  |

两种 admin 是**不同身份**，不是继承关系（类比 GitHub 站点管理员 ≠ Org Owner）。

### 四入口物理分离

```
apps/
├── server/     NestJS 后端，共用
├── platform/   ⭐ 超管控制台（platform.example.com） — 强制 TOTP + 单设备 + 独立 SessionPolicy
├── admin/      普通公司后台（admin.example.com） — tenant admin + 员工
├── portal/     门户/官网
└── mobile/     员工手机端
```

Platform admin token 带 `{ platformAdmin: true, tenantId: null }`，只被 `/platform/**` 路径接受；进入业务 API 拒绝。

### 数据隔离双层防线

**第一层：Prisma Middleware（应用层）**

- 读：`findMany / findFirst / findUnique / count / aggregate` 自动加 `where tenantId`
- 写：`create` 自动填 `tenantId`；`update / delete` 自动加 `where tenantId`
- 从 async-local-storage 读取当前 request 的 tenantId

**第二层：PostgreSQL Row-Level Security（DB 层）**

- 每张业务表 `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY tenant_isolation USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`
- NestJS `TenantContextInterceptor` 每请求执行 `SET LOCAL app.tenant_id = '...'`
- 兜底 raw SQL / psql 手连 / middleware bug

**例外通道**：`BYPASSRLS` DB 角色给维护脚本，`{ system: true }` JWT claim 给 Platform Admin，必须审计日志。

每张业务表规范：

- 必有 `tenant_id UUID NOT NULL` 列
- 必有 `(tenant_id, ...)` 复合索引
- 必有 `ENABLE RLS` + `CREATE POLICY`
- 提供 generator 脚本，新建表时一键生成以上

### 登录两阶段流程

```
POST /auth/login
{ provider, credential, device }
  ↓ CredentialProvider 验证
  ↓ 查 TenantMembership
  ├─ 1 家 → 直接发 tenant-scoped token（embed tenantId + tenantRoles + permissions）
  └─ 多家 → 返回 { status: 'tenant-required', preAuthToken, memberships: [...] }

POST /auth/login/tenant
Authorization: Bearer <preAuthToken>
{ tenantId }
  ↓ 发 tenant-scoped token
```

**切换公司**：`POST /auth/switch-tenant` → 老 session 吊销，发新 token。

### Session Policy Scope

- `scope: 'global'`（默认）：用户全局最多 N 设备（一人就一台电脑）
- `scope: 'tenant'`：每 tenant 独立计数（白标场景）

### 注册/邀请三路径

| 路径           | 描述                                                                                  | 默认        |
| -------------- | ------------------------------------------------------------------------------------- | ----------- |
| **邀请制**     | Platform admin 创建 tenant + 首位 tenant admin；tenant admin 后台创建员工并设初始密码 | ✅ M2       |
| **自助创建**   | 用户注册同时创建 tenant 自任 owner                                                    | Tier 2 配置 |
| **子域名门户** | `acme.example.com/register` 默认加入 ACME                                             | Tier 2 配置 |

首次登录强制改密：User 表 `mustChangePassword` 字段 + JWT claim 携带，前端 hook 强制导航到改密页。

### 邀请流程（M2 默认）

邀请制是 M2 默认路径，支持两种子形态，**任选其一 / 或同时开**（config 开关）：

| 形态                   | 流程                                                                                       | 何时选                                          |
| ---------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| **A. 直建 + 初始密码** | Tenant admin 后台填邮箱 + 手工设初始密码 → 告知员工 → 员工首次登录强制改密                 | 小团队（≤ 20 人）、员工邮箱不活跃、现场口头交接 |
| **B. 邀请链接**        | Tenant admin 发邀请 → 系统发 email/SMS 带 token 链接 → 员工点链接设自己的密码 → 直接进系统 | 跨城市 / 员工散 / 邮箱活跃                      |

**邀请 token 数据模型**（`TenantInvitation` 表）：

```prisma
model TenantInvitation {
  id             String    @id @default(uuid())
  tenantId       String
  email          String                          // 被邀请邮箱（允许未注册 User）
  tokenHash      String                          // 原 token 只出现在邀请链接里，DB 只存哈希
  proposedRoles  String[]                        // 接受后自动挂的角色
  invitedByUserId String
  status         InvitationStatus                // PENDING / ACCEPTED / EXPIRED / REVOKED
  expiresAt      DateTime                        // 默认 7 天，可 config
  acceptedAt     DateTime?
  acceptedUserId String?
  createdAt      DateTime  @default(now())

  @@index([tenantId, status, expiresAt])
  @@index([email])                               // 接受时按 email 反查
}

enum InvitationStatus { PENDING ACCEPTED EXPIRED REVOKED }
```

**邀请 API 契约**（M2 精简版）：

```
POST   /tenants/:tenantId/invitations                   # Tenant admin 发起邀请（单个或批量）
GET    /tenants/:tenantId/invitations?status=...        # 列出本租户邀请
PATCH  /tenants/:tenantId/invitations/:id/revoke        # 作废未接受的邀请

# 被邀请者用：
GET    /invitations/accept?token=<raw>                  # 校验 token 有效性（未过期 / 未撤销 / 未接受）
POST   /invitations/accept                              # { token, password, name } 完成接受
                                                         # 服务端：建/找 User（按 email）→ 建 Membership → 自动登录
```

**不做**（Anti-patterns）：

- **不做 `resend` 端点** —— 想重发就 `revoke` + 新建 invitation 两步完成（两个 API 调用 = 两次审计记录，链路更清晰）
- **不做 SMS 渠道** —— 模型不留 `phone` 字段；真上 SMS 时 migration 加字段 + 加 channel adapter
- **不做"同一 email × tenant 24h N 次"防滥用计数** —— 单人 / 小团队场景不现实；真有滥用再上 `shared-cache` 计数

**实现要点**：

- token 生成用 `crypto.randomBytes(32).toString('base64url')`，原 token 只发给用户；DB 存 `sha256(token)` 防泄露
- 邀请邮件通过 `shared-notification` 的 `invitation:created` NotificationType 发送（email-smtp）
- 过期 CRON（`shared-scheduler` 全局日任务）：`UPDATE SET status='EXPIRED' WHERE status='PENDING' AND expiresAt < NOW()`
- 审计：`invitation.created / .revoked / .accepted` 三个 action 写入 BusinessAuditLog
- 多租户：`TenantInvitation` 表按 `tenantId` 隔离，Tenant admin 只能操作本租户邀请

### 账号管理 API

账号生命周期分**三个视角**，API 路径物理分离，不互相绕过：

| 视角                           | 路径前缀                        | 用途                                                        |
| ------------------------------ | ------------------------------- | ----------------------------------------------------------- |
| **Platform admin**（超管）     | `/platform/**`                  | 建/停/删 Tenant、指定首位 Tenant admin、全平台用户强制登出  |
| **Tenant admin**（公司管理员） | `/tenants/:tenantId/members/**` | 管理本公司成员（含员工账号），不改 User 的邮箱/密码策略本身 |
| **Self**（普通用户自己）       | `/me/**`                        | 改自己密码 / 改自己资料 / 看/撤销自己的 session             |

**Platform 侧 API（`apps/platform`，仅超管可达）**：

```
POST   /platform/tenants                        # 创建 Tenant + 首位 Tenant admin
                                                  # body: { tenantName, adminEmail, adminPassword? | sendInvite: true }
PATCH  /platform/tenants/:id/disable            # 停用 tenant（保留数据，拒绝登录）
PATCH  /platform/tenants/:id/enable             # 恢复
DELETE /platform/tenants/:id                    # 软删 + 90 天 purge（走软删除约定）
GET    /platform/users?email=...                # 全局查人（跨租户，审计必写）
POST   /platform/users/:id/force-logout         # 全平台强制下线（session 吊销 + token 黑名单）
```

**Tenant 侧 API（`apps/admin-web`，Tenant admin 可达）**：

```
GET    /tenants/:tid/members                    # 列出本租户成员
POST   /tenants/:tid/members                    # 直建账号（形态 A，须填 adminSetPassword）
                                                  # 底层：upsert User by email → 创建 Membership → mustChangePassword=true
PATCH  /tenants/:tid/members/:userId            # 改本租户内的角色 / 状态（不动 User 本身）
PATCH  /tenants/:tid/members/:userId/disable    # 停用本租户内的身份（其他租户不受影响）
DELETE /tenants/:tid/members/:userId            # 移出本租户（Membership 软删，User 保留）
POST   /tenants/:tid/members/:userId/reset-password  # 生成临时密码 + mustChangePassword=true
```

**Self API（任意登录态用户）**：

```
GET    /me                                      # 自己的 profile + memberships 列表
PATCH  /me                                      # 改名字 / 头像 / locale
POST   /me/change-password                      # 必传旧密码
GET    /me/sessions                             # 看自己所有设备的登录
DELETE /me/sessions/:id                         # 踢掉某个设备
```

**权限约束**（走现有 PermissionNode 3 type）：

- Platform 侧接口走 `{ platformAdmin: true }` JWT claim 校验，不走 tenant PermissionNode
- Tenant 侧接口走 `tenant-admin` 角色自带的 `member:*` 权限集合（seed 时预置）
- Self API 无需 PermissionNode，只校验 `req.user.id === :userId`

**审计**：上述**所有写操作**都要写 `BusinessAuditLog`，`entityType='user'` 或 `'membership'`，`action` 如 `member.created / member.disabled / password.reset-by-admin` 等。

### 员工模块扩展接入点（后期开发钩子）

用户需求：**基础账号后期要能平滑扩展为"员工管理"**（带工号 / 部门 / 入职日期 / 直属上级 / 绩效 / 薪资 等业务字段）。

**设计原则（不变）**：

- `User` / `Tenant` / `TenantMembership` 三张基建表**不污染业务字段**，保持通用
- 员工业务字段通过新建业务模块 `apps/server/src/employee/` 扩展，是**标准业务模块**走 §新增业务模块完整流程
- 基建永远不理解"员工"这个概念，只管"身份 + 登录 + 权限"

**扩展路径**：

```prisma
// apps/server/prisma/modules/employee.prisma   ← 业务模块自己建
model Employee {
  id             String    @id @default(uuid())
  tenantId       String                             // 必，按 §4.1 6 件套
  membershipId   String    @unique                  // 1:1 对应某条 Membership
  userId         String                             // 冗余方便查询（真值仍在 Membership）

  // 业务字段（用户自己定）
  employeeCode   String                             // 工号
  departmentId   String?
  position       String?
  hireDate       DateTime?
  managerId      String?                            // 自关联 → 上级员工
  status         EmployeeStatus

  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([tenantId, departmentId])
  @@index([tenantId, employeeCode])
  @@index([tenantId, managerId])
}
```

**接入钩子（M2 只留一个，零实现）**：

**`MembershipLifecycleHook` 接口**（`shared-auth` 导出）

```ts
export interface MembershipLifecycleHook {
  onMembershipCreated?(ctx: {
    tenantId: string;
    userId: string;
    membershipId: string;
    via: 'direct' | 'invitation';
  }): Promise<void>;
  onMembershipDisabled?(ctx: {
    tenantId: string;
    userId: string;
    membershipId: string;
  }): Promise<void>;
  onMembershipDeleted?(ctx: {
    tenantId: string;
    userId: string;
    membershipId: string;
  }): Promise<void>;
}
```

- `shared-auth` 的 `MembershipService` 在 create / disable / delete 时调所有注册的 hook
- M2 默认 hook 列表为空；业务模块自己实现并在 `@Module({ providers: [...] })` 里注册
- Employee 模块自己写 `EmployeeOnboardingHook implements MembershipLifecycleHook`，在 `onMembershipCreated` 里打开"待补员工信息"任务（Employee 记录由 HR 管理员在专门页面补齐，不由 Tenant admin 的成员邀请流程携带）

**不做**（Anti-patterns）：

- **不做 `createMember` API 的 `metadata` 参数透传** —— 同样的事用 hook 已能完成，多一条路径就得维护两套心智
- **不做 Tenant admin 后台的 `<MemberExtraColumns>` UI slot** —— M2 没 UI 库；真做时 Employee 模块自己在"员工管理"页渲染，不污染通用成员页

**何时真正新建 Employee 模块**（不是 M2，按项目需要）：

- 业务出现"按部门查数据"/"员工离职交接"/"绩效考核"/"薪资关联"等诉求时
- 用 `/spec-driven-testing employee` → `pnpm tripod gen:crud employee` 走完整流程
- 然后实现 `EmployeeOnboardingHook` 并在 `EmployeeModule` 注册

**铁律**：Employee 模块是**业务代码**，不进 `@tripod-stack/shared-*`。Tripod 只提供 `MembershipLifecycleHook` 接口，不提供 Employee 实现 / schema / 样板。

**验收标志**：

- M2 跑起来能做完整 "Platform admin 建 Tenant + Tenant admin 发邀请 + 员工接受邀请 + 员工登录 + Tenant admin 停用员工" 全链路
- M2 不含任何 Employee 代码（包括表、controller、service）
- 用户随时可新建 Employee 业务模块，通过 hook 自动衔接 Membership 生命周期，基建不用任何改动

### AI 读解路径（多租户）

AI 写业务代码前必记（core §4.1 已摘要，此处更详）：

- **取 client**：永远 `@Inject PrismaService`，禁 `new PrismaClient()`，ESLint rule 会 CI fail
- **新建业务表 6 件套**：`tenantId UUID NOT NULL` 列 / `[tenantId, ...]` 复合索引 / `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY tenant_isolation` / middleware 自动加 where / Seed 数据必 seed `default-tenant`
- **跨租户例外**：`prisma.$unscoped(() => {...})` + 审计日志必写 + `{ system: true }` JWT claim（Platform Admin）+ `BYPASSRLS` DB 角色（维护脚本）
- **测试**：`createTestTenant()` fixture 创建临时 tenant + 自动清理；禁硬编码 tenantId
- **Seed**：M1 就建 `default-tenant`，所有业务数据归属它 —— "后期加 platform 零数据迁移"靠这条
- **访客 / 公开场景**（门户 / 商城未来）：`@Public()` 装饰器 + `PermissionNode.public: true` 走 AuthGuard 跳过；AI 现阶段不加这些
- **建新表 generator**：`pnpm tripod create-tenant-table.ts --mode=tenant-only|public-readable` 一键产 schema + RLS policy + migration，AI 手写建表**必须**走 generator，不直接贴 Prisma model

**AI 诊断路径**：用户说"数据看到别的租户的"/"租户隔离失效"：

1. 跑 `tripod snapshot` 看 `prisma.driftDetected`
2. 查用户 controller 是否漏 `@CurrentUser()` + `@RequirePermission`
3. 查 DB：`psql -c "SHOW row_security"`（应为 on）
4. 查 service：是否意外调了 `$unscoped`
5. 确认 `TenantContextInterceptor` 有 `SET LOCAL app.tenant_id`

---

## Platform 模块能力清单（总部 / SaaS 控制台）

### 设计基调

`apps/platform` 是"总部"或"SaaS 管理控制台"入口（`platform.example.com`），和 `apps/admin-web`（tenant 管理后台）**物理分离**。两个视角：

- **Tenant Admin**（`admin.example.com`）：管自己 tenant 的业务（订单、客户、员工、配置）
- **Platform Admin**（`platform.example.com`）：管**所有 tenant**（开户、配额、计费、跨租户审计、feature flag 灰度、紧急介入）

Platform 是 Tripod 针对"ERP + SaaS / 多公司"场景的差异化价值。即便单公司单 tenant 场景，保留 platform 便于后期扩多公司。

### M2 默认能力清单（必做）

#### 1. Tenant 生命周期管理

- **创建 tenant**：`POST /platform/tenants`
  - 必填：slug（子域用，唯一）+ name + 初始 tenant-admin 邮箱
  - 可选：timezone / locale / featureFlags / quotas
  - 创建时自动：DB 建 Tenant 行 + default 角色 + RLS policy 应用 + 发邀请邮件
- **激活 / 暂停 / 恢复**：`PATCH /platform/tenants/:id/status`（active / suspended / archived）
  - suspended：tenant admin 登录被拒 + API 返 `TENANT_SUSPENDED`（402）+ 所有 BullMQ job 跳过
  - archived：软删，180 天后硬删（沿用软删除 GC）
- **修改 tenant 配置**：timezone / locale / 默认角色模板
- **迁移 tenant**（Tier 2）：从一个 DB 实例迁到另一个（分库场景）

Prisma schema（M1 就建骨架）：

```prisma
model Tenant {
  id           String   @id @default(uuid())
  slug         String   @unique        // 子域名 + API URL 里用
  name         String
  status       TenantStatus @default(active)   // active / suspended / archived
  timezone     String   @default("Asia/Shanghai")
  locale       String   @default("zh-CN")
  featureFlags Json     @default("{}")
  quotas       Json     @default("{}")  // { userCount: 50, storageGB: 10, monthlyApiCalls: 1000000 }
  billingPlan  String?                   // 计费方案 id（Tier 2 billing 接入）
  createdBy    String?                   // platform admin user id
  createdAt    DateTime @default(now())
  suspendedAt  DateTime?
  archivedAt   DateTime?

  @@map("tenant")
}

enum TenantStatus {
  active
  suspended
  archived
}
```

#### 2. Tenant 级配额（资源限制 + 软限 / 硬限）

```ts
interface TenantQuotas {
  userCount?: { soft: number; hard: number }; // 超 soft 提醒，超 hard 拒绝
  storageGB?: { soft: number; hard: number };
  monthlyApiCalls?: { soft: number; hard: number };
  monthlyExportRows?: number; // 导出总行数
  monthlyEmailSends?: number;
  monthlyPushSends?: number;
  tenantSeats?: number; // 允许的 Membership 数量
}
```

执行机制：

- Guard `@CheckQuota('userCount')` 拦截 controller；超硬限返 `TENANT_QUOTA_EXCEEDED`（429）
- 接近软限（80%）shared-notification 发通知给 tenant admin
- Platform admin 可临时提额度（`PATCH /platform/tenants/:id/quotas`）
- 配额累计走 shared-cache（Redis counter + 月级 reset）

#### 3. Platform Admin 账户体系

**和 tenant user 完全独立**。Platform admin 是**系统级**账号，跨所有 tenant 可见：

```prisma
model PlatformAdmin {
  id            String   @id @default(uuid())
  email         String   @unique
  displayName   String
  role          PlatformRole   // super-admin / ops / billing / support
  mfaEnabled    Boolean  @default(false)  // M2 预留字段，M6 实现
  status        String   @default("active")
  lastLoginAt   DateTime?
  createdAt     DateTime @default(now())

  @@map("platform_admin")
}

enum PlatformRole {
  super_admin    // 全权
  ops            // 运维：能读所有数据、不能改计费
  billing        // 财务：只看账单相关
  support        // 客服：能协助单个 tenant 解决问题，有限范围
}
```

**登录入口分离**：`POST /platform/auth/login`（独立 JWT schema，`system: true` claim + `platformRole` claim）；**不能**用 tenant user 账号登 platform，也不能反过来。

**强制 MFA**：platform admin 登录 M6+ 强制开 MFA（`tripod platform:enroll-mfa`）。

#### 4. 跨租户能力（`$unscoped` 的合法入口）

Platform admin 走 `$unscoped`：

- **跨租户搜索**：`GET /platform/search?q=xxx&scope=all-tenants`（审计标红：记录谁搜了什么）
- **跨租户审计**：`GET /platform/audit-logs`（读所有 tenant 的 BusinessAuditLog）
- **单 tenant 介入**：`POST /platform/tenants/:id/impersonate` 生成一个短期 token（15min）+ 审计 + 所有操作 double audit（platform admin 身份 + 实际 tenant）
- **健康巡检**：`GET /platform/health` 汇总所有 tenant 的 user / order 统计 + 异常 tenant（连续 N 天无活跃 / 导出失败等）

所有跨租户操作**必须**：

- 走 `@PlatformRole('ops|super-admin')` guard
- Double-write audit：一条记 platform 层（谁做了什么），一条记 tenant 层（这个 tenant 被谁做了什么）
- correlationId 贯穿，便于串起"platform 发起 → tenant 处理"的调用链

#### 5. Feature Flag 管理（配合 shared-feature-flag）

- 列所有 flag + 每 tenant 开关状态矩阵
- 批量操作："给全部 tenant 开 newApprovalFlow" / "给 tier=premium 的 tenant 开 X"
- 紧急 kill-switch：顶部 prominent 按钮"紧急关闭 flag"（配合 shared-cache invalidate 30s 生效）
- Flag 生命周期视图：接近 `expectedRemoveAt` 的 flag 高亮提醒 owner 处理

#### 6. 邀请 / 批量建 tenant（M2）

- **单个创建**：`POST /platform/tenants`
- **批量创建**（CSV 导入）：`POST /platform/tenants/batch` + 上传 CSV
- **邀请 tenant admin**：随创建自动发邀请邮件（邮箱 token 链接，M2 无 resend 无防滥用，沿用 core 约定）
- **手动转移 tenant-admin 归属**：tenant-admin 离职时 platform 介入指定新 admin

#### 7. Platform 观察 / 告警

- **Tenant 健康 dashboard**：每 tenant 的 user 数 / 存储占用 / 月 API 调用量 / 错误率
- **告警订阅**：platform admin 可订阅 "某 tenant 错误率突增" / "某 tenant 配额告急" 等事件
- **计费相关（Tier 2）**：账单生成 / 续费提醒 / 欠费停用

### Tier 2 能力（不在 M2，接口留）

- **计费 / Billing**：Stripe / 支付宝 / 微信支付 集成，订阅管理，发票
- **多区域部署**：tenant 绑定地理区域（中国区 DB / 欧盟区 DB），GDPR 合规数据本地化
- **Tenant DB 物理隔离**（目前是逻辑隔离 via RLS）：超大 tenant 单独一套 DB
- **白标定制**：每 tenant 的品牌定制（logo / 配色 / 域名）
- **Enterprise SSO**：每 tenant 独立 SAML / OIDC 配置

### Platform admin vs Tenant admin 权限对比

| 能力                                   | Tenant Admin | Platform Admin（super） |
| -------------------------------------- | ------------ | ----------------------- |
| 看本 tenant 业务数据                   | ✓            | ✓（跨所有 tenant）      |
| 改本 tenant 业务数据                   | ✓            | ✓（需 impersonate）     |
| 管理本 tenant 员工                     | ✓            | ✓                       |
| 看/改 tenant 配置（timezone / locale） | ✓            | ✓                       |
| 看/改 tenant quota                     | ✗            | ✓                       |
| 看/改 feature flag                     | ✗（只读）    | ✓                       |
| 创建 / 暂停 tenant                     | ✗            | ✓                       |
| 跨租户搜索                             | ✗            | ✓                       |
| 跨租户审计                             | ✗            | ✓                       |
| 紧急 kill-switch                       | ✗            | ✓                       |
| 管理 platform admin                    | ✗            | ✓                       |

### `apps/platform` 目录结构

```
apps/platform/
├── src/
│   ├── auth/              # platform 登录（独立 JWT）
│   ├── tenants/           # tenant 增删改查 / 激活 / 暂停
│   ├── quotas/            # 配额管理 + CheckQuota guard
│   ├── admins/            # platform admin 账户
│   ├── impersonate/       # tenant 介入
│   ├── search/            # 跨租户搜索
│   ├── audit/             # 跨租户审计读取
│   ├── flags/             # feature flag 管理 UI
│   └── health/            # tenant 健康巡检
├── prisma/                # platform 独有 schema 段（platform_admin 表等）
└── tripod.app.yaml        # app 装配描述
```

UI 层实现跟随 admin-web UI 库决策（M3）。

### 里程碑

- **M1**：Tenant 表骨架（slug / name / status / timezone / locale / featureFlags JSON / quotas JSON）+ default-tenant seed
- **M2**：`apps/platform` app + platform auth（独立 JWT）+ tenant CRUD API + 配额 Guard + feature flag 管理 API + 跨租户审计读取 + impersonate 机制
- **M3**：platform 管理 UI（随 admin-web UI 库决策）+ tenant 健康 dashboard
- **M6**：MFA 强制 + 计费接入 + SSO / SAML / OIDC
- **Tier 2**：多区域部署 / tenant DB 物理隔离 / 白标定制

### AI 读解路径（Platform）

- 用户说"开个新公司 / 新租户"：走 `POST /platform/tenants`（需要 platform admin 身份 JWT）
- 用户说"给 tenant X 开 Y 功能"：走 `PATCH /platform/tenants/:id/feature-flags`
- 用户说"某 tenant 用量异常":先 `GET /platform/health?tenantId=...` 看指标，再看对应审计
- 用户说"临时介入 tenant 协助排查"：`POST /platform/tenants/:id/impersonate` 拿短期 token；**所有操作留下 double audit**，事后主动告知 tenant admin

---

## 鉴权体系详细设计

### 两个正交维度

- **Credential Provider**：用户怎么证明身份（邮箱密码 / 用户名密码 / 手机 SMS / OAuth / WeCom / DingTalk ...）
- **Session Policy**：登录成功后怎么管会话（不限 / 单全局 / 每平台一个 / 最多 N 设备 / 按角色差异化）

两维度任意组合（Provider × Policy = N × M）。

### 统一登录 API

```
POST /auth/login
{ "provider": "email-password",
  "credential": { "email": "...", "password": "..." },
  "device": { "deviceId": "uuid-v4", "platform": "web" } }
```

后端 Map 注册零 if-else 分发：新增登录方式 = 新建一个 `adapters/auth-*` 包 + 加入 config.providers 数组，一行改动。

### Credential Provider 接口

```ts
interface CredentialProvider<TInput = any> {
  readonly name: string; // 'email-password' | 'sms' | ...
  verify(input: TInput, ctx: VerifyCtx): Promise<UserIdentity>;
}
```

### Session Policy 接口 + 内建实现

```ts
interface SessionPolicy {
  readonly name: string;
  onLogin(userId, device, activeSessions, identity): Promise<SessionDecision>;
  onRefresh(session, activeSessions, identity): Promise<{ allow: boolean; reason?: string }>;
}
```

M2 内建 Policy（shared-auth/src/policies/）：

- `MaxDevicesPolicy(n)`（默认，LRU 淘汰最久未用）
- `SingleGlobalPolicy`（Platform Admin 强制使用）

Tier 2 扩展（接口已定，按需添加）：`UnlimitedPolicy` / `PerPlatformPolicy`（同平台互踢跨平台共存）/ `RoleBasedPolicy`（组合器：按角色路由到其他 Policy）。

所有策略通过 `revokeSessionIds` 表达踢下线，SessionStore 统一处理。Policy 本身是纯函数，可单元测试。

### Token 生命周期

- **Access Token**：JWT 15 分钟，无状态，claim 里 embed `{ sub, tenantId, tenantRoles, permissions, scopes }`
- **Refresh Token**：轮换 + 重放检测 + 滑动 7 天 + 绝对 30 天上限
  - 每次刷新都换新 refresh token，旧的立刻失效
  - Redis 记 `familyId` + `generation`
  - 若收到已轮换的旧 refresh → 判定整个 family 被盗 → 踢全链并告警
- Redis 结构：
  - `auth:session:{sessionId}` → `{ userId, deviceId, platform, familyId, currentRefreshHash, generation, ... }`
  - `auth:user-sessions:{userId}` → `Set<sessionId>`（策略判断用）
  - `auth:refresh-revoked:{familyId}:{hash}` → 1（重放检测）

### Device ID

- 客户端首启生成 UUID v4
- web 存 `localStorage`
- mobile 存 SecureStore / Keychain

### 强制下线

- **M2 默认 Pull 模式**：access 15 分钟过期重刷，Redis 查不到 session 即 401。最大延迟 15 分钟。
- **Push 通道**（M2 不做，M6+ 视需求加）：SSE 频道 `auth:events:{userId}`，订阅 Redis Pub/Sub，用于 `session-revoked` / `permission-changed` / `force-logout` 三类事件。RN 用 `react-native-sse` polyfill。

### MFA/2FA（接口在 M2 预留，实现在 M6+）

```ts
interface MfaChallenger {
  readonly name: string; // 'totp' | 'sms' | 'email-code' | 'webauthn' | 'backup-code'
  shouldChallenge(identity, ctx): Promise<boolean>;
  issue(identity, ctx): Promise<MfaChallenge>;
  verify(challengeId, proof): Promise<boolean>;
}

interface MfaResolver {
  resolve(identity, ctx): Promise<MfaChallenger[]>; // 按角色/风险决定需要哪些 MFA
}
```

登录流程两阶段：

```
POST /auth/login → { status: 'mfa-required', challengeId, methods: ['totp', 'sms'] }
POST /auth/login/mfa → { challengeId, method, proof } → { accessToken, refreshToken }
```

设备信任（"记住此设备 30 天"）：MFA 通过后在 session 标记 `mfaTrustedUntil`，同一个 deviceId 再次登录跳过 MFA。

### 密码重置

```ts
interface RecoveryProvider {
  readonly name: string; // 'email-link' | 'sms-code' | 'backup-code' | 'support-manual'
  initiate(identifier: string): Promise<RecoveryChallenge>;
  verify(challengeId: string, proof: unknown): Promise<UserIdentity>;
}
```

重置成功后吊销该用户**所有现有 session**。

### Adapter 包清单

```
adapters/
├── auth-email-password/       ★ M2（邮箱 + 密码）
├── auth-username-password/    ★ M2（用户名 + 密码，内部账号常用）
├── auth-email-otp/            ★ M2（邮箱 6 位数字验证码）
├── auth-magic-link/           ★ M2（邮箱点击链接登录）
└── recovery-email-link/       ★ M2（密码找回）
```

**M2 默认提供 4 种登录方式**，业务任意组合启用。其他（SMS / OAuth / 企微 / 钉钉 / SSO / MFA 各档）Tier 2 按需加。

#### 4 种 M2 默认 adapter 实现概要

**`auth-email-password`**：

- 后端：`POST /api/v1/auth/login { email, password }` → 校验（argon2id）+ 签 access + refresh token
- 密码规则：min 12 字符 / 禁 top-10000 弱密码 / zxcvbn 强度 ≥ 3
- 错误：`AUTH_INVALID_CREDENTIALS`（401，不区分用户名/密码错，防枚举）
- 防暴力：5 次失败锁 15 分钟（`shared-cache` 记 counter）

**`auth-username-password`**：同上 + 多租户场景用 `tenantSlug:username` 复合识别

**`auth-email-otp`**：

- 后端流程：
  1. `POST /api/v1/auth/otp/request { email, purpose: 'login' }` → 生成 6 位数字 OTP + Redis 存 5min + 走 `shared-notification` 发邮件
  2. `POST /api/v1/auth/otp/verify { email, code }` → 校验 + 签 token
- 防暴力：同邮箱 1 分钟内最多 1 次 request / 同 code 3 次 verify 失败失效
- 错误：`AUTH_OTP_INVALID` / `AUTH_OTP_EXPIRED` / `AUTH_OTP_RATE_LIMITED`

**`auth-magic-link`**：

- 后端流程：
  1. `POST /api/v1/auth/magic-link/request { email }` → 生成 64 字节随机 token + Redis 存 15min + 发邮件（含 `https://<host>/auth/magic?token=xxx`）
  2. 用户点击 → 前端路由 `/auth/magic` → `POST /api/v1/auth/magic-link/verify { token }` → 签 token
- Token 一次性（verify 后立即失效）
- 防暴力：同邮箱 1 分钟内最多 1 次 request
- 错误：`AUTH_MAGIC_INVALID` / `AUTH_MAGIC_EXPIRED` / `AUTH_MAGIC_USED`

**`recovery-email-link`**：密码找回，流程类似 magic-link 但终点是"跳改密码页"。

#### useAuth() hook 暴露的完整方法（前端 shared-auth）

```ts
const {
  // 邮箱密码
  loginWithEmailPassword, // (email, password) => Promise<User>
  // 用户名密码
  loginWithUsernamePassword, // (tenantSlug, username, password) => Promise<User>
  // 邮箱 OTP
  requestEmailOtp, // (email, purpose) => Promise<void>
  verifyEmailOtp, // (email, code) => Promise<User>
  // Magic link
  requestMagicLink, // (email) => Promise<void>
  // verify 由路由 /auth/magic 自动处理
  // 密码找回
  requestPasswordReset, // (email) => Promise<void>
  // 通用
  logout, // () => Promise<void>
  isAuthenticated, // boolean
  user, // User | null
  enabledCredentials, // ['email-password', 'email-otp', ...] 来自 tripod.config.yaml
} = useAuth();
```

**refresh / 401 处理完全在 axios 拦截器里**，业务代码**不感知** token 生命周期。

### LoginPage 基础骨架设计（所有前端 app 共用逻辑）

每个前端 app（admin-web / platform / portal / mall-web 等）的 LoginPage **根据 config 动态渲染启用的登录方式**。

#### LoginPage 示例（AntD 版，admin-web）

```tsx
// apps/admin-web/src/auth/LoginPage.tsx（模板产出）
import { Card, Tabs, Button, Divider } from 'antd';
import { useAuth } from '@tripod-stack/shared-web-ui';

export function LoginPage() {
  const {
    enabledCredentials, // 来自 tripod.config.yaml 的 auth.credential 数组
    enabledOAuth, // ['google', 'wechat'] 之类
    loginWithEmailPassword,
    requestEmailOtp,
    verifyEmailOtp,
    requestMagicLink,
  } = useAuth();

  return (
    <Card>
      <Tabs defaultActiveKey={enabledCredentials[0]}>
        {enabledCredentials.includes('email-password') && (
          <Tabs.TabPane tab="邮箱密码" key="email-password">
            <EmailPasswordForm onSubmit={loginWithEmailPassword} />
          </Tabs.TabPane>
        )}
        {enabledCredentials.includes('email-otp') && (
          <Tabs.TabPane tab="邮箱验证码" key="email-otp">
            <EmailOtpForm onRequest={requestEmailOtp} onVerify={verifyEmailOtp} />
          </Tabs.TabPane>
        )}
        {enabledCredentials.includes('magic-link') && (
          <Tabs.TabPane tab="邮箱链接登录" key="magic-link">
            <MagicLinkForm onSubmit={requestMagicLink} />
          </Tabs.TabPane>
        )}
      </Tabs>

      {enabledOAuth.length > 0 && (
        <>
          <Divider>或</Divider>
          <OAuthButtons providers={enabledOAuth} />
        </>
      )}
    </Card>
  );
}
```

#### shadcn 版（portal / mall-web）

同样的逻辑结构，换成 shadcn 组件（`<Tabs>` / `<Button>` / `<Input>`）。

#### 业务"重改"示例

业务要做"左 60% 品牌插画 + 右 40% 登录表单 + 渐变背景"：

```tsx
// 业务完全重写 LoginPage.tsx
export function LoginPage() {
  const { enabledCredentials, loginWithEmailPassword, requestEmailOtp, verifyEmailOtp } = useAuth();

  return (
    <div className="grid h-screen grid-cols-[60%_40%]">
      <BrandIllustration className="bg-gradient-to-br from-purple-600 to-blue-500" />
      <MyCustomLoginForm
        availableMethods={enabledCredentials}
        onEmailPassword={loginWithEmailPassword}
        onOtpRequest={requestEmailOtp}
        onOtpVerify={verifyEmailOtp}
      />
    </div>
  );
}
```

**hook 调用保持**，视觉完全自定义。登录逻辑（refresh / 401 / OTP 防暴力 / token 签发）tripod 写好不变。

#### `useAuth()` 对"禁用 adapter"的处理

业务 `tripod.config.yaml` 把 `auth.credential` 改为 `['email-otp']` 只保留一种：

```ts
const { enabledCredentials, requestEmailOtp, verifyEmailOtp, loginWithEmailPassword } = useAuth();

enabledCredentials; // ['email-otp']
requestEmailOtp; // function
verifyEmailOtp; // function
loginWithEmailPassword; // undefined（未启用的方法为 undefined）
```

LoginPage 的 `{enabledCredentials.includes('email-password') && ...}` 自动不渲染对应 tab。

#### AI 读解路径（登录定制）

用户说"加微信扫码登录"：

1. `pnpm tripod add-adapter auth.credential=oauth-wechat`
2. 提示补 env（`WECHAT_APP_ID / WECHAT_SECRET`）
3. LoginPage 无需改代码，自动渲染"微信登录"按钮（前提：`enabledOAuth` 包含 `wechat`）
4. 提示用户配置微信开放平台 redirect_uri

用户说"我想把登录页改成左右布局带插画"：

1. 这是 UI "重改"场景
2. 读 `docs/templates/<app-type>/customization.md` §登录页定制
3. 复制现有 LoginPage.tsx → 重写视觉，保留 `useAuth()` 所有 hook 调用
4. 跑 `pnpm tripod smoke-test --recipe=<current>` 确认登录流不坏

### shared-auth 包结构

```
packages/shared-auth/
├── src/types.ts                    CredentialProvider / SessionPolicy / DeviceInfo 等
├── src/auth.module.ts              SharedAuthModule.forRoot()
├── src/auth.service.ts             登录编排器
├── src/session-store/              Redis 实现
├── src/token/                      JWT 签发 + 轮换 + 重放检测
├── src/policies/                   Unlimited / SingleGlobal / PerPlatform / MaxDevices / RoleBased
├── src/mfa/                        MfaChallenger / MfaResolver 接口
├── src/recovery/                   RecoveryProvider 接口
├── src/guards/                     AuthGuard（JWT 验证） + CurrentUser 装饰器
├── src/client/                     useAuth / useSession Zustand store（UI 无关）
└── src/events/                     SSE 事件总线（M6+ 开启）
```

### AI 读解路径（鉴权）

AI 扩展鉴权能力的**唯一合法路径**：

- **加登录方式**：新建 `adapters/auth-<provider>/`（**不预登记**，见 Anti-patterns）+ 实现 `CredentialProvider` 接口 + `tripod add-adapter auth.credential=<name>`
- **加 MFA**：新建 `adapters/mfa-<kind>/` + 实现 `MfaChallenger` + `tripod add-adapter mfa.totp=<name>`；`MfaResolver` 决定按角色 / 风险谁需要 MFA
- **加 Session Policy**：只在 `shared-auth/src/policies/` 内加；接口 `SessionPolicy.onLogin / onRefresh`；M2 只 `MaxDevicesPolicy` + `SingleGlobalPolicy`
- **改 Token 生命周期参数**：`packages/shared-config/src/env.ts` 加 env（`ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_SLIDING_DAYS` 等），不改代码常量
- **切换公司 / 强制下线 / 密码重置**：API 已就绪（`/auth/switch-tenant` / session revoke / `/auth/recover/*`），AI 直接调，不自实现

**AI 禁止**：

- 改 `AuthGuard` / `JwtStrategy` 核心验证逻辑 —— 除非用户明确要求改协议
- 直接读 JWT secret / refresh token family —— 走 `shared-auth` 封装
- 自实现"记住设备 30 天 / 免 MFA" 逻辑 —— M2 接口预留但未激活，改 core 先

**AI 诊断**：用户说"登录后 15 分钟就掉线"/"refresh 失效"：

1. 查 `env.JWT_SECRET` 是否稳定（重启后不变）
2. 查 Redis `auth:session:*` key 是否正常写入
3. 查 refresh token 是否被 LRU 淘汰（`MaxDevicesPolicy`）
4. 查是否多实例部署但 Redis 未共享

---

## 权限体系详细设计

### 授权模型

**RBAC 为主 + 最小数据范围**：role → permission，每个 permission 最多带 `own | all` 两档数据范围修饰。

Casbin / Cerbos / ReBAC（openFGA）不预留 adapter 位，真遇到"团队/区域/仓库维度的复杂矩阵"需求时再加。

### 统一 PermissionNode 资源树（3 type）

| Type           | 含义                                    | 前端执行                  | 后端执行                    |
| -------------- | --------------------------------------- | ------------------------- | --------------------------- |
| **PAGE**       | 页面/菜单访问                           | 路由守卫 + 菜单自动过滤   | 对应 GET API Guard          |
| **ACTION**     | 业务动作（CRUD / 审批 / 导出 / 自定义） | 按钮可见 + 调用前 `can()` | `@RequirePermission` 装饰器 |
| **DATA_SCOPE** | 数据范围修饰（ACTION 的可选后缀）       | 自动传参                  | service 层合进 where        |

**不做 BUTTON 独立 type**：按钮可见性走 ACTION 的 `can()` 判断，不另起节点。

**不做 FIELD 独立 type + FieldPermissionInterceptor**：字段级脱敏（如"成本价只给经理看"）用显式代码即可，真实项目敏感字段数 < 10：

```ts
// order.service.ts
async toDto(order, user) {
  const dto = { ...order };
  if (!user.can('order:read-cost')) delete dto.costPrice;
  return dto;
}
```

等真出现 50+ 敏感字段的审计强场景再抽 interceptor。

**DATA_SCOPE 只两档**：`own`（只看自己创建的）+ `all`（默认，全部可见）。不做 `assigned / team`。真出现"按部门看 / 按仓库看 / 按销售区域看" 时，改为**在 action 上加独立权限点**表达（如 `order:read-dept`），比 4 档 scope 更直观：

```ts
// 查询时
const where: Prisma.OrderWhereInput = { tenantId: user.tenantId };
if (user.can('order:read-all')) {
  /* no-op */
} else if (user.can('order:read-own')) where.createdBy = user.id;
else throw new ForbiddenException();
```

### 数据模型

```prisma
enum PermissionNodeType { PAGE ACTION DATA_SCOPE }

model PermissionNode {
  id          String  @id              // 如 'order:list-page' / 'order:approve' / 'order:read-own'
  type        PermissionNodeType
  resource    String                    // 'order' / 'inventory' / 'customer'
  key         String                    // 'list-page' / 'approve' / 'read-own'
  label       String
  description String?
  isBuiltIn   Boolean @default(true)
  @@index([resource])
}

model Role {
  id            String
  tenantId      String
  name          String
  permissionIds String[]                // 指向 PermissionNode
  isBuiltIn     Boolean
  @@unique([tenantId, name])
}

model TenantMembership {
  userId   String
  tenantId String
  roleIds  String[]
  status   MembershipStatus
  @@id([userId, tenantId])
}
```

**不做 tenant 自定义 PermissionNode**（L2 已否决）。权限点只由代码声明。

### 权限点注册机制

```ts
// apps/server/src/order/order.permissions.ts
export const ORDER_PERMISSIONS: PermissionNodeDef[] = [
  {
    id: 'order:list-page',
    type: 'PAGE',
    resource: 'order',
    key: 'list-page',
    label: '访问订单管理页',
  },
  {
    id: 'order:read-all',
    type: 'ACTION',
    resource: 'order',
    key: 'read-all',
    label: '查看全部订单',
  },
  {
    id: 'order:read-own',
    type: 'DATA_SCOPE',
    resource: 'order',
    key: 'read-own',
    label: '仅看自己创建的订单',
  },
  { id: 'order:create', type: 'ACTION', resource: 'order', key: 'create', label: '创建订单' },
  { id: 'order:approve', type: 'ACTION', resource: 'order', key: 'approve', label: '审批订单' },
  { id: 'order:export', type: 'ACTION', resource: 'order', key: 'export', label: '导出订单' },
  {
    id: 'order:read-cost',
    type: 'ACTION',
    resource: 'order',
    key: 'read-cost',
    label: '查看订单成本价',
  },
];
```

Module bootstrap 时 `PermissionRegistry.sync()` upsert 到 DB。改/删节点只改代码。

### 权限检查两层

```ts
// 层 1：Controller 守卫
@Patch(':id/approve')
@RequirePermission('order:approve')
approve(@Param('id') id, @CurrentUser() user) { ... }

// 层 2：service 层显式处理 data-scope
async list(user: User, filter: OrderFilter) {
  const where: Prisma.OrderWhereInput = { tenantId: user.tenantId, ...filter };
  if (!user.can('order:read-all')) {
    if (user.can('order:read-own')) where.createdBy = user.id;
    else throw new ForbiddenException();
  }
  return this.prisma.order.findMany({ where });
}
```

### JWT Claims（摊平的权限列表）

```ts
{
  sub: userId,
  tenantId,
  tenantRoles: ['warehouse-manager'],
  permissions: [
    'order:list-page', 'order:read-all', 'order:create', 'order:approve', 'order:export',
    'inventory:read-all', 'inventory:update',
  ],
}
```

权限变更延迟 ≤ 15 分钟（access token 过期时刷新）。紧急踢出用 session revoke。

### 前后端共享判断函数

```ts
// packages/shared-permission/src/match.ts
export function hasPermission(userPerms: string[], required: string): boolean {
  return userPerms.includes(required);
}
```

就一行 `includes` 检查。不做 scope rank 匹配（因为没有 own/assigned/team/all 四档）。前端 `usePermission().can()` / 后端 `PermissionGuard` 用同一个函数。

### 铁律：前端只做 UX 隐藏，后端必须二次校验

前端 `can()` 可被绕过，**后端 Guard 是唯一可信 source of truth**。CLAUDE.md 写入 code review checklist。

### 前端权限守卫约定（三层分工）

三种权限类型在前端的落点不同，各司其职，避免混用：

| 类型         | 前端落点                                             | 后端责任                         | 实现                           |
| ------------ | ---------------------------------------------------- | -------------------------------- | ------------------------------ |
| `PAGE`       | 菜单自动过滤 + 路由守卫                              | 可二次校验（装饰器）             | 配合 admin-web 的路由表        |
| `ACTION`     | `<Gate perm="...">` 组件隐藏按钮 / 菜单项 / 操作链接 | **必** 二次校验（Guard）         | hook `usePermission().can(id)` |
| `DATA_SCOPE` | **前端不判**，完全依赖后端过滤返回数据               | **必** 在 service `where` 加过滤 | —                              |

#### 1. PAGE 节点：菜单 + 路由

**菜单过滤**：admin-web 的 `<MainNav>` 组件读 `usePermission()` + 遍历菜单配置，自动隐藏当前用户不具 `PAGE` 权限的项：

```tsx
// apps/admin-web/src/layout/main-nav.tsx
const MENU: MenuItem[] = [
  { title: '销售订单', href: '/orders', requirePerm: 'sales-order:list-page' },
  { title: '客户', href: '/customers', requirePerm: 'customer:list-page' },
];

export const MainNav = () => {
  const { can } = usePermission();
  return MENU.filter(m => !m.requirePerm || can(m.requirePerm)).map(...)
};
```

**路由守卫**：每个路由文件顶部用 `<RouteGuard perm="sales-order:list-page">` 包裹；用户直接输入 URL 绕过菜单时兜底，显示 403 页面（带引导回首页）。

路由 → 权限点的映射由 `app-routes.ts` 集中维护（而不是散落在各 page 里），`tripod doctor` 校验：`app-routes.ts` 声明的 perm 必须存在于 `<r>.permissions.ts` 的 PAGE 节点里。

#### 2. ACTION 节点：`<Gate>` 组件隐藏

**统一组件**：`shared-permission/src/client/Gate.tsx`

```tsx
export const Gate: React.FC<{ perm: string | string[]; fallback?: ReactNode; children: ReactNode }> = ({
  perm, fallback = null, children,
}) => {
  const { canAll } = usePermission();
  const perms = Array.isArray(perm) ? perm : [perm];
  return canAll(perms) ? <>{children}</> : <>{fallback}</>;
};

// 使用：
<Gate perm="sales-order:approve">
  <Button onClick={handleApprove}>审批通过</Button>
</Gate>

<Gate perm={['sales-order:delete', 'sales-order:restore']} fallback={<Tooltip>无权限</Tooltip>}>
  <Dropdown>...</Dropdown>
</Gate>
```

**AI 写代码约束**：

- 任何"需要权限的交互元素"（按钮、Dropdown item、Link、表格行操作列）**必须** 用 `<Gate>` 包裹，**不要**手写 `{can('...') && <Button>...</Button>}` —— Gate 更一致 + 未来加 `fallback` / `tooltip` 容易改
- **禁** 用 `visibility: hidden` / `display: none` / `opacity: 0` 隐藏 —— 元素仍在 DOM，会被爬虫 / 辅助技术 / e2e 测试误触
- `disabled` 不等于无权限（disabled 是"当前状态不允许"，权限是"身份不允许"）—— 不要混用
- 表单字段按权限隐藏用 `<Gate>` 包整个字段（label + input），不是只隐藏 input

#### 3. DATA_SCOPE 节点：前端不判

**前端对 DATA_SCOPE 零感知**：列表查询直接 `GET /orders`，后端 `PermissionGuard` 读 JWT 的 `DATA_SCOPE` 声明（`sales-order:read-all` vs `sales-order:read-own`），在 service 的 `where` 里加过滤：

```ts
// apps/server/src/sales-order/sales-order.service.ts
async list(ctx: UserContext, query: ListQuery) {
  const where: Prisma.OrderWhereInput = {};
  if (ctx.hasPermission('sales-order:read-all')) {
    // 看所有（tenantId 由 middleware 自动加）
  } else if (ctx.hasPermission('sales-order:read-own')) {
    where.createdBy = ctx.userId;
  } else {
    throw new BusinessException(PERMISSION_DENIED_RESOURCE);
  }
  return paginate(this.prisma.order, query, { where });
}
```

前端拿到的列表**已是** scope 过滤后的结果；业务侧**不要**在前端再 `items.filter(o => o.createdBy === currentUser.id)` —— 重复 + 错误（后端返回的 page meta 已按 scope 算过 total）。

#### 4. 敏感字段脱敏（PAGE/ACTION 的边界情况）

`<r>.manifest.ts` 的 `sensitiveFields` 定义（如"成本价需 `sales-order:read-cost`"）：

- **后端**：service 层按 ctx 权限删/遮字段（`delete result.costPrice`），DTO transform 确保返回时已脱敏
- **前端**：不判 —— 收到啥显示啥，没值就空；`<Gate perm="sales-order:read-cost"><Col>{order.costPrice}</Col></Gate>` 双保险（Gate 隐藏列 + 即使错露后端也无值）

#### AI 前端权限自检清单

写 admin-web / portal / mobile 代码时：

- 新加菜单项 → `app-routes.ts` 补 `requirePerm`
- 新加按钮 → 用 `<Gate perm="...">` 包
- 新加列表查询 → 后端判 DATA_SCOPE，前端不加 filter
- 新加表单敏感字段 → manifest `sensitiveFields[]` 登记 + 前端 `<Gate>` 包字段 + 后端 service 脱敏
- 写 e2e UI 测试 → 至少覆盖 2 个角色（有权 / 无权），断言 `<Gate>` 正确隐藏

### 权限配置范围

- **L1（M2 落地，即最终形态）**：开发者代码声明节点 + admin 后台勾选组合成角色
- **L2（tenant 自定义节点）已否决**：不支持，属低代码范畴

### 预置模板角色（seed 数据）

`tenant-owner` / `tenant-admin` / `manager` / `employee` / `viewer`。

### AI 读解路径

每个资源的完整权限节点集合声明在 `<resource>.permissions.ts`，但 AI 首选读 `<resource>.manifest.ts` 的 `permissions` 摘要（`id` + `type` + `sensitive`）—— 一次读 10 行就能知道这个模块有哪些权限，不用逐条看 permissions.ts 的 `label` / `description`。manifest 与 permissions.ts 的一致性由 `tripod doctor` 保证。

### shared-permission 包结构

```
packages/shared-permission/
├── src/types.ts                    # PermissionNode / Role / Subject
├── src/guards/                     # PermissionGuard
├── src/decorators/                 # @RequirePermission
├── src/registry/                   # PermissionRegistry（启动时 sync 节点）
├── src/match.ts                    # hasPermission 共享函数
├── src/client/usePermission.ts     # 前端 hook（UI 无关）
└── src/seed/                       # 预置角色 seed
```

### 未来升级路径

真遇到以下情形再加，不预抽象：

- **BUTTON 节点独立**：admin 后台要精确配"这个按钮给这些角色看、不挂 action" → 加 BUTTON type + 视觉挂在 ACTION 子节点下
- **FIELD 级脱敏全局化**：敏感字段 > 20 个 → 从具体 service 的显式 delete 里抽 `FieldPermissionInterceptor`
- **按团队/区域/仓库的数据范围**：需求落地后加对应 action（`order:read-dept` / `order:read-warehouse`）+ service 层 where 分支；DATA_SCOPE 真变复杂再抽 ScopeBuilder
- **Casbin / Cerbos 外置引擎**：规则变动频率超过发版节奏时考虑

---

## 公开访客访问控制（为门户 / 商城预留的扩展点）

ERP 默认对未登录访客完全拒绝。门户/商城未来若做，**M1 只做最小 schema 前瞻避免未来迁移**，详细协议留 `plans/future-portal-mall.md`（真做时再展开）。

### M1 只落这些（前瞻）

- `User.email` 改为可选 + `User.phone` + `UserType` 枚举（`MEMBER / SHOPPER / HYBRID / PLATFORM_ADMIN`）
- `Visibility` 枚举预置（`PUBLIC / TENANT / PRIVATE`）
- `PermissionNode.public: Boolean @default(false)`（M1 无权限表时先留注释）
- `@Public()` 装饰器占位（M1 mock auth，M2 真 AuthGuard 时联动）

### 四个扩展点（接口留好，实现延到真做门户/商城）

1. **`PermissionNode.public`** → AuthGuard 遇到 `public: true` 跳过认证
2. **`TenantResolver` 接口** → 内置 `FromJwtResolver`；未来追加 `FromEnv / FromSubdomain / FromPath`（访客靠域名/路径定位 tenant）
3. **`visibility` 字段 + RLS 双 policy 模板** → 公开可读（published+PUBLIC） OR 本 tenant 全权 两条 OR policy
4. **Guest Session + Shopper User 体系** → `Guest` 表（cookie guestId 绑购物车）+ 登录后 merge 到 userId

详细 DSL / RLS / GuestSession / 适配矩阵 / 延伸 shared-\* 包清单等均挪出，真启动门户/商城业务时再展开到 `plans/future-portal-mall.md`。

---

## Mobile 基建接口（M2 前置，M5 实现）

### 设计基调

**Mobile app 本身在 M5 才做**，但 shared-auth / shared-notification / shared-storage / shared-api-client 这些**M2 就定的接口**必须前置考虑 mobile 场景，否则 M5 会发现接口不兼容需返工。

M2 只定**接口**，不写 RN 实现；实现延到 M5 随 `apps/admin-mobile` 一起做。

### PushProvider 接口（推送通知）

```ts
// packages/shared-notification/src/push/types.ts
export interface PushProvider {
  /** 注册设备 token（app 启动 + 登录成功时调） */
  registerDevice(params: {
    userId: string;
    tenantId: string;
    deviceToken: string;
    platform: 'ios' | 'android' | 'web';
    appVersion: string;
    deviceModel?: string;
  }): Promise<void>;

  /** 注销（登出 / 卸载 / token 失效） */
  unregisterDevice(deviceToken: string): Promise<void>;

  /** 发送（NotificationService 编排时调用）*/
  send(params: {
    userId: string; // 系统自动查这个 user 的所有有效 deviceToken
    payload: PushPayload;
  }): Promise<PushResult>;

  /** 批量发（tenant 全员通知 / 定向推送）*/
  sendBatch(params: { userIds: string[]; payload: PushPayload }): Promise<PushBatchResult>;
}

export interface PushPayload {
  title: string; // i18n 渲染后的字符串
  body: string;
  deeplink?: string; // 点击跳转的 deeplink URI
  badge?: number; // iOS 角标 / Android 部分 ROM 支持
  sound?: 'default' | string; // 自定义声音 ID
  category?: string; // iOS category（行动按钮组）
  data?: Record<string, string>; // 附加数据（deeplink 解析用 + 静默推送 payload）
  priority?: 'normal' | 'high';
  ttl?: number; // seconds
  collapseKey?: string; // 覆盖同类旧通知
}

export interface PushResult {
  successCount: number;
  failedDevices: Array<{
    deviceToken: string;
    reason: 'invalid-token' | 'quota-exceeded' | 'unknown';
  }>;
}
```

#### DB 模型（M2 就建表，存设备 token 等 M5 注册）

```prisma
model UserDevice {
  id           String   @id @default(uuid())
  userId       String
  tenantId     String   // 同一 user 在不同 tenant 可能推不同内容
  deviceToken  String   @unique
  platform     String   // ios / android / web
  appVersion   String
  deviceModel  String?
  pushProvider String   // fcm / apns / jiguang / ...（记录来源便于切换 provider 清理）
  active       Boolean  @default(true)
  lastSeenAt   DateTime @default(now())
  createdAt    DateTime @default(now())

  @@index([userId, tenantId, active])
  @@map("user_device")
}
```

#### Adapter 清单

```
adapters/push-null/         ★ M2 默认（no-op；M2 通知走 email + SSE 够用）
adapters/push-fcm/          ☆ M5（Google Firebase Cloud Messaging — 安卓 + iOS 通用）
adapters/push-apns/         ☆ M5（Apple Push Notification — iOS 直连）
adapters/push-jiguang/      ☆ Tier 2（国内 Android 厂商聚合：小米/华为/OPPO/VIVO/魅族）
adapters/push-getui/        ☆ Tier 2
adapters/push-unified/      ☆ Tier 2（统一推送联盟标准，各厂商 ROM 原生支持）
```

#### channel-push 接入 NotificationService

`ChannelProvider` 的 `push` channel 是 `PushProvider` 的外层薄封装：

```ts
// packages/shared-notification/src/channels/push.channel.ts
export class PushChannel implements ChannelProvider {
  constructor(private readonly pushProvider: PushProvider) {}

  async send(notification: Notification, recipient: Recipient) {
    await this.pushProvider.send({
      userId: recipient.userId,
      payload: renderPushPayload(notification, recipient.locale),
    });
  }
}
```

NotificationType 里 `channels: ['email', 'push']` 即可同时走；M2 默认 push 走 null，M5 切 fcm 零业务代码改动。

### DeepLinkResolver 接口（深链路由）

```ts
// packages/shared-deeplink/src/types.ts
export interface DeepLinkResolver {
  /** 解析入站链接 */
  parse(url: string): DeepLinkIntent | null;

  /** 构造出站链接（后端发推送 / 邮件 / 短信时用） */
  build(intent: DeepLinkIntent): string;

  /** 是否是本应用能处理的链接 */
  canHandle(url: string): boolean;
}

export interface DeepLinkIntent {
  type: string; // 'order-detail' / 'invoice-pay' / 'tenant-switch'
  params: Record<string, string>;
  requiresAuth?: boolean;
  preferredPlatform?: 'web' | 'mobile';
}
```

支持三种 URI 策略（mobile 实现时选其一或并存）：

- **Universal Link** (iOS) + **App Link** (Android)：`https://app.example.com/order/123` — 优先（安全，app 未装时 fallback web）
- **自定义 scheme**：`myapp://order/123` — 作为 fallback
- **Web route** — `https://admin.example.com/orders/123`（admin-web）

**注册机制**（M2 定，M5 实现）：

```ts
// 后端 DeepLinkRegistry
registry.register({
  type: 'order-detail',
  patterns: ['/order/:orderId', '/orders/:orderId/detail'],
  resolver: (params) => ({ type: 'order-detail', params: { orderId: params.orderId } }),
});

// 后端发推送时：
const url = deepLinkResolver.build({ type: 'order-detail', params: { orderId: o.id } });
// → "https://app.example.com/order/o-123"
```

### MobileSecureStorage 接口（跨平台密钥存储）

```ts
// packages/shared-auth/src/secure-storage/types.ts
export interface MobileSecureStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { biometric?: boolean }): Promise<void>;
  delete(key: string): Promise<void>;
  deleteAll(): Promise<void>;
}
```

用于存 refresh token / device id / biometric-gated 敏感数据。

#### 各平台实现（M5 写）

| 平台    | 实现                                                         | 备注                                                    |
| ------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| iOS     | `expo-secure-store`（Keychain）                              | 生物识别走 `requireAuthentication: true`                |
| Android | `expo-secure-store`（EncryptedSharedPreferences + Keystore） | 生物识别走 `BiometricPrompt`                            |
| Web     | `localStorage` + `crypto.subtle` 对称加密                    | 不如 mobile 安全；web 主要用 httpOnly cookie 存 refresh |

**固化选择**：`expo-secure-store` 作为 RN 实现，不留第二 adapter（Expo 栈已足够成熟）。web 的 fallback 实现内置在 shared-auth 里。

### shared-auth 的 Session 存储兼容

M2 设计 session 时**必须**考虑：

- **Web** refresh token 存 httpOnly cookie（走浏览器自动携带）
- **Mobile** refresh token 存 `MobileSecureStorage`，每请求 axios 拦截器从 storage 读 → 放 `Authorization: Bearer <refresh>` 走 `/auth/refresh`

两种机制共存：后端 `/auth/refresh` 既读 cookie 也读 header，二选一即可。这个设计 M2 就定，不然 M5 做 mobile 时发现 session 只认 cookie 要改 auth 核心。

### shared-api-client 的 Mobile 适配

axios 封装要区分平台：

```ts
// Web 版
import axios from 'axios';

// Mobile 版
import axios from 'axios';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

// 共同点
- baseURL 走 env
- 401 自动 refresh
- 错误码自动 i18n toast
- X-Request-Id / correlationId 注入

// 平台差异
Web:    withCredentials: true（cookie）
Mobile: 手动加 Authorization header（从 SecureStorage 读）
        X-App-Version / X-Platform / X-Device-Model header 注入
```

### 里程碑

- **M2**：PushProvider / DeepLinkResolver / MobileSecureStorage 接口定义 + UserDevice 表 + channel-push（null 实现）+ shared-api-client Mobile 变体骨架 + shared-auth session 双存储支持（cookie + header）
- **M5**：真实 RN 实现：`apps/admin-mobile` + `expo-secure-store` + FCM/APNs adapter + 深链注册 + UserDevice 管理 UI

### AI 读解路径（Mobile 基建）

- 要做"XX 动作推送"：走 NotificationService，`channels: ['push']`；不要直接调 PushProvider
- 要做"邮件里点链接打开 App 指定页"：`deepLinkResolver.build(...)` 后塞进邮件模板
- Mobile 端存敏感数据：用 `MobileSecureStorage`，不要 `AsyncStorage`（后者明文）

---

## 工作流引擎详细设计

### 设计基调

**直接用状态字段 + 乐观锁 + 历史表 + Prisma 事务**。不自实现 DSL、不默认 Outbox、不做版本化注册表。极简实现覆盖 95% 场景，接口留空位便于未来升级。

### M2 默认解决 3 个核心问题

原子性（事务）/ 可审计（history 表）/ 条件转换（service 层显式判断）。

Fan-out/Fan-in、SLA timeout、Outbox 事件总线、状态机版本化、外部回调幂等 —— **不在 M2 做**。第一次遇到真问题时再按需加实现，接口不预埋。

### 核心实现

#### 状态定义：TypeScript enum / union

```ts
// apps/server/src/sales-order/sales-order.types.ts
export type SalesOrderState =
  | 'draft'
  | 'pending-approval'
  | 'approved'
  | 'picking'
  | 'packed'
  | 'shipped'
  | 'completed'
  | 'rejected'
  | 'cancelled';

// 合法转换 + 权限需求在 service 方法里显式判断，无需 DSL
```

#### 持久化两表

```prisma
model SalesOrder {
  id           String          @id
  tenantId     String
  state        SalesOrderState
  stateVersion Int             @default(0)  // 乐观锁
  // ... 业务字段
}

model SalesOrderStateHistory {
  id         String   @id
  tenantId   String
  orderId    String
  fromState  String
  toState    String
  event      String
  actor      String
  reason     String?
  createdAt  DateTime @default(now())
  @@index([tenantId, orderId, createdAt])
}
```

**无 OutboxEvent 表**。真需要事件驱动时，service 方法末尾直接 `await this.queue.add('...')`，丢就丢（BullMQ 本身已可靠）。极少数"状态改了但事件必须到达"场景再加 outbox 单表，不预先抽象。

#### Transition 核心流程

```ts
// 每个状态变更就是 service 上一个方法，显式写
async approve(orderId: string, actor: User) {
  if (!actor.can('sales-order:approve')) throw new ForbiddenException();

  return this.prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.findFirstOrThrow({ where: { id: orderId } });
    if (order.state !== 'pending-approval') throw new ConflictException('invalid state');

    const updated = await tx.salesOrder.update({
      where: { id: orderId, stateVersion: order.stateVersion },
      data: { state: 'approved', stateVersion: { increment: 1 } },
    });
    await tx.salesOrderStateHistory.create({
      data: { orderId, fromState: order.state, toState: 'approved', event: 'APPROVE', actor: actor.id },
    });
    return updated;
  });
}
```

### shared-workflow 包结构（极薄）

```
packages/shared-workflow/
├── src/types.ts                # Actor / StatefulEntity 接口（用于 history 表复用）
├── src/history.service.ts      # 通用 {Entity}StateHistory 查询 API（按 entityId / correlationId）
└── src/client/useStateTimeline.ts
```

状态判断 / 守卫 / 事务编排全部在每个业务 service 自己写。`shared-workflow` 只提供"状态历史表查询能力"这一件复用事。

**AI 读解路径**：状态机现在分散在 service 方法里，AI 要快速理解"这个资源有哪些状态 / 转换 / 守卫权限" **不 grep service，只读 `<resource>.manifest.ts`**（见 shared-contract 章节的 `defineModuleManifest`）。manifest 是索引卡，service 是真值源，两者由 `tripod doctor` 保证一致。

### 未来升级路径（接口不预埋）

真遇到以下情形时再加，不提前占座：

- 某一个流程频繁出现"改状态但事件没发" → 给**那一张表**加 outbox 列 + 扫表 worker（~50 行代码）
- 一次交易要 fan-out 拆多个并发任务 → 直接 `await Promise.all([queue.add(...), ...])`，真需要 FlowProducer 再抽
- 状态机定义出现破坏性变更 → 加 `machineVersion` 列 + switch 老版本，不做 registry
- 第三个流程开始复用这套模式 → 再从三个具体实现里抽 DSL

---

## 存储体系详细设计

### 设计基调

- **统一接口**：S3 / OSS / COS / local / 自建附件服务全部实现同一个 `StorageProvider` 接口，业务代码无感切换
- **全程 backend-proxy**：**所有上传必须经过后端**，不使用前端直传云（即使是 S3/OSS/COS 也如此），保证权限审计/内容扫描/合规完整
- **本地优先**：`storage-local` 默认且**生产可用**，小团队/内网工具直接存本地磁盘
- **平滑云化**：后期需要云存储或自搭附件服务时零代码改动，只改环境变量

### StorageProvider 接口（统一 backend-proxy）

```ts
interface StorageProvider {
  readonly name: string; // 'local' | 's3' | 'oss' | 'cos' | 'custom-rest'

  // 小文件单次上传：后端流式转发
  acceptUpload(
    stream: Readable,
    params: {
      key: string;
      contentType: string;
      expectedSize?: number;
    },
  ): Promise<{ etag: string; size: number }>;

  // 服务端 I/O（系统生成报表、备份、清理等）
  putObject(params): Promise<{ etag }>;
  getObject(params): Promise<Readable>;
  deleteObject(params): Promise<void>;
  headObject(params): Promise<{ size; contentType; etag }>;
  copyObject(params): Promise<void>;

  // 下载两种模式，业务按文件类型选
  presignDownload?(params): Promise<{ url }>; // 敏感度低 + 需要 CDN 加速：签名直连
  streamDownload(params): Promise<Readable>; // 敏感资产 + 审计要求：后端流转（默认）
}
```

**不包含** `startMultipart / uploadPart / completeMultipart / abortMultipart` 四个方法。M2 只做单次上传（≤100MB），真遇到 >100MB 需求时再补 multipart 四件套 + 对应 adapter 实现 + 前端续传 UX。

前端 `useUpload` 只调 `POST /files/upload`，走 XHR 进度。业务代码完全无感，切换 provider 仅改 `STORAGE_PROVIDER=local|s3|oss|cos`。S3 adapter 内部用 `@aws-sdk/lib-storage` Upload 类会自动分片并发（SDK 黑盒行为），不体现在 StorageProvider 接口里。

### 文件元信息模型

```prisma
model File {
  id            String   @id
  tenantId      String
  bucketKey     String             // tenants/{tenantId}/{purpose}/{uuid}
  providerName  String             // 存储时的 provider（切换 provider 后老文件仍可读）
  bucketName    String
  originalName  String
  contentType   String
  size          Int
  etag          String?
  uploadedBy    String
  uploadedFor   String?
  purpose       String             // 'avatar' / 'product-image' / 'contract' / 'import-excel'
  status        FileStatus         // uploading | uploaded | failed | deleted
  isPublic      Boolean  @default(false)
  expiresAt     DateTime?
  deletedAt     DateTime?
  metadata      Json?
  @@index([tenantId, purpose])
  @@index([tenantId, uploadedFor])
}
```

`providerName` 让历史文件在切换默认 provider 后仍可正常读取，不需要强制迁移。

### 上传/下载核心流程

**上传（统一 backend-proxy）**

```
1. 前端  POST /files/upload (multipart/form-data) { purpose, uploadedFor?, file }
         XHR upload progress 实时显示进度
2. 后端  权限 + size + MIME 校验
        生成 bucketKey = tenants/{tenantId}/{purpose}/{uuid-v4}
        插入 File 记录（status: uploading）
        provider.acceptUpload(stream, ...) 流式转发：
          ├─ local: fs.createWriteStream 流入磁盘
          ├─ s3:    @aws-sdk/lib-storage Upload 类自动分片并发上传
          ├─ oss:   OSS SDK 的 Multipart Upload stream 接口
          └─ cos:   COS SDK 类似接口
        成功 → File.status: uploaded + 记 etag/size
        失败 → File.status: failed + 后台清理临时数据
```

**下载**

```
GET /files/:id/download
  1. 校验权限（File.tenantId 自动 RLS；purpose/uploadedFor 对应权限点）
  2. 根据 File.downloadMode（或 purpose 配置）选：
     a) presignDownload 模式（如商品图、头像等低敏感公开资源）：
        - 云 provider 产生签名 URL 5 分钟
        - 302 redirect，走 CDN 加速
     b) streamDownload 模式（默认，如合同、发票、报表等敏感资源）：
        - 后端从 provider.streamDownload() 获取流
        - pipe 到 response，设置 Content-Disposition
        - local 提供额外选项：返回 X-Accel-Redirect，让 Nginx 直接吐文件
```

### 上传协议（M2 默认：单次 ≤100MB）

**ERP 场景 90% 文件 < 10MB**（合同/发票/图片）。M2 只做单次上传，覆盖 95%+ 真实需求。真遇到 >100MB 场景（大 Excel 导入 / 视频附件 / CAD 图纸）时再一次性加 multipart + 断点续传 + FileUploadSession 表 + 前端 pause/resume/cancel UX。

#### M2 默认能力

- **单次上传**：`POST /files/upload`（multipart/form-data），上限 100MB
- **按 purpose 上限**：avatar 5MB / contract 50MB / import-excel 100MB / attachment 100MB
- **前端 `useUpload` hook**：XHR 进度 + 失败重试 1 次，**无** pause/resume/cancel
- **失败处理**：上传中断直接丢弃，前端提示"上传失败请重试"，删除 File 记录

#### 不做（M2 砍掉）

- 分片协议（`/files/upload/init|status|chunk|complete|abort`）
- `FileUploadSession` 表 + 孤儿清理 CRON
- hash-wasm 流式 sha256
- localStorage 断点续传
- pause/resume/cancel UX
- 并发分片控制 + 单用户 session 配额

数据模型不预留 `fileHash / providerMultipartId / chunkSize` 等字段。真上 multipart 时一并加字段 + 迁移，不预占位。

#### 未来加分片的路径

1. 给 `StorageProvider` 接口追加 `startMultipart / uploadPart / completeMultipart / abortMultipart` 四个方法
2. 新建 `FileUploadSession` 表 + 对应 migration
3. `storage-local` / `storage-s3` 实现四方法（local: 临时目录 + rename；s3: 云 Multipart API）
4. 新增 `/files/upload/init|chunk|complete|abort|status` controllers + 孤儿清理 CRON
5. 前端 `useUpload` 升级为自动选路径 + pause/resume/cancel + localStorage 续传

完整增量约 1 周工作量。接口切面清晰，M2 代码零改动。

### 多租户 bucket 策略

**默认：共享 bucket + key 前缀**

- 所有 tenant 共享一个 bucket
- key 强制前缀 `tenants/{tenantId}/...`
- 应用层 + DB RLS 双层隔离
- SaaS/ERP 首选，0 创建成本

**Tier 2：一 tenant 一 bucket**

- Tenant 表多字段 `storageConfig: { bucketName, credentials }`
- 创建 Tenant 时自动起 bucket + IAM role
- 适合白标/大 B 客户要求物理隔离
- 额外 adapter `storage-s3-per-tenant/`

### storage-local 生产级细节（当前默认方案）

| 要点               | 方案                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| **存储根目录**     | 环境变量 `STORAGE_LOCAL_ROOT=/data/tripod-files`，挂持久化卷                                              |
| **租户隔离**       | `{root}/tenants/{tenantId}/{purpose}/{uuid}` 目录结构                                                     |
| **路径穿越防护**   | key 字符白名单 `[a-zA-Z0-9_\-/.]`；拼接后 `path.resolve()` 必须落在 root 下，否则 400                     |
| **磁盘监控**       | M2 不做；真起 Prometheus 时加 `storage_local_used_bytes` / `files_count` / `upload_errors_total` 三个指标 |
| **备份**           | 定期 rsync 到 NAS/对象存储，或云盘快照                                                                    |
| **Nginx 加速下载** | 支持 `X-Accel-Redirect` 可选方案（`streamDownload` 时返回 header，Nginx 直接吐文件）                      |
| **上传实现**       | `stream.pipe(fs.createWriteStream(tmp))` → rename 到最终路径（原子）                                      |
| **并发与大文件**   | Node 流式写入，内存常驻几 MB；单文件 ≤1GB 性能良好；更大建议切 MinIO                                      |

### 后端 backend-proxy 上传的工程要点

所有 provider（包括云）都是后端接收 → 转发模式，需要：

| 要点                 | 方案                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| **流式处理**         | 全程 `Readable.pipe()`，不 buffer 全文件到内存                                                                |
| **云 SDK 选择**      | `@aws-sdk/lib-storage` `Upload` 类（SDK 内部自动分片并发，上层无感）；OSS/COS 的 Multipart Upload stream 接口 |
| **body 限制**        | NestJS `bodyLimit` 100MB；按 purpose 二次校验 size 上限                                                       |
| **超时**             | HTTP timeout 设置为文件大小预期上传时间的 2 倍；客户端显示进度                                                |
| **错误处理**         | 失败回滚：删除 File 记录 + 尝试删 bucket 对象                                                                 |
| **云同 region 部署** | 后端与对象存储同 region，保证内网带宽 Gbps 级                                                                 |

### 后期切云的平滑路径（全部零代码改动）

| 目标                    | 切换方式                                                               |
| ----------------------- | ---------------------------------------------------------------------- |
| 自托管 MinIO（S3 协议） | `STORAGE_PROVIDER=s3` + `S3_ENDPOINT=http://minio:9000`                |
| 阿里云 OSS              | `STORAGE_PROVIDER=oss` 或 `s3`（OSS 有 S3 兼容模式）                   |
| 腾讯云 COS              | `STORAGE_PROVIDER=cos` 或 `s3`                                         |
| 自建 HTTP 附件服务      | 新建 `adapters/storage-custom-rest/` 实现 StorageProvider，改 env 生效 |

历史文件按 File.providerName 字段读取（不强制迁移），新文件进新 provider。也可写迁移脚本批量搬。

### 安全策略

1. **Purpose 驱动的 MIME 白名单**：avatar/product-image 只能图片；contract 只能 PDF；import-excel 只能 xlsx
2. **Size 限制**：purpose 级配置（avatar 5MB / contract 20MB / excel 100MB ...）
3. **下载走权限网关**：前端不得持有裸 bucketKey；所有下载走 `/files/:id/download` 先校验再签名/重定向
4. **病毒扫描**（Tier 2 adapter `storage-virus-scan-clamav`）：上传完成触发 BullMQ Job 异步扫描
5. **Server-side encryption**：S3 SSE-S3 默认启用；local 不做盘加密（由部署层 LUKS/dm-crypt 负责）

### 临时文件清理

- File 记录有 `expiresAt` → 过期 CRON Job 扫描并删（同时删 bucket 对象 + DB 记录）
- `confirm` 成功时清 `expiresAt`
- 业务关联（如订单附件绑定）后可主动清 `expiresAt`
- 默认孤儿 TTL 24 小时

### 文件预览（UI 层延至 M3）

基础能力：

- **图片**：前端 `<img>` 直接渲染
- **PDF**：前端 PDF.js
- **Excel**：SheetJS 前端读小文件；大 Excel 后端提取前 N 行 JSON

Tier 2 预览 adapter：

- `storage-preview-libreoffice/`（Office 文件转 PDF/图片）
- `storage-preview-onlyoffice/`（强大但重）

PreviewProvider 接口：

```ts
interface PreviewProvider {
  supports(contentType: string): boolean;
  generatePreview(
    fileId: string,
  ): Promise<{ previewFileId: string; format: 'image' | 'pdf' | 'html' }>;
}
```

预览生成 = BullMQ Job，结果存回 File 表关联原文件。

### shared-storage 包结构

```
packages/shared-storage/
├── src/types.ts                   StorageProvider / File / PreviewProvider
├── src/storage.service.ts         根据 env 路由到当前 provider
├── src/upload.controller.ts      /files/upload (backend-proxy, 单次)
├── src/download.controller.ts    /files/:id/download（统一入口）
├── src/client/useUpload.ts       前端 hook（XHR 进度 + 失败重试）
├── src/client/useDownload.ts
└── src/client/useFilePreview.ts  （UI 容器留 M3）
```

不含 `multipart.controller.ts` / `cleanup.ts`（孤儿清理 CRON）。真加分片时一起补。

### Adapter 清单

```
adapters/
├── storage-local/                ★ M2 后期，默认+生产可用
└── storage-s3/                   ★ M2 后期（AWS S3 / MinIO / R2 / OSS-S3 兼容）
```

OSS / COS / per-tenant bucket / 病毒扫描 / Office 预览等**不预登记**，`StorageProvider` 接口已覆盖扩展路径，真需要时新增 adapter 包。

### 里程碑时机

- **M2 后期**：shared-storage 核心 + storage-local + storage-s3 adapter，**单次上传 ≤100MB**
  - File 表（不含 FileUploadSession）
  - `/files/upload`（单次）+ `/files/:id/download`
  - 前端 `useUpload` hook：XHR 进度 + 失败重试
  - 订单状态流转示例支持"审核时上传合同附件"
  - 前端 UI 用最简原生控件（M3 和 UI 库一起正式封装）
- **M3**：Upload / Download / Preview UI 组件封装（与选定 UI 库一起）
- **未来**：真遇到 >100MB 上传需求时，一次性加 multipart 协议 + FileUploadSession 表 + 断点续传 UX（见"未来加分片的路径"）；OSS / COS / per-tenant bucket / 病毒扫描 / Office 预览按需加 adapter

### 验收关键点（M2）

- 上传一个 50MB 合同到 storage-local，后端内存峰值不超过 100MB（纯流式 `pipe`）
- 上传超过 100MB 的文件 → 413 错误 + 清晰提示
- 上传过程网络中断 → 前端提示失败，File 记录被清理（status: failed），磁盘无残留
- 切换 `STORAGE_PROVIDER=s3` + 指向 MinIO 后，同样流程照常跑通，代码零改动
- 并发上传 10 个 10MB 文件，后端内存稳定

### AI 读解路径（存储）

- **加 purpose 白名单**：`shared-storage/src/purpose-config.ts` 加 entry（MIME / size 上限 / 下载模式），不硬编码在 controller 里
- **上传**：业务代码调 `this.storage.upload({ purpose, stream, originalName, contentType })`，不直接 `storageProvider.acceptUpload()`
- **下载**：走 `/files/:id/download`，业务代码**禁止**自己暴露 bucketKey 给前端
- **切 provider**：改 `env.STORAGE_PROVIDER=s3|oss|cos|local` —— 无代码改动；历史文件按 `File.providerName` 读，不强制迁移
- **新 purpose 例**（如添加 "product-image"）：在 purpose-config.ts 加一行 `{ key: 'product-image', mime: ['image/*'], maxSize: '5MB', downloadMode: 'presign' }`
- **敏感文件**：`downloadMode: 'stream'` + service 层权限检查（见 shared-permission）

**AI 禁止**（见 Anti-patterns）：

- 加 multipart 协议 / FileUploadSession 表 / 前端 pause/resume
- 接 `startMultipart` 等四方法到 `StorageProvider` 接口
- 加 "hash 秒传 / 大文件断点" UX

**AI 诊断**：用户说"上传慢 / 失败"：

1. 跑 `tripod snapshot` 看 `env.STORAGE_PROVIDER`
2. 检查 purpose size 上限 vs 实际文件大小
3. 查 `bodyLimit` 是否足够（默认 100MB）
4. 查后端流到对象存储是否跨 region（S3 同 region 才 Gbps）

---

## 通知 / 推送体系详细设计

### 分层

**Notification**（业务通知）≠ **Channel**（渠道）。业务代码只调 `notify({ userId, typeId, data })`，具体走哪些渠道由系统根据**通知类型默认 + 用户偏好 + 优先级 + 不打扰时段 + 速率控制**动态决定。

### 数据模型

```prisma
// 通知类型（代码声明，启动时 sync 到 DB）
model NotificationType {
  id              String   @id              // 'order:approved', 'stock:low'
  tenantId        String?                    // null=系统预置
  category        String                     // 'order' / 'inventory' / 'security'
  displayName     String
  description     String?
  defaultChannels Channel[]                  // ['IN_APP', 'EMAIL']
  allowChannels   Channel[]                  // 用户可选的渠道白名单
  priority        Priority                   // URGENT / HIGH / NORMAL / LOW
  templateKeys    Json                       // { email: 'tpl-order-approved', sms: '...', ... }
  isBuiltIn       Boolean  @default(false)
}

// 用户偏好
model UserNotificationPreference {
  userId          String
  tenantId        String
  typeId          String
  channels        Channel[]
  quietHoursFrom  String?     // '22:00'
  quietHoursTo    String?     // '08:00'
  muted           Boolean  @default(false)
  @@id([userId, tenantId, typeId])
}

// 通知实例（Inbox 源）
model Notification {
  id         String   @id
  tenantId   String
  userId     String
  typeId     String
  title      String
  body       String
  data       Json?                           // 结构化附加数据
  link       String?                         // 点击跳转
  read       Boolean  @default(false)
  readAt     DateTime?
  createdAt  DateTime @default(now())
  @@index([tenantId, userId, read, createdAt])
}

// 渠道发送记录
model NotificationDelivery {
  id             String   @id
  notificationId String
  channel        Channel
  status         DeliveryStatus     // PENDING | SENT | DELIVERED | FAILED | SKIPPED
  providerName   String              // 'email-smtp' / 'sms-aliyun' / ...
  providerRef    String?             // 第三方 message id（查送达）
  failureReason  String?
  retries        Int      @default(0)
  scheduledAt    DateTime
  sentAt         DateTime?
  deliveredAt    DateTime?
  @@index([notificationId])
}

enum Channel { IN_APP EMAIL SMS PUSH WEBHOOK }   // 5 通用渠道；WECHAT_OA / WECOM / DINGTALK / FEISHU / PUSH_IOS / PUSH_ANDROID 等由对应 adapter 扩展 enum 值
enum Priority { URGENT HIGH NORMAL LOW }
enum DeliveryStatus { PENDING SENT DELIVERED FAILED SKIPPED }
```

### ChannelProvider 接口

```ts
interface ChannelProvider {
  readonly channel: Channel;
  readonly name: string; // 'email-smtp' | 'sms-aliyun' | 'push-fcm' | ...

  send(params: {
    recipient: Recipient;
    title: string;
    body: string;
    templateKey?: string;
    templateParams?: Record<string, unknown>;
    attachments?: Attachment[];
    priority: Priority;
  }): Promise<{ providerRef?: string }>;

  queryStatus?(providerRef: string): Promise<'SENT' | 'DELIVERED' | 'FAILED'>;
  handleWebhook?(body: unknown, headers: Record<string, string>): Promise<void>;
}
```

### NotificationService 编排

```ts
async notify({ tenantId, userId, typeId, data }) {
  const type = await this.types.get(typeId);
  const pref = await this.prefs.find(userId, tenantId, typeId);
  if (pref?.muted) return;

  const channels = this.resolveChannels(type, pref, { now: new Date() });
  const rendered = await this.templates.render(type, data, { locale: user.locale });

  const notif = await this.repo.create({ tenantId, userId, typeId, ...rendered });
  for (const ch of channels) {
    const delivery = await this.deliveries.create({ notificationId: notif.id, channel: ch });
    await this.queue.add('notification-send', { deliveryId: delivery.id });
  }
}
```

BullMQ 消费者执行发送 + 失败重试 + 送达回调。

### M2 关键能力

- **模板引擎**：**Handlebars**，模板 key → DB 记录（admin 可后台编辑）+ 代码 seed 预置；多语言按 `{typeId}:{locale}` 索引
- **送达追踪**：邮件/短信/推送 webhook 回执更新 DeliveryStatus

### Tier 2 扩展（接口预留，M3+ 按需激活）

- **批量合并（Debounce）**：同用户短时间同类型通知合并成一条（窗口 5 分钟，合并 key `{userId}:{typeId}:{scopeKey}`）
- **速率控制 + quiet hours**：SMS/邮件/推送/用户级上限；UserNotificationPreference.quietHoursFrom/To 字段已预留
- **紧急通道 URGENT**：绕过不打扰时段 + 多渠道并发 + 失败回退（push 失败切 SMS）

M2 默认干净送出：每次 `notify()` 按类型 default channels + 用户偏好发，不做合并不做限速（由 BullMQ 重试 + 各 provider 自带退避兜底）。

### 站内信（IN_APP）实现

不走外部 provider。Notification 主记录即 Inbox 源；通过 **RealtimeChannel** 实时推送。

### shared-realtime 实时通道抽象（通知与 auth/permission 事件共用）

```ts
interface RealtimeChannel {
  readonly transport: 'sse' | 'websocket';
  publish(channel: string, event: unknown): Promise<void>; // 后端
  subscribe(channel: string): Observable<unknown>; // 前端
  disconnect(): void;
}
```

**M2 默认 SSE 实现**（NestJS `@Sse` + Redis Pub/Sub 做多实例广播；RN 用 `react-native-sse` polyfill），未来切 WebSocket 业务代码零改动。

三个通用频道约定：

- `user:{userId}:notifications` —— 通知推送
- `user:{userId}:auth-events` —— 强制下线/权限变更
- `tenant:{tenantId}:broadcast` —— 全租户广播（公告等）

NestJS 拦截 SSE 连接时用 JWT 认证，权限按频道校验（用户只能订阅 `user:{自己}:*` 和 `tenant:{当前tenant}:*`）。

### Adapter 清单

```
adapters/
├── notification-email-smtp/        ★ M2（通用 SMTP）
└── realtime-sse/                   ★ M2（默认）
```

短信 / 推送 / 企微 / 钉钉 / 飞书 / webhook / WebSocket 等**不预登记**。`ChannelProvider` + `RealtimeChannel` 接口 M2 就绪，扩展新增一个 adapter 包即可。

### shared-notification / shared-realtime 包结构

```
packages/shared-notification/
├── src/types.ts                    NotificationType / Channel / Priority
├── src/service.ts                  NotificationService 编排
├── src/registry.ts                 NotificationType 注册（代码→DB sync）
├── src/channels/in-app.provider.ts 站内信（内置）
├── src/templates/                  Handlebars 渲染 + 多语言
├── src/debounce.ts                 批量合并
├── src/rate-limit.ts               速率控制
├── src/client/useNotifications.ts  前端 hook（含未读数/标记已读）
└── src/client/useNotificationPreferences.ts

packages/shared-realtime/
├── src/types.ts                   RealtimeChannel 接口
├── src/server/sse-channel.ts      SSE 服务端实现
├── src/server/ws-channel.ts        WebSocket 服务端实现（Tier 2）
├── src/server/redis-broker.ts     Redis Pub/Sub 跨实例广播
├── src/client/sse-client.ts       EventSource 封装
└── src/client/ws-client.ts         socket.io-client 封装（Tier 2）
```

### 里程碑

- **M2**：shared-notification + shared-realtime(SSE) + in-app + email-smtp
- **M3+**：按项目需求接入 SMS / 推送 / 企业微信 / 钉钉等 adapter
- **M6**：模板管理后台 UI、送达率 dashboard

### AI 读解路径（通知）

- **加通知类型**：`pnpm tripod gen:notification-type <typeId>` 生成 `<resource>.notification-types.ts` + `templates/<typeId>.hbs`；同步更新 `<resource>.manifest.ts` 的 `notifications` 字段
- **业务触发**：service 层调 `this.notifier.notify({ tenantId, userId, typeId, data })`，不直接选渠道
- **加渠道**（邮件 / 短信 / 推送 / 企微 / 钉钉 / 飞书 / webhook）：新建 `adapters/notification-<channel>/`（**不预登记**）+ 实现 `ChannelProvider` + `tripod add-adapter notification.<slot>=<name>`
- **实时推送**：走 `shared-realtime`，三个固定频道 `user:{id}:notifications` / `user:{id}:auth-events` / `tenant:{id}:broadcast`，AI 订阅 / 推送都走这三个，不自定义

**AI 禁止**（见 Anti-patterns）：

- M2 加 Debounce / 速率控制 / quiet hours / 紧急通道回退实现（接口预留但不实现）

**AI 诊断**：用户说"通知没收到"：

1. 查 `NotificationDelivery.status` 是否 `SENT` / `FAILED`
2. 查 `UserNotificationPreference` 是否 muted
3. 查对应 `ChannelProvider.send` 的 provider 回执
4. 查 Redis Pub/Sub 是否跨实例广播（多实例部署时）

---

## i18n 体系详细设计

### 覆盖维度

UI 文案 / 后端消息 / 日期时间数字货币格式化 / 时区 / 多语言路由（可选）。

### 技术栈

- 前端/RN：**i18next + react-i18next**（事实标准）
- 后端：轻封装 i18next，和前端共享 JSON 翻译文件
- 格式化：原生 `Intl.*` + `date-fns-tz`

### 默认支持 locale（M2）

**zh-CN / en-US / zh-TW / ja-JP** 四语言基础翻译（common / auth / permission / errors 命名空间）。其他语言按项目需求增量补充。

### 错误消息策略：后端返错误码，前端翻译

```
后端 API 错误响应：
  { "error": { "code": "ORDER_CANNOT_APPROVE_IN_CURRENT_STATE",
               "params": { "currentState": "shipped" } } }

前端 errors.zh-CN.json：
  { "ORDER_CANNOT_APPROVE_IN_CURRENT_STATE": "订单当前状态（{{currentState}}）不可审批" }

前端使用：
  t(`errors.${error.code}`, error.params)
```

**例外（后端必须自己渲染）**：

- 邮件、短信、推送 body：用户不在线，前端无法翻译
- 导出 Excel/PDF：在后端生成
- 给管理员的系统日志

这些走后端 `I18nService.t(key, locale, params)`，按 **`User.preferredLocale`** 而非当前会话 locale（异步发送时用户可能已切语言）。

### 翻译文件组织

```
packages/shared-i18n/locales/              # 跨项目共享
  ├── zh-CN/{common,auth,permission,errors}.json
  ├── en-US/...
  ├── zh-TW/...
  └── ja-JP/...

apps/admin-web/src/locales/zh-CN/           # 项目专属（每个 app 自带命名空间）
  ├── order.json
  ├── inventory.json
  └── customer.json
```

按命名空间隔离，i18next http-backend 懒加载。

### Locale 来源优先级

1. URL 显式路径段（可选，`/en/dashboard`）
2. `User.preferredLocale`（DB 存储）
3. `Accept-Language` header
4. 系统默认 `zh-CN`

前端 axios 拦截器加 `X-Locale` header，NestJS `LocaleInterceptor` 解析放入 request context。

### 时区

#### 存储：全部 UTC

- Postgres `timestamptz` 全部 UTC 存（`@db.Timestamptz(6)`）
- `tripod/no-naive-timestamp` lint 拦截 `@db.Timestamp`（无时区 → 永久 bug 源）

#### 展示：按 tenant.timezone，不是 user 个人偏好

**Tenant 级配置，非用户级**。原因：

- **业务对账一致性**：同一订单 / 同一排班，所有员工看到相同的"创建日期"；否则美区员工看 `2026-04-21` 和国内员工看 `2026-04-22` 同一笔订单会对不齐账
- **报表统一口径**：日报 / 月报的"自然日"边界只有一个，按 tenant 时区切
- **UI 视觉一致**：一个 tenant 内所有客户端展示同一套日期，便于沟通

Tenant schema 加：

```prisma
model Tenant {
  // ...
  timezone  String  @default("Asia/Shanghai")  // IANA tz name
}
```

跨时区多 tenant 场景（总部 + 海外分公司）：每个 tenant 独立配；platform 超管看跨租户数据时按各 tenant 自己的时区展示。

#### 自然日边界

日报 / `createdAt` 日期 filter / 每日统计走 **tenant 时区**，不是 server 时区（Docker 默认 UTC，和业务预期的 `Asia/Shanghai` 差 8 小时）。

#### helper（shared-utils 导出）

```ts
// 返回 tenant-local 当天 00:00 对应的 UTC instant
startOfTenantDay(instant: Date, tenantTz: string): Date

// 返回 tenant-local YYYY-MM-DD 字符串（用于 date-only UI）
dayOf(instant: Date, tenantTz: string): string

// 本地化格式化（含时区）
formatTenantDate(instant: Date, tenantTz: string, locale: string, pattern?: string): string
formatTenantDateTime(instant: Date, tenantTz: string, locale: string): string
```

实现基于 `dayjs` + `utc` + `timezone` 插件（core §代码规范明确禁 moment / date-fns，统一 dayjs）。

#### AI 写代码禁令

- **DB** 字段用 `@db.Timestamp`（无时区）— lint 拦截
- **业务代码** `dayjs().startOf('day')` 不带 tz 参数 — 按 server 时区算，Docker 里是 UTC
- **前端** `new Date(iso).toLocaleString()` / `.toLocaleDateString()` — 按浏览器时区展示，破坏"同 tenant 同日期"规则
- **查询** `WHERE created_at >= '2026-04-22'` 裸字符串 — 被 Postgres 解释为 server 时区；改用 `startOfTenantDay(new Date('2026-04-22'), tenantTz)` 生成准确 UTC 边界

### 格式化工具（shared-i18n 导出）

```ts
// 金额 / 数量（走 Decimal）
formatMoney(value: Decimal | string, locale: string, currency?: string): string
formatQuantity(value: Decimal | string, locale: string, unit?: string): string
formatNumber(value: Decimal | string | number, locale: string): string
formatBytes(bytes: number, locale: string): string
formatPercent(ratio: Decimal | string, locale: string): string

// 日期 / 时间（走 dayjs + tenant timezone）
formatTenantDate / formatTenantDateTime / formatTenantRelative
dayOf / startOfTenantDay
```

基于 `dayjs` + `utc` + `timezone` 插件（shared-utils 统一 init）+ `decimal.js` + 原生 `Intl.NumberFormat`。**禁**引入 `date-fns` / `date-fns-tz` / `moment`。

### 翻译文件管理

- M2：项目内 JSON（0 依赖，git 友好）
- Tier 2：Tolgee 自托管 / Crowdin / Lokalise

### shared-i18n 包结构

```
packages/shared-i18n/
├── locales/                          # zh-CN / en-US / zh-TW / ja-JP × (common/auth/permission/errors)
├── src/i18n.ts                       # i18next 实例创建
├── src/server/                       # 后端 I18nService + LocaleInterceptor
├── src/client/useT.ts                 # 前端 hook（useTranslation 薄封装）
├── src/client/LanguageSwitcher.tsx    # UI 无关容器
├── src/format/                        # formatDate / formatMoney / ...
└── src/detectors.ts                   # locale 检测优先级
```

### Adapter 清单

```
adapters/
└── i18n-file/                       ★ M2（本地 JSON）
```

Tolgee / Crowdin / Lokalise 等翻译平台**不预登记**，真需要协作翻译时再加。

### 里程碑

- **M2**：shared-i18n 核心 + 四语言 × 四命名空间基础翻译 + LanguageSwitcher 骨架 + 格式化工具
- **M3+**：业务模块增量补翻译
- **M6+**：按需 Tolgee 等翻译平台接入

### AI 读解路径（i18n）

- **新抛业务错误的固定五步**：见 core §4.3（错误码枚举 + 后端 BusinessException + 四语言 JSON + 前端自动拦截 + manifest 登记）
- **UI 文案**：前端组件调 `t('namespace:key', params)`，key 不存在时 i18next 会 warn（开发模式）
- **命名空间**：跨 app 共享放 `shared-i18n/locales/<locale>/{common,auth,permission,errors}.json`；app 专属放 `apps/<app>/src/locales/<locale>/<module>.json`
- **后端自己渲染**（邮件 / 短信 / 推送 / Excel / PDF）：`I18nService.t(key, locale, params)`，locale 取 `User.preferredLocale` 而非会话 locale
- **日期 / 货币 / 数字格式化**：用 `formatDate / formatMoney / formatNumber` 导出工具，不直接 `toLocaleString()`
- **时区**：`timestamptz` 全部 UTC 存，前端按 `User.timezone` 展示
- **Locale 来源优先级**：URL 段 > `User.preferredLocale` > `Accept-Language` > 系统默认

**AI 禁止**：

- 在代码里硬编码中文 / 英文字符串（除日志 msg 外）
- 用 `t()` 传完整句子当 key（key 应是 SCREAMING_SNAKE_CASE 的稳定标识）
- 前端 catch 错误后手写错误提示（由 api-client 拦截器统一 t + toast）

**AI 诊断**：用户说"切语言没生效"：

1. 查前端 `X-Locale` header 是否设置
2. 查 `User.preferredLocale` 是否写入
3. 查 i18next http-backend 是否加载到对应 namespace JSON
4. 查 key 是否在 JSON 里存在（missing key 触发 fallback）

---

## 错误上报 / 观察性 / APM 详细设计

### 设计基调

**M2 只做"错误上报 + 结构化日志 + OTEL 代码插桩"三件事**，不默认起 Metrics/Tracing/Logs 聚合后端。指标 dashboard / 告警规则 / trace 可视化都是"有线上真流量之后调出来才有意义"的东西，M2 阶段预置是伪工作量。

### M2 默认方案

| 能力           | 方案                              | 备注                                                     |
| -------------- | --------------------------------- | -------------------------------------------------------- |
| Error Tracking | GlitchTip（MIT，Sentry SDK 兼容） | 单容器 ~200MB 内存；Tier 2 切 Sentry SaaS                |
| 结构化日志     | Pino → stdout → `docker logs`     | 不起 Loki/Promtail；真要聚合 `grep` / `jq` 即可          |
| OTEL 代码插桩  | NodeSDK + 常用 Instrumentation    | `OTEL_ENDPOINT` 为空时不导出；接口留好，未来接后端零改动 |

**Metrics (Prometheus) + Grafana dashboards + Tempo + Loki + Promtail M2 全部不做**。真遇到"线上请求慢 / 突发流量 / 多实例调度怪异" 时再开第二 profile。

### 前端错误捕获（五类全覆盖）

| 类型           | 捕获方式                                       |
| -------------- | ---------------------------------------------- |
| 未捕获 JS 错误 | `window.onerror`（Sentry 自动）                |
| 未处理 Promise | `unhandledrejection`（自动）                   |
| React 渲染错误 | `<Sentry.ErrorBoundary>`                       |
| 网络请求错误   | axios interceptor（500 自动报，业务 4xx 不报） |
| 资源加载失败   | `<script>/<img> onerror`                       |

Breadcrumbs 自动收集最近 50 条操作（路由/点击/API/console），崩溃时随错误上报。脱敏规则：字段名含 `password/token/secret/creditCard` → `***`；Cookie / Authorization header 完全过滤。

### Release 版本 + Source Map

- `VITE_APP_VERSION=1.2.3+${GIT_SHA:0:7}`，Sentry/GlitchTip 按 release 分组聚合
- `@sentry/vite-plugin` 构建时上传 sourcemap 到 GlitchTip
- **不发布到 CDN**（防源码泄漏）；CI 发布后删除 dist 中 .map 文件

### 后端错误捕获

```ts
@Catch()
export class GlobalExceptionFilter {
  catch(exception, host) {
    const isOperational = exception instanceof HttpException && exception.getStatus() < 500;
    if (!isOperational) {
      Sentry.captureException(exception, {
        user: { id: req.user?.id, tenantId: req.user?.tenantId },
        tags: { route: `${req.method} ${req.route?.path}` },
        extra: { query: redact(req.query), body: redact(req.body) },
      });
    }
    // 返回 { error: { code, params } } 让前端翻译
  }
}
```

### OTEL 代码插桩（不起后端）

```ts
new NodeSDK({
  traceExporter: env.OTEL_ENDPOINT ? new OTLPTraceExporter({ url: env.OTEL_ENDPOINT }) : undefined, // 无后端时 trace 直接丢弃，插桩仍生成 traceId 供日志关联
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    new PrismaInstrumentation(),
    new IORedisInstrumentation(),
    new PgInstrumentation(),
  ],
});
```

前端 `FetchInstrumentation` 把 `traceparent` header 注入 fetch/xhr → 后端续传 → pino 日志里自动带 traceId（即便没 Tempo 也能靠 `grep traceId=abc` 串起一次请求）。

未来接 Tempo / Jaeger 仅改 `OTEL_ENDPOINT` 环境变量，零代码改动。

### 结构化日志（Pino → stdout）

Pino 输出 JSON：

```json
{
  "level": "info",
  "time": "2026-04-21T10:00:00Z",
  "tenantId": "t1",
  "userId": "u42",
  "correlationId": "c-abc",
  "traceId": "t-abc",
  "method": "POST",
  "path": "/orders",
  "status": 201,
  "ms": 42,
  "msg": "order created",
  "orderId": "o1"
}
```

`LoggerInterceptor` 每请求自动注入 async-local-storage，业务代码 `logger.info({ orderId }, 'order created')` 自动附带上下文。

`docker logs server | jq 'select(.correlationId=="c-abc")'` 就能捞出单请求全部日志。真要 Loki 聚合时加 Promtail 采集 stdout 即可，代码零改动。

#### 级别语义（core §4.6 的详细落地）

| 级别    | 生产是否输出                | 业务如何选择                                                                       | 是否上报 GlitchTip  |
| ------- | --------------------------- | ---------------------------------------------------------------------------------- | ------------------- |
| `trace` | 否                          | 开发调试临时加，PR 前必删；CI `tripod/no-trace-log` warn                           | 否                  |
| `debug` | 否（`LOG_LEVEL=info` 过滤） | 详细步骤（SQL 打印、缓存命中率、job 子步骤）                                       | 否                  |
| `info`  | 是                          | **关键业务事件**：订单提交、用户登录、job 完成、外部 API 调用                      | 否                  |
| `warn`  | 是                          | **可恢复异常**：重试成功、降级到备用链路、非致命数据异常（老数据缺字段按默认处理） | 否                  |
| `error` | 是                          | **未捕获异常 / 业务致命失败**（数据库死锁、外部服务 5xx、幂等冲突）                | **是**（GlitchTip） |
| `fatal` | 是                          | 进程即将退出的严重错误（配置错到起不来、OOM 前兆）                                 | 是                  |

选错级别的常见反模式：

- 把"用户输入错误 400"打 `error` → 噪声爆炸（实际应 `info` 或不打）
- 把"DB 连接失败"打 `warn` → 应 `error`，否则错过告警
- 把"缓存 miss"打 `info` → 应 `debug`

#### Redaction 默认清单（`shared-logger/src/redaction.ts`）

Pino `redact` 选项启动即生效：

```ts
export const DEFAULT_REDACTION_PATHS = [
  // 凭证类
  'password',
  'pwd',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'authorization',
  'cookie',
  'sessionId',
  'secret',
  'apiKey',
  'apiSecret',
  'privateKey',
  'clientSecret',
  'otp',
  'mfaCode',
  'verificationCode',

  // 金融 / 证件
  '*.creditCard',
  '*.cvv',
  '*.cardNumber',
  '*.ssn',
  '*.idCard',
  '*.idNumber',
  '*.bankAccount',
  '*.iban',
  '*.swift',

  // HTTP headers（LoggerInterceptor 打 request log 时）
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-auth-token"]',

  // Body / query
  'req.body.password',
  'req.body.pwd',
  'req.body.token',
  'req.body.newPassword',
  'req.body.oldPassword',
];

export const REDACTION_CENSOR = '***';
```

**手机号 / 邮箱默认不 redact** — 业务 log 常需要脱敏后半段（`138****5678`）而非全遮；tenant 合规要求严时可在该 tenant 的 config 加自定义 redact paths。

AI 加新字段名含敏感信息（`*_secret` / `*_token` / `*_password` / `*_key` / `*_credential`）→ 必在 `DEFAULT_REDACTION_PATHS` 登记；CI `tripod/redaction-required` lint 扫 DTO / model 字段名 + 自定义 class property，发现未登记项报警告。

#### Request log 固定字段

`LoggerInterceptor` 自动为每个 HTTP 请求写一条 log（`info` 级别），AI **不手打**：

```
method         - GET / POST / PUT / ...
path           - 路由 pattern（/orders/:id，不是具体值，避免 cardinality 爆炸）
status         - HTTP status code
ms             - 请求耗时（毫秒）
tenantId       - 当前 tenant（未登录时 null）
userId         - 当前 user（未登录时 null）
correlationId  - shared-audit 的 correlation（跨 HTTP / BullMQ / webhook）
traceId        - OTEL traceId（上游有 traceparent 时延用，否则本地生成）
userAgent      - 前 256 字节
ip             - X-Forwarded-For 第一段（走可信 proxy header）
requestSize    - content-length
responseSize   - response body bytes
```

业务 `logger.info({...}, msg)` 加的字段会与上述字段合并，**不要重复**添加 `tenantId` / `userId` 等（已在 ALS 里自动注入）。

#### 业务日志风格指南（AI 写 logger.xxx 时）

- 第一参数是**结构化上下文对象**，第二参数是**短消息**：`logger.info({ orderId, totalAmount }, 'order created')`，不要 `logger.info(\`order \${orderId} created with \${amount}\`)`（模板字符串是反模式，破坏结构化检索）
- 消息简短动词短语：`'order created'` / `'payment declined'` / `'retry attempted'`，不是完整句
- 业务错误用 `logger.warn` + 错误码：`logger.warn({ code: ORDER_INVALID_STATE, orderId, currentState }, 'state transition rejected')`
- 外部调用失败：`logger.error({ err, vendor: 'stripe', orderId }, 'payment api call failed')` — `err` 字段 pino 会自动 `serializeError`
- 不要 `console.log` / `console.error` — `tripod/no-console` lint 拦截

### 观察栈启动

```yaml
# infra/compose/observability.yml
services:
  glitchtip: # + postgres + redis
```

```bash
docker compose --profile observability up -d
```

只有 GlitchTip 一个服务（含其依赖的 pg/redis），开发机内存 ~200MB。

### Adapter 清单

```
adapters/
└── error-reporting-glitchtip/      ★ M2
```

Sentry SaaS / 自托管 Sentry / Tempo / Jaeger / Loki / ELK / Prometheus / PostHog / Umami 等**不预登记**，真需要时新增 adapter 包 + 改 `OTEL_ENDPOINT` 等 env 即可。

### shared-logger 包结构

```
packages/shared-logger/
├── src/client/
│   ├── init.ts                      # Sentry SDK 封装
│   ├── error-boundary.tsx           # React ErrorBoundary
│   ├── breadcrumbs.ts
│   ├── mask.ts                      # 敏感数据脱敏
│   └── useReportError.ts
├── src/server/
│   ├── logger.ts                    # pino 封装
│   ├── context.interceptor.ts       # tenantId/userId/traceId 自动注入
│   ├── exception.filter.ts
│   └── otel.ts                      # OpenTelemetry 初始化（endpoint 可空）
└── src/shared/
    ├── error-codes.ts               # 错误码枚举（前后端共享）
    └── redact.ts                    # 脱敏规则
```

不包含 `metrics.ts`（Prometheus client）。真要指标时再加。

### 里程碑

- **M2**：shared-logger 核心（client + server）+ GlitchTip 单容器 + Pino stdout + OTEL 代码插桩（endpoint 可空）+ **最小告警 alert rules**（见下节）
- **未来**：真遇到线上性能/流量问题时加 Tempo / Loki / Prometheus / Grafana + dashboard + alert；首次付费支撑时考虑切 Sentry SaaS

### M2 最小告警（GlitchTip alert rules + shared-notification webhook）

**不等 M6 观察栈升级**。M2 用 GlitchTip 内置的 alert rule 机制即可覆盖核心告警场景；告警渠道复用 shared-notification 的 `channel-webhook`，不另起 Alertmanager。

#### 告警清单（M2 默认预置）

| Rule                 | 触发条件                                                  | 严重度 | 动作                   |
| -------------------- | --------------------------------------------------------- | ------ | ---------------------- |
| **系统级错误**       | `code` 以 `SYSTEM_` 开头，任一事件                        | P0     | 立即 webhook 发 ops 群 |
| **鉴权异常突增**     | `code` 以 `AUTH_` 开头 + 10 分钟内 > 100 次               | P1     | webhook + 邮件 ops     |
| **数据库连接失败**   | event.message 含 `ECONNREFUSED` / `connection terminated` | P0     | 立即 webhook           |
| **BullMQ 死信积压**  | `code=QUEUE_JOB_FAILED` 同 queue 10 分钟 > 20 次          | P1     | webhook                |
| **租户级错误集中**   | 单 tenant 5 分钟内 > 50 个 error event                    | P1     | webhook + 附 tenantId  |
| **未上报的致命异常** | level=fatal + 5 分钟内任一                                | P0     | webhook                |

#### 实现（GlitchTip 内置，零代码）

GlitchTip Web UI 配置：Settings → Alerts → Create rule：

```
Name: System Error - Immediate Alert
Conditions:
  - event.code matches "SYSTEM_*"
  - OR event.message contains "ECONNREFUSED"
Actions:
  - Notification Channel: ops-webhook
  - Minimum interval: 0 (立即)
```

GlitchTip 的 webhook 推送格式 = Sentry 兼容，shared-notification 的 `channel-webhook` adapter 提供一个 `/webhooks/glitchtip-alert` 入站端点，把 GlitchTip 的 JSON 转成内部 NotificationType：

```ts
// 入站后走内部 NotificationService 分发：
@Controller('webhooks/glitchtip-alert')
export class GlitchtipAlertController {
  @Post()
  @Public() // GlitchTip → server，走共享 secret header 校验
  async onAlert(
    @Body() payload: GlitchtipWebhookPayload,
    @Headers('x-glitchtip-secret') secret: string,
  ) {
    this.verifySecret(secret);
    await this.notificationService.send({
      type: 'system:alert',
      priority: payload.level === 'fatal' ? 'P0' : 'P1',
      payload: { code: payload.event.code, count: payload.count, link: payload.url },
    });
  }
}
```

NotificationType `system:alert` 的 ChannelProvider 路由（M2 默认）：

- P0 → email（ops@...）+ webhook（企微/Slack/飞书 — 选你在用的）
- P1 → webhook only

#### 告警生命周期规则

- 每条 alert rule 在 GlitchTip 里打 **owner** 标签（某个团队 / 值班组）
- 每季度 review：过去 90 天从未触发的 rule → 要么删要么放宽阈值
- 告警噪声率（触发数 / 真正出手处理数）> 10:1 时必须收紧阈值（避免狼来了）

#### 与 Prometheus Alertmanager 的边界

**M2 / M3 不做 Prometheus alertmanager**。真需要下面场景时才升级（M6 观察栈升级）：

- 基础设施指标告警（CPU / 内存 / 磁盘 / DB connections）
- 业务自定义 metric 告警（订单量突降、支付成功率异常）
- 多条件组合告警（"错误率 > 1% AND QPS > 100 才告警"）

M2 只要"错误有上报 + 核心类型立即通知"，GlitchTip 够用。

---

## 前端埋点 / 用户行为分析（shared-analytics）

### 设计基调

**与错误上报是两件事**。错误上报（GlitchTip）回答"哪里挂了"；埋点回答"哪个功能用得多 / 哪里流失 / 管理员和员工操作习惯差异"。ERP 里业务侧永远会问这类问题，后期补埋点意味着所有历史页面都要改代码。

**Day 1 就埋，但默认接 null impl**。业务代码一律 `analytics.track('order.submitted', {...})`；M2 默认 adapter 是 `analytics-null`（no-op，0 开销）；后期接 PostHog / Mixpanel / GA 零业务代码改动。

### AnalyticsProvider 接口

```ts
// packages/shared-analytics/src/types.ts
export interface AnalyticsProvider {
  /** 事件埋点。event 命名 `<resource>.<verb>` 或 `ui.<area>.<action>` */
  track(event: string, properties?: Record<string, AnalyticsValue>): void;

  /** 用户身份识别（登录 / 切换 tenant 时调用） */
  identify(
    userId: string,
    traits?: { email?: string; role?: string; tenantId?: string; [k: string]: AnalyticsValue },
  ): void;

  /** 页面级埋点（SPA route change 时 hook 自动调） */
  page(name: string, properties?: Record<string, AnalyticsValue>): void;

  /** 组事件（如 tenant 级聚合） */
  group(groupId: string, traits?: Record<string, AnalyticsValue>): void;

  /** 主动 flush（页面关闭前） */
  flush(): Promise<void>;

  /** 登出 / 清会话 */
  reset(): void;
}

export type AnalyticsValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadonlyArray<string | number | boolean>
  | { readonly [key: string]: AnalyticsValue };
```

### 埋点命名规范（ESLint 强制）

- **业务事件**：`<resource>.<verb>` 全小写 + 动词过去式（`order.submitted` / `invoice.paid` / `user.invited`）
- **UI 事件**：`ui.<area>.<action>`（`ui.nav.menu-clicked` / `ui.form.validation-failed` / `ui.export.download-clicked`）
- **系统事件**：`system.<area>.<verb>`（`system.auth.token-refreshed`）
- **禁**：空格、camelCase、中文、下划线开头；`tripod/analytics-event-naming` lint 拦截

### 标准 properties（自动注入，业务不手传）

```
tenantId, userId, userRole, route, sessionId,
platform (web/ios/android), appVersion, locale, correlationId
```

client 端通过 `AnalyticsContext` provider 从已有的 auth / i18n / router context 读取，业务传入 `properties` 合并（冲突时业务优先，极少见）。

### gen:crud 自动埋点

`pnpm tripod gen:crud <resource>` 产出的代码自动埋：

| 时机              | 事件                                                            |
| ----------------- | --------------------------------------------------------------- |
| resource 创建成功 | `<resource>.created`                                            |
| 状态转换          | `<resource>.state-changed`（props: `fromState`, `toState`）     |
| 删除 / 恢复       | `<resource>.deleted` / `<resource>.restored`                    |
| 导出              | `<resource>.exported`（props: `format`, `rowCount`, `filters`） |
| 列表页访问        | `ui.<resource>.list-viewed`（route interceptor 自动）           |
| 详情页访问        | `ui.<resource>.detail-viewed`                                   |

业务层继续手加自定义事件（`order.bulk-approved` 等）。

### Adapter 清单

```
adapters/
├── analytics-null/             ★ M2 默认（no-op，0 开销）
├── analytics-posthog/          ☆ Tier 2（自托管友好，ERP 首选）
├── analytics-mixpanel/         ☆ Tier 2
├── analytics-ga/               ☆ Tier 2（Google Analytics 4）
└── analytics-segment/          ☆ Tier 2（多 provider 转发器）
```

切换时改 `tripod.config.yaml` 的 `analytics.provider` + env 里配 API key，零业务代码改动。

### shared-analytics 包结构

```
packages/shared-analytics/
├── src/types.ts                # AnalyticsProvider / AnalyticsValue
├── src/server/                 # NestJS module + track helper（后端也能埋）
│   ├── analytics.module.ts
│   └── analytics.service.ts
├── src/client/
│   ├── AnalyticsProvider.tsx   # React Context
│   ├── useAnalytics.ts         # hook
│   ├── usePageTracking.ts      # 自动 page() on route change
│   └── trackElement.tsx        # <TrackButton event="...">
├── src/null/                   # analytics-null impl（内联）
└── src/registry.ts             # 运行时 provider 注入
```

### 前端使用方式

```tsx
// 业务组件
const { track } = useAnalytics();

<Button onClick={() => {
  handleSubmit();
  track('order.submitted', { orderId: o.id, totalAmount: o.totalAmount.toString() });
}}>提交订单</Button>

// 或用组件糖
<TrackButton event="order.submitted" properties={{ orderId: o.id }}>
  提交订单
</TrackButton>
```

### 后端埋点（可选）

后端也能调 `analytics.track()`（走 server-side POST 到 provider），场景：

- Webhook / cron / BullMQ 触发的业务事件（前端未触达）
- 需要 backend 真实源的数据（`order.auto-approved-by-system`）

server 端默认走 `analytics-null`，配置与前端独立（可以前端 posthog + 后端 null，或反之）。

### AI 埋点提示

AI 在实现业务逻辑时**主动**在关键成功点埋点（不要等用户要求），并记到 `<resource>.manifest.ts` 的 `analytics?: string[]` 字段（与 `audits[]` 平行，供 `tripod doctor` 校验）。manifest.ts 示例：

```ts
analytics: ['sales-order.submitted', 'sales-order.approved', 'sales-order.exported'],
```

### 里程碑

- **M2**：shared-analytics 核心 + AnalyticsProvider 接口 + analytics-null 默认 + hooks + TrackButton + gen:crud 自动埋点 + manifest.analytics 字段
- **M3**：PostHog 自托管接入（推荐，开源 + 免费 + self-host）
- **M6+**：按需切 Mixpanel / GA / Segment

### AI 读解路径

- 业务要埋新事件 → 找 `<resource>.manifest.ts` 看 `analytics[]` 有没有，有就直接调 track，无就先在 manifest 加事件名再实现
- 找不到某个事件为什么没被上报 → 先查 `tripod.config.yaml` 的 `analytics.provider` 是不是 null

---

## 业务审计日志体系（shared-audit）

### 与其他"日志"的分工

| 类型                 | 目的                     | 受众             | 保留周期 | 技术                         |
| -------------------- | ------------------------ | ---------------- | -------- | ---------------------------- |
| 应用日志             | 开发排查 bug             | 开发、运维       | 30-90 天 | Pino → stdout（未来接 Loki） |
| APM Trace            | 性能/链路分析            | 开发、SRE        | 7-30 天  | OTEL 插桩（未来接 Tempo）    |
| **业务审计**（本节） | 业务追溯、合规、数据对账 | 运营、审计、客户 | 3-10 年  | Postgres 单表 + 复合索引     |

**典型用例**：追溯某个 SKU 全生命周期、聚合查看一次销售出库流程所有步骤、排查库存数量对不上的断层。

### 核心概念

- **实体审计**：每条 audit 挂**一个主要实体**（entityType + entityId）。需要关联多实体时，记到 `metadata.relatedEntities`，不起多对多表
- **流程关联（Correlation）**：一次流程所有操作共享同一 `correlationId`（如 `sales-order:o-456`），聚合查询即得完整轨迹

### 数据模型（单表）

```prisma
model BusinessAuditLog {
  id            BigInt   @id @default(autoincrement())
  tenantId      String

  actor         String              // userId | 'system' | 'external-api'
  action        String              // 'order.approved' / 'sku.picked'
  entityType    String              // 'order' / 'sku' / 'warehouse'
  entityId      String
  correlationId String?
  summary       String              // 人类可读一句话

  diff          Json?               // { before: {...}, after: {...} }  关键字段变更
  metadata      Json?               // 扩展槽：relatedEntities / reason / workflowStep 等都塞这

  traceId       String?             // 关联 OTEL trace
  createdAt     DateTime @default(now())

  @@index([tenantId, entityType, entityId, createdAt])   // 按实体反查主索引
  @@index([tenantId, correlationId, createdAt])          // 流程聚合
  @@index([tenantId, actor, createdAt])                  // 员工审计
  @@index([tenantId, action, createdAt])                 // 动作统计
}
```

**不做月分区**：Postgres 单表到数千万行 + 复合索引完全够用，单人跑仓储销售三年到不了这个量。真卡住时再加分区（Postgres 可以给存量表加分区，不是灾难）。

**不做 `BusinessAuditLogEntity` 多对多表**：一条审计关联 2+ 实体的场景不多，塞 `metadata.relatedEntities: [{type, id}]` 即可，真需要高频反查"订单 X 关联的所有 SKU 审计"时再抽独立表。

### 埋点：service 层显式调用

```ts
// order.service.ts
async approve(orderId: string, actor: User) {
  const before = await this.prisma.order.findFirstOrThrow({ where: { id: orderId } });

  const updated = await this.prisma.$transaction(async (tx) => {
    const o = await tx.order.update({ where: { id: orderId }, data: { state: 'approved' } });
    return o;
  });

  await this.audit.log({
    action: 'order.approved',
    entityType: 'order',
    entityId: orderId,
    correlationId: currentCorrelationId(),
    summary: `订单 ${orderId} 已审批`,
    diff: { before: { state: before.state }, after: { state: updated.state } },
  });

  return updated;
}
```

**不做装饰器 + AOP（`@AuditAction / @AuditEntities / @AuditDiff` + AuditInterceptor）**：显式 5 行代码 vs 装饰器反射元数据 + Handlebars 模板 + 自动 diff 计算 + AOP 拦截——前者更明确，IDE 可跳转，调试简单。真一个项目里出现 100+ 处 audit 埋点且写法高度重复时再抽。

**不做 Prisma middleware 兜底**：会产生大量"机械的字段变更"垃圾审计。审计应该有业务语义，不是字段 diff 的噪音。

**异步写入保留**：`AuditService.log()` 内部可直接写也可扔 BullMQ job 异步写（env 开关）。不阻塞业务事务。

### CorrelationId 跨进程贯穿（保留）

```ts
return this.correlationContext.run(`sales-order:${orderId}`, async () => {
  await this.orderService.approve(orderId, actor);
});

// BullMQ 跨进程
await queue.add('pick-sku', { ...data, _correlationId: currentCorrelationId() });
```

`shared-audit` 导出 `CorrelationContext`（AsyncLocalStorage 封装），HTTP middleware 和 BullMQ processor 各自 `.run()` 包一下。

**AI 读解路径**：每个资源的审计动作集合**声明在 `<resource>.manifest.ts` 的 `audits` 字段**（见 shared-contract 章节），AI 要列"这个模块有哪些审计动作"直接读 manifest，不 grep service。

### 查询 API

```
GET /audit/by-entity?entityType=sku&entityId=sku-A       → 某 SKU 全生命周期时间线
GET /audit/by-correlation?correlationId=sales-order:o-456 → 一次流程全步骤
GET /audit/by-user?userId=u42&from=...&to=...             → 员工操作审计
```

### 前端可视化（M3 与 UI 库一起）

- SKU 详情页 "操作历史" Tab：按 `by-entity` 拉时间线
- 订单详情页 "流程追溯" Tab：按 `correlationId` 拉轨迹

### 与 Workflow StateHistory 的关系

- `{Entity}StateHistory`：状态机转换流水（工作流引擎内部用）
- `BusinessAuditLog`：任意业务动作（含状态转换 + 扫码 / 改备注 / 盘点等）

状态转换的 service 方法里既写 history 又调 `audit.log()`，两张表显式 double-write。不做 Outbox 消费者同步。

### shared-audit 包结构

```
packages/shared-audit/
├── src/types.ts              # BusinessAuditLog / AuditContext / AuditLogInput
├── src/service.ts            # AuditService.log()（同步或 BullMQ 异步由 env 决定）
├── src/context/              # CorrelationContext (AsyncLocalStorage) + HTTP middleware
├── src/query.service.ts      # by-entity / by-correlation / by-user
└── src/client/
    ├── useAuditTimeline.ts
    └── useAuditCorrelation.ts
```

### 未来升级路径（不预埋）

- 单表到亿级 → 加月分区（Postgres `ATTACH PARTITION` 可在线改）
- 需要全文搜索 → 加 ES 同步 worker + `audit-elasticsearch` adapter
- 审计量爆炸 → 冷数据转 S3 parquet + DuckDB/Athena
- 埋点写法重复度高 → 抽 `@AuditAction` 装饰器
- 多对多实体关联查询频繁 → 拆出 `BusinessAuditLogEntity` 表同步写入

### Adapter 清单

```
adapters/
└── audit-postgres/                 ★ M2（默认，单表 + 复合索引）
```

ES / OpenSearch / ClickHouse / S3 归档等**不预登记**，真到瓶颈时再选型加。

### 里程碑

- **M2**：shared-audit 核心 + Postgres 单表 + 复合索引 + service 层显式 `audit.log()` 调用 + CorrelationContext 跨 HTTP/BullMQ + by-entity / by-correlation / by-user 查询 API
- **M3**：SKU / 订单 / 客户详情页的审计时间线 UI（与 UI 库一起封装）
- **未来**：月分区 / ES 同步 / 冷数据归档 — 单表跑不动时再加，不预埋

---

## 通用基建层详细设计（非业务相关）

这一组基建包覆盖 HTTP 契约 / 全局错误处理 / 限流 / 健康 / 缓存 / 定时任务 / 软删除 / 测试 等无关业务的横向能力。

### shared-contract：HTTP / API 契约标准化（M2 核心）

#### 响应 Envelope

```ts
// 成功
{
  data: T | T[],
  meta?: { page, pageSize, total, hasNext, sort },
  traceId: string,
}

// 错误
{
  error: {
    code: string,          // 机器可读：ORDER_NOT_FOUND / VALIDATION_FAILED / ...
    message: string,       // 备用 fallback（前端翻译为准）
    params?: Record<string, unknown>,
    field?: string,        // 字段级错误时附带
    traceId: string,
  }
}
```

#### HTTP 状态码约定

| 状态码 | 用途                                             |
| ------ | ------------------------------------------------ |
| 200    | 成功（业务错误 **不用** 200，用 4xx）            |
| 201    | 资源创建成功                                     |
| 204    | 删除成功无响应体                                 |
| 400    | 请求参数错误（Zod 校验失败）                     |
| 401    | 未登录 / token 无效                              |
| 403    | 已登录但无权限                                   |
| 404    | 资源不存在（可能被权限隐藏）                     |
| 409    | 冲突（状态机非法转换 / 乐观锁冲突 / 幂等键重复） |
| 410    | 资源已删除                                       |
| 422    | 业务规则违反（库存不足等）                       |
| 429    | 限流                                             |
| 500    | 服务端异常（已上报）                             |
| 503    | 依赖不可用                                       |

#### 分页/排序/筛选统一 Query 语法（M2 保守版）

```
GET /orders?page=1&pageSize=20
         &sort=createdAt:desc,amount:asc
         &filter[status]=pending&filter[customerId]=c123
         &filter[createdAt:gte]=2026-04-14&filter[createdAt:lte]=2026-05-14
         &search=keyword
```

后端 `@Query() params: ListQueryParams` 装饰器统一解析；前端 `useListQuery()` hook 统一传参。

##### 分页硬约束（`PaginationQuery` DTO + ValidationPipe）

| 参数                             | 默认 | 上限      | 超限行为（400 + 错误码）                      |
| -------------------------------- | ---- | --------- | --------------------------------------------- |
| `pageSize`                       | 20   | 100       | `VALIDATION_PAGE_SIZE_TOO_LARGE`              |
| `page`                           | 1    | —         | `< 1` → `VALIDATION_PAGE_INVALID`             |
| `offset` = `(page-1) * pageSize` | —    | **10000** | `VALIDATION_OFFSET_TOO_DEEP`，提示改用 cursor |

**为什么 offset 上限 10000**：

- Postgres `LIMIT 20 OFFSET 100000` 实际行为是扫前 10 万行再丢弃，越深越慢
- 10000 是"管理后台够用（500 页）"与"DB 响应时间可控（p99 < 200ms）"的平衡点
- 超过一般是 UI bug（用户点到第 600 页）或爬虫；拦住比放行好

##### Cursor 分页

资源量级大 / 时序列表（订单、通知、消息、日志）默认走 cursor：

```ts
defineModuleManifest({
  resource: 'sales-order',
  pagination: 'cursor',  // opt-in，默认是 offset
  ...
});
```

`gen:crud` 自动产：

```
GET /orders?cursor=<opaque>&pageSize=20
// response: { items: [...], meta: { nextCursor: '...' | null, pageSize: 20 } }
```

cursor 实现：base64(JSON(`{ createdAt, id }`))；service 用 `where: { AND: [{ createdAt: { lt: c.createdAt } }, { id: { lt: c.id } }] }` 做稳定排序。

##### 统一 helper

AI 加列表查询**禁**自写 `take` / `skip`，统一走：

```ts
import { paginate } from '@tripod-stack/shared-contract';

const result = await paginate(this.prisma.order, query, {
  where: { customerId, status: { in: ['pending', 'approved'] } },
  orderBy: { createdAt: 'desc' },
});
// { items: Order[], meta: { page, pageSize, total, hasNext } }
```

helper 内部执行 pageSize / offset 校验（超限前置抛 `VALIDATION_*`，不打 DB）。

##### filter 运算

**M2 只支持两种 filter 运算**（保守版，白名单字段）：

1. **等值**：`filter[field]=value`（含 `in` 的单值简化，多值 M2 不做）
2. **日期范围**：`filter[field:gte]=...&filter[field:lte]=...`（仅 `DateTime` 字段允许）

**不做**（Tier 2 真需要再抽）：

- 通用 operator DSL（`in` / `not` / `contains` / `>` / `<` 等）
- AND / OR 组合条件树
- 嵌套字段路径（`filter[customer.level]=vip`）
- `include` / 关联预加载语法 —— 直接在 service 里 `include: {...}` 显式指定

**白名单机制**：每个资源的 controller 用 `@AllowedFilters(['status', 'customerId', 'createdAt'])` 声明可过滤字段，解析时非白名单字段直接忽略（不报错，避免前端探测表结构）。

#### 错误码命名规范（`shared-types/error-codes.ts` 前后端共享）

##### 命名格式

`<MODULE>_<CAUSE>_<DETAIL>` — 全大写 snake_case，三段式。

```ts
// packages/shared-types/src/error-codes.ts
export const AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED';
export const AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS';
export const PERMISSION_DENIED_RESOURCE = 'PERMISSION_DENIED_RESOURCE';
export const VALIDATION_REQUIRED_FIELD = 'VALIDATION_REQUIRED_FIELD';
export const VALIDATION_PAGE_SIZE_TOO_LARGE = 'VALIDATION_PAGE_SIZE_TOO_LARGE';
export const ORDER_NOT_FOUND = 'ORDER_NOT_FOUND';
export const ORDER_INVALID_STATE = 'ORDER_INVALID_STATE';
export const INVENTORY_INSUFFICIENT = 'INVENTORY_INSUFFICIENT';
export const IDEMPOTENCY_KEY_CONFLICT = 'IDEMPOTENCY_KEY_CONFLICT';
export const SYSTEM_INTERNAL_ERROR = 'SYSTEM_INTERNAL_ERROR';
```

##### MODULE 前缀白名单

只允许这些前缀（CI `tripod/error-code-prefix` lint 拦截）：

| 前缀          | 语义                                                       |
| ------------- | ---------------------------------------------------------- |
| `AUTH`        | 登录 / token / 凭证相关                                    |
| `PERMISSION`  | 已登录但无权限                                             |
| `VALIDATION`  | 请求参数校验失败（DTO / query / body）                     |
| `TENANT`      | 租户相关错误（配额 / 未激活 / 绑定冲突）                   |
| `SYSTEM`      | 未归类 / 系统级错误                                        |
| `IDEMPOTENCY` | 幂等键冲突                                                 |
| `<resource>`  | 已在 `tripod.manifest.yaml` 登记的业务资源名（upper case） |

##### HTTP status 映射（GlobalExceptionFilter 自动出 status，AI 不传）

| code pattern                                                                 | HTTP status | 示例                             |
| ---------------------------------------------------------------------------- | ----------- | -------------------------------- |
| `VALIDATION_*`                                                               | 400         | `VALIDATION_REQUIRED_FIELD`      |
| `AUTH_*`                                                                     | 401         | `AUTH_TOKEN_EXPIRED`             |
| `PERMISSION_*`                                                               | 403         | `PERMISSION_DENIED_RESOURCE`     |
| `*_NOT_FOUND`                                                                | 404         | `ORDER_NOT_FOUND`                |
| `*_INVALID_STATE` / `*_CONFLICT` / `*_DUPLICATE`                             | 409         | `ORDER_INVALID_STATE`            |
| `IDEMPOTENCY_KEY_CONFLICT`                                                   | 409         | —                                |
| `*_SOFT_DELETED`                                                             | 410         | `ORDER_SOFT_DELETED`             |
| `*_BUSINESS_RULE` / `INVENTORY_INSUFFICIENT` / `PAYMENT_DECLINED` 等业务约束 | 422         | —                                |
| `*_RATE_LIMIT` / `*_QUOTA_EXCEEDED`                                          | 429         | `EXPORT_RATE_LIMIT_EXCEEDED`     |
| `SYSTEM_*` / 未分类                                                          | 500         | `SYSTEM_INTERNAL_ERROR`          |
| `*_DEPENDENCY_UNAVAILABLE`                                                   | 503         | `STORAGE_DEPENDENCY_UNAVAILABLE` |

若 code 不匹配任一 pattern → CI `tripod/error-code-http-mapping` lint 失败，强制归类。

##### 全局唯一性检查

所有 `export const X = 'X'` 的 value 全局唯一（CI lint `tripod/error-code-unique` 扫所有 `*.ts` 的字符串字面量 vs error-codes.ts 登记项，发现重复 value 报错）。

##### 翻译 4 语言强制

每个 code 必在 `packages/shared-i18n/locales/{zh-CN,en-US,zh-TW,ja-JP}/errors.json` 都出翻译；`tripod doctor` 对比 error-codes.ts 清单 vs 每个 locale JSON 的 key 集合，任一缺漏 → error。

#### Idempotency 实现细节（`@Idempotent()` 装饰器）

##### 两种 key 来源（装饰器自动判断）

**外部客户端主动传**（支付 / 下单 / 第三方回调等跨服务关键写）：

```
POST /orders
Idempotency-Key: <客户端生成 UUID v4>
```

AI 写 controller 加 `@Idempotent()` 即可，装饰器从 header 读 key。

**服务端合成**（内部写操作，client 懒得传 key）：

```
key = sha256(userId + ':' + method + ':' + path + ':' + sha256(bodyWithoutVolatileFields))
```

装饰器自动生成，业务代码不感知。`volatile fields` 指 `timestamp` / `requestId` 等易变字段，可在 `@Idempotent({ excludeFields: ['clientRequestTime'] })` 配置。

##### Redis 存储协议

```
key:    tripod:idem:{tenantId}:{userId}:{idempotencyKey}
value:  JSON({
  status: 'in-flight' | 'completed',
  requestHash: '<sha256 of canonical body>',
  httpStatus: number,
  responseBody: string,  // 首次响应序列化
  startedAt: ISO8601,
  completedAt: ISO8601?,
})
TTL:    24h（幂等窗口；默认值，@Idempotent({ ttl: '7d' }) 可覆盖）
```

##### 请求处理流程（拦截器实现）

```
1. 从 header / 合成拿到 idempotency-key
2. Redis SETNX key = { status: 'in-flight', requestHash, startedAt } EX 24h
   - SETNX 成功 → 继续 3
   - SETNX 失败（已存在）→ 读现有值：
     a. status=in-flight + requestHash 相同 → 409 IDEMPOTENCY_IN_FLIGHT（短暂冲突，client 应重试）
     a. status=in-flight + requestHash 不同 → 409 IDEMPOTENCY_KEY_CONFLICT（同 key 不同 body）
     b. status=completed + requestHash 相同 → 直接回放 httpStatus + responseBody（不触业务）
     c. status=completed + requestHash 不同 → 409 IDEMPOTENCY_KEY_CONFLICT
3. 执行业务 handler
4. 写回 Redis：{ status: 'completed', httpStatus, responseBody, completedAt }
5. 返回响应
```

**为什么用 SETNX 而不是 `SET ... NX PX` + 事务**：SETNX 原子 + 简单；value 写的是"占位符"，防并发重复请求；业务完成后覆盖 value。

##### 失败时的 key 清理

业务 handler 抛**未捕获**异常（500 / SIGTERM 硬杀）→ Redis key 留在 in-flight 状态 24h。客户端重试会得到 `IDEMPOTENCY_IN_FLIGHT` 错误，**不会**误认为成功。用户可以：

- 等待 TTL 过期（24h 太长不实际）
- 通过 `DELETE /system/idempotency/:key` + `@RequirePermission('system:idempotency-clear')` 手动清理

若业务抛**有错误码的 BusinessException**（400 / 403 / 422 等可预期错误）→ 拦截器把错误响应也写进 Redis（status=completed + httpStatus=422）。客户端重试得到**相同的错误响应**，保持幂等语义。

##### 强制范围

`@Idempotent()` 装饰器对以下场景**强制**（CI `tripod/require-idempotent-decorator` lint，M3 开 error）：

- 任何 controller method 匹配 `POST|PUT|PATCH /orders/**`（下单、修改、状态转换）
- 任何 controller method 匹配 `POST /payments/**` / `POST /shipments/**`（支付、发货）
- 外部回调 controller（`POST /webhooks/**`）

M2 默认 `off`，M3 引入支付 / 发货业务时显式开 `error`。

##### AI 禁止

- 业务代码里手写 "idempotency check"（`if (await redis.get(...)) return ...`）— 装饰器已做
- 在 SaaS 多租户场景遗漏 `{tenantId}` 段 — 不同租户可能 key 冲突
- 装饰器外调用幂等依赖的 API（如 `this.paymentService.charge(...)` 直接从 cron 触发而不经过 HTTP 入口，也应走 service 层的 `idempotencyHelper.wrap(...)` 替代）

#### X-Request-Id 跨层传递

- 前端 axios 自动生成 + 注入
- 后端 `RequestIdInterceptor` 读 header 或生成 UUID，放进 AsyncLocalStorage + response header
- 和 OTEL traceparent / shared-audit correlationId 三者并存（不同概念但可关联）

#### API 版本化策略（URL 路径版本）

**为什么要版本化**：Tripod 是模板，同一 server 可能并存老项目和新项目；即便单项目，升级移动端客户端需要服务端保留老接口一段时间。**没有版本化的 API 升级 = 客户端强制升级**，不可接受。

##### 选型：URL 路径版本，不用 header

```
✓ GET /api/v1/orders
✗ GET /api/orders   Header: X-API-Version: 1
```

URL 版本的好处：

- Swagger 文档天然按版本分组
- nginx / CDN 缓存规则能按路径细分
- curl / 浏览器 / Postman 调试直观
- 日志 / metrics 的 route 维度自带版本

##### 版本号语义

- `/api/v1` / `/api/v2` — 只有**破坏性变更**才升 major 版本号
- **不用** minor / patch 版本（`v1.1`）— 非破坏性变更直接进现有版本

##### 非破坏性演进（允许，不升版本）

可以对**已发布版本**做：

- 加新字段（response 里，且标 `@ApiProperty({ required: false })`）
- 加可选 query / body 字段
- 加新 endpoint
- 修 bug（行为更符合文档预期）
- 加更严的 validation**用户无法触发的**（如原本就该拒的 payload）
- 放宽约束（原本 `max: 100`，改 `max: 200`）

##### 破坏性变更（必须升版本）

- 删字段 / 改字段类型 / 改字段语义
- 删 endpoint / 改路径
- 加**必填** query / body 字段
- 收紧 validation（原来能过的 payload 现在拒）
- 改 HTTP status 码的语义
- 改 error code 的语义或拆分

##### Deprecation 流程

1. 新版本 `/api/v2/...` 发布，老版本 `/api/v1/...` 保留
2. 老版本 endpoint 的 `@ApiOperation` 加 `deprecated: true`，Swagger 渲染灰色
3. 每次 v1 请求在 response header 返 `Deprecation: true` + `Sunset: <ISO 日期>` + `Link: </api/v2/...>; rel="successor-version"`（HTTP Deprecation RFC 8594）
4. 前端 axios 拦截器看到 `Deprecation` header → 本地 log warn + track analytics 事件 `api.deprecation-warning-hit`
5. **最少 6 个月**宽限期后才能真删 v1（移动端需要时间放新版本）
6. 真删前发 release note + 邮件通知所有注册过 API consumer 的账号

##### Controller 写法

```ts
// apps/server/src/sales-order/v1/sales-order.controller.ts
@Controller('api/v1/orders')
@ApiTags('Sales Orders (v1)')
export class SalesOrderV1Controller {
  // ...
}

// 新版本
@Controller('api/v2/orders')
@ApiTags('Sales Orders (v2)')
export class SalesOrderV2Controller {
  // service 层通常同一个；controller 只变 DTO / 序列化
}
```

目录结构：

```
apps/server/src/sales-order/
├── v1/
│   ├── sales-order-v1.controller.ts
│   └── sales-order-v1.dto.ts
├── v2/
│   ├── sales-order-v2.controller.ts
│   └── sales-order-v2.dto.ts
├── sales-order.service.ts        # 共享
├── sales-order.manifest.ts       # 共享
└── sales-order.module.ts         # 注册两个 controller
```

service 共享，DTO 按版本独立（避免 v2 的 DTO 改动影响 v1 序列化）。

##### ESLint / doctor 强制

- `tripod/api-version-required` — 所有 controller 路径必须匹配 `^api/v\d+/`；允许 `@Public()` 标注的健康检查 / 认证端点例外（`/health/*`, `/auth/*`）
- `tripod/no-duplicate-api-path` — 扫所有 controller，相同 `<method> <path>` 不可多次出现（避免路由冲突）
- `tripod doctor` 检查：OpenAPI spec 里每个 deprecated endpoint 都必须有 `Sunset` 日期；日期过期超 30 天 → error

##### Mobile 客户端兼容策略

Mobile app 启动时自动检查：

- `GET /api/meta/versions` → 返回 `{ supported: ['v1', 'v2'], preferred: 'v2', sunset: { v1: '2027-01-01' } }`
- app 用的版本 ≥ sunset 日期 - 30 天 → 弹"请升级 app"
- app 用的版本已过 sunset → 阻止使用，强制升级

shared-api-client 实现 `VersionCompatibilityCheck` interceptor，挂在 auth 成功后立即跑。

##### v1 → v2 的 AI 辅助迁移

加 CLI 命令 `tripod api-version bump <resource>`：

1. 复制 `<resource>/v1/` 到 `<resource>/v2/`
2. 提示 AI 按 breaking change 描述修改 DTO / service 调用
3. 自动把 v1 所有方法标 `deprecated: true` + `Sunset` 默认 6 个月后
4. 更新 tripod.manifest.yaml 的 API version 清单

#### shared-contract 包结构

```
packages/shared-contract/
├── src/response.ts          # SuccessResponse / ErrorResponse 类型 + 辅助构造函数
├── src/error-codes.ts       # 前后端共享错误码枚举
├── src/pagination.ts        # ListQueryParams / PaginatedResult（含 sort + filter 简单解析，不是 DSL）
├── src/idempotency.ts       # 幂等键生成 + 校验
├── src/request-id.ts        # X-Request-Id 中间件
├── src/decimal-transformer.ts  # 全局 Decimal → string 序列化（见架构原则 §9）
└── src/module-manifest.ts   # defineModuleManifest() — 业务模块 AI 索引卡（见下节）
```

**不做**（Anti-patterns）：

- 不拆独立 `sort.ts` / `filter.ts` — M2 只做"白名单字段 + `eq` + 日期 `between`"的简单映射，收在 `pagination.ts` 里。真需要 `in` / `>` / `like` / AND-OR 组合再抽 DSL（Tier 2）
- 不做 `openapi.ts` 二次封装 — 直接用 `@nestjs/swagger` 原生 `@ApiResponse` / `@ApiOkResponse`，不重复造轮子

#### `defineModuleManifest` — 业务模块 AI 索引卡

`shared-contract` 导出 `defineModuleManifest()`，每个业务资源（order / sku / customer 等）**必须**配一份 `<resource>.manifest.ts` 纯声明文件。

**运行时零开销**：不驱动状态转换 / 不生成权限 / 不注册通知。真值始终在 `*.service.ts` / `*.permissions.ts` / `*.notification-types.ts` 等具体代码里。manifest **只是 AI 读的索引卡**。

**完整 schema**：

```ts
// packages/shared-contract/src/module-manifest.ts
export interface ModuleManifest {
  readonly resource: string; // 'sales-order' / 'customer' / 'sku'
  readonly displayName: string;

  // 状态机摘要（空数组 = 无状态化实体）
  readonly states?: readonly string[];
  readonly transitions?: readonly {
    from: string;
    event: string;
    to: string;
    permission?: string; // 执行此转换需要的权限 id
  }[];

  // 权限节点摘要（与 permissions.ts 一一对应）
  readonly permissions: readonly {
    id: string; // 'sales-order:approve'
    type: 'PAGE' | 'ACTION' | 'DATA_SCOPE';
    sensitive?: boolean; // 涉及敏感字段/操作
  }[];

  // 审计动作摘要（与 service 里 audit.log(action: 'xxx') 一一对应）
  readonly audits?: readonly string[];

  // 通知类型摘要（与 notification-types.ts 一一对应）
  readonly notifications?: readonly string[];

  // 关联实体（用于 audit relatedEntities / 跨实体反查）
  readonly relatedEntities?: readonly string[];

  // 敏感字段（service 层需根据 permission 显式 delete）
  readonly sensitiveFields?: readonly {
    field: string;
    requires: string; // permission id
  }[];

  // 导出声明（与 <resource>.export.ts defineExport 一一对应；无导出能力时省略）
  readonly exports?: readonly string[];
}

export function defineModuleManifest<T extends ModuleManifest>(m: T): T {
  return m;
}
```

**目录约定**：`apps/server/src/<resource>/<resource>.manifest.ts` 路径固定，`tripod doctor` 按此模式扫描。

**一致性检查**（`tripod doctor` + `tripod snapshot`）：

- `states` 数组与 service 方法里出现的 `state: '<x>'` 字符串集合一致
- `permissions[].id` 与 `<resource>.permissions.ts` 声明的节点集合一致
- `audits` 与 service 里 `audit.log({ action: '<x>' })` 出现集合一致
- `notifications` 与 `<resource>.notification-types.ts` 注册集合一致
- `exports[]` 每项都有对应 `<resource>.export.ts` 里的 `defineExport({ resource })` 注册；声明 `exports` 时 `permissions` 必含 `<r>:export`（ACTION），`audits` 必含 `<r>.exported`

不一致时 `unaligned[]` 报 `warn`，AI 必须先修复 manifest 再继续业务改动。

**AI 读模块时的固定顺序**：

1. `<resource>.manifest.ts` — 先建立全局认知
2. `<resource>.permissions.ts` — 详细权限节点
3. `<resource>.service.ts` — 业务方法
4. `<resource>.controller.ts` — HTTP 入口

若 manifest 缺失，AI 第一步是**补 manifest**（通过 grep service 代码反向生成），不是直接回答用户问题。

**`gen:crud <resource>` 自动产出** 包含 `<resource>.manifest.ts`（空状态机 + 5 个默认 CRUD permissions + 无通知），AI 手写模块时从此模板起步。

#### AI 读解路径（shared-contract）

AI 写 HTTP / API 代码前必记：

- **响应**：controller 返回**普通对象**，`ResponseInterceptor` 自动包 `{ data, meta, traceId }` envelope —— AI 不手写 `{ data: ... }`
- **错误**：见 core §4.3（`BusinessException` + 错误码 + params）。**禁** `throw new Error('...')` / `throw new HttpException({ ok: false, ...})`
- **分页查询**：`@Query() params: ListQueryParams`（自动解析 `page / pageSize / sort / filter / search`），不手写解析
- **响应分页**：service 返回 `PaginatedResult<T>`，envelope 里 `meta: { page, pageSize, total, hasNext }` 自动填
- **幂等写操作**：controller 方法加 `@Idempotent()` 装饰器；CI 检测 payment / shipping / notification 路由缺装饰器会 fail
- **X-Request-Id**：`RequestIdInterceptor` 自动处理，AI 不手处理；通过 `AsyncLocalStorage` 取当前 requestId：`getRequestId()`
- **OpenAPI**：直接用 `@nestjs/swagger` 原生 `@ApiOkResponse({ type: OrderDto })`；`shared-contract` 不包装（避免重复造轮子）
- **orval codegen**：改 DTO 后跑 `pnpm codegen`（或 CI 自动跑）生成 `apps/admin-web/src/api/*.gen.ts`，**禁**手改生成文件

**AI 禁止**：

- 业务错误用 HTTP 200 返回 `{ success: false }` —— 必须 4xx + envelope
- 自定义响应形状 —— 必须走 envelope
- `res.json()` 直接返回裸数据 —— 会绕过 interceptor

---

### shared-notify：UI 无关提示 + 全局错误处理（M2 核心）

#### NotifyTransport 接口

```ts
interface NotifyTransport {
  success(message: string, options?: NotifyOptions): void;
  info(message: string, options?: NotifyOptions): void;
  warning(message: string, options?: NotifyOptions): void;
  error(message: string, options?: NotifyOptions & { code?: string; traceId?: string }): void;

  confirm(options: ConfirmOptions): Promise<boolean>;
  prompt(options: PromptOptions): Promise<string | null>;
}
```

各 app 按 UI 库注册具体实现：

- AntD：`message.success` + `Modal.confirm`
- shadcn：`toast.success` + `<AlertDialog>`
- RN：Toast 库 + `Alert.alert`

#### 全局 axios 错误拦截

```ts
// shared-api-client 配合 shared-notify
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    const { response, config } = err;

    // 网络错误
    if (!response) {
      notify.error(t('errors.NETWORK_UNREACHABLE'));
      return Promise.reject(err);
    }

    const { status, data } = response;
    const errorCode = data?.error?.code;
    const params = data?.error?.params;
    const traceId = data?.error?.traceId;

    // 401 → 登出
    if (status === 401) {
      session.clear();
      router.push('/login');
      return Promise.reject(err);
    }
    // 403 → 业务权限错误，弹提示
    if (status === 403) {
      notify.error(t(`errors.${errorCode ?? 'FORBIDDEN'}`, params));
      return Promise.reject(err);
    }
    // 429 → 限流，自动退避重试（最多 2 次）
    if (status === 429 && config.retryCount < 2) return retryWithBackoff(config);
    // 5xx → 已上报 Sentry，弹通用错误
    if (status >= 500) {
      notify.error(t('errors.SERVER_ERROR'), { code: errorCode, traceId });
      return Promise.reject(err);
    }
    // 4xx 业务错误 → 翻译 code 后弹
    if (errorCode && !config.silent) notify.error(t(`errors.${errorCode}`, params));
    return Promise.reject(err);
  },
);
```

业务代码不写 `try/catch + 弹提示`，拦截器统一处理。需要自定义处理时调 `api.xxx({ silent: true })` 跳过全局提示。

#### shared-notify 包结构

```
packages/shared-notify/
├── src/types.ts             # NotifyTransport / NotifyOptions / ConfirmOptions
├── src/registry.ts          # registerNotifyTransport / useNotify
└── src/null-transport.ts    # 无 UI 场景（SSR / test）默认不弹
```

---

### shared-security：CORS + Helmet + CSRF（M2 核心）

- CORS 策略模板：`admin.{tenantSlug}.example.com` 自动白名单 + 通配规则
- Helmet.js：CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy
- CSRF（cookie-based auth 时启用，JWT 场景天然免疫）
- 请求体大小限制（通常 10MB，上传路由 100MB）
- Content-Type 严格校验

包结构：

```
packages/shared-security/
├── src/cors.ts              # tenant-aware CORS middleware
├── src/helmet.ts            # 默认 Helmet 配置
├── src/csrf.ts              # CSRF protection（可选）
└── src/body-limit.ts        # 按路由差异化 body size limit
```

---

### 限流 Rate Limiting（M2 核心）

基于 `@nestjs/throttler`，多级限流：

| 层级         | 默认规则                  | 目的                         |
| ------------ | ------------------------- | ---------------------------- |
| 全局 / IP    | 1000 req/min              | 防 DDoS                      |
| Per-user     | 300 req/min               | 防单用户刷接口               |
| Per-tenant   | 可配                      | SaaS 分级（免费版 / 付费版） |
| Per-endpoint | `/auth/login` 10 req/5min | 防暴力破解                   |

429 响应带 `Retry-After: N` header，前端 axios 自动退避重试最多 2 次。

---

### 健康检查 + 优雅关停（M2 核心）

#### 三个 endpoint 的职责分工（K8s probe 对齐）

| endpoint              | 对应 K8s probe   | 检查内容                                                              | 失败行为                        |
| --------------------- | ---------------- | --------------------------------------------------------------------- | ------------------------------- |
| `GET /health/live`    | `livenessProbe`  | **只**检查进程是否能响应 HTTP — 不查任何依赖                          | 失败 → 容器重启                 |
| `GET /health/ready`   | `readinessProbe` | DB 连通（`SELECT 1`）+ Redis `PING` + `onApplicationBootstrap` 全跑完 | 失败 → LB 摘流量（容器不重启）  |
| `GET /health/startup` | `startupProbe`   | Prisma 已 apply 最新 migration + seed 完成（若启用）                  | 启动阶段专用，通过后 ready 接管 |

**live 为什么不查依赖**：依赖抖动（Redis 短暂不可达）会触发 liveness 失败 → K8s 重启容器 → 雪崩。liveness 只保证"这个进程没死锁"。

**ready 为什么不查外部第三方**（S3 / 邮件 SMTP / 支付网关）：第三方抖动不代表本服务不可用，readiness 失败 = LB 摘流量，等于把外部故障传导成本服务宕机。

#### SIGTERM 处理顺序（`shared-security/GracefulShutdownModule` 实现，业务代码不感知）

```
1. readiness endpoint 立刻返回 unhealthy（503） → LB 摘流量（~5s 感知窗口）
2. 停止接新 HTTP 请求（NestJS app.close() 的 beforeShutdown 钩子）
3. 等 in-flight HTTP 请求跑完，上限 30s（超时强制关）
4. BullMQ worker 停接新 job；等 in-flight job 跑完，上限 60s
   - 超时调 worker.close(force=true) 硬杀
   - 硬杀的 job 会被 BullMQ 自动 retry（幂等保证见 §4.6 `@Idempotent`）
5. 关 Prisma pool + Redis client + OTEL exporter flush
6. process.exit(0)
```

Docker compose 配置：`stop_grace_period: 120s`（3 + 4 + 余量 30s）。超 120s 时 docker 会 SIGKILL，必丢数据。

#### 实现约束

- 所有依赖的 Module 若需在 shutdown 做清理，实现 `OnModuleDestroy` 钩子；NestJS 按注入顺序反向调用
- 业务代码**禁**自注册 `process.on('SIGTERM', ...)` — 会和 `GracefulShutdownModule` 冲突
- BullMQ Processor 需把 `job.updateProgress` 调用放在幂等点之间，硬杀时最差回滚到上一个 progress
- 启动阶段 Prisma migration 失败 → startup probe 持续 503 → K8s 最终按 `failureThreshold` 放弃，不会进入 ready 阶段

#### Docker Compose / K8s 模板对照

**compose**（M2 默认自建部署）：

```yaml
server:
  healthcheck:
    test: ['CMD', 'wget', '--quiet', '--tries=1', '-O-', 'http://localhost:3000/health/ready']
    interval: 10s
    timeout: 3s
    retries: 3
    start_period: 30s
  stop_grace_period: 120s
```

**K8s**（Tier 2 / M6 激活）：

```yaml
livenessProbe:
  { httpGet: { path: /health/live, port: 3000 }, periodSeconds: 10, failureThreshold: 3 }
readinessProbe:
  { httpGet: { path: /health/ready, port: 3000 }, periodSeconds: 5, failureThreshold: 2 }
startupProbe:
  { httpGet: { path: /health/startup, port: 3000 }, periodSeconds: 5, failureThreshold: 60 }
terminationGracePeriodSeconds: 120
```

---

### shared-cache：缓存抽象（M2 后期）

```ts
interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSec?: number): Promise<void>;
  del(keys: string | string[]): Promise<void>;
  wrap<T>(key: string, fn: () => Promise<T>, ttlSec: number): Promise<T>; // cache-aside
  invalidate(pattern: string): Promise<void>; // 按 pattern 失效
}
```

- M2：Redis 实现
- **多租户前缀自动**：所有 key 自动 prefix `tenant:{id}:`
- `@Cacheable({ ttl: 60 })` 方法装饰器
- stale-while-revalidate 模式（返回旧值 + 后台刷新）

包结构：

```
packages/shared-cache/
├── src/types.ts
├── src/redis-cache.provider.ts
├── src/decorators/
│   ├── cacheable.decorator.ts
│   └── cache-evict.decorator.ts
└── src/patterns/
    ├── cache-aside.ts
    └── stale-while-revalidate.ts
```

---

### shared-scheduler：定时任务 + 分布式锁（M2 后期）

- 基于 `@nestjs/schedule`（CRON 表达式）+ BullMQ repeatable jobs
- **分布式锁**：多实例下同一任务只跑一次（Redis SETNX + TTL）
- Per-tenant 任务：每个 tenant 独立 CRON（例如不同公司不同对账时间）
- 任务执行进 BusinessAuditLog（actor='system'）
- 失败告警：连续 3 次失败写 `audit.log({ action: 'scheduler.failed' })` + 错误上报到 GlitchTip（未来接 Prometheus alertmanager 时再用 metrics）

```ts
@Scheduled({ cron: '0 2 * * *', lock: true })  // 每天凌晨 2 点，全局锁
async dailyCleanup() { ... }

@Scheduled({ cron: '0 8 * * *', perTenant: true })  // 每 tenant 独立跑
async dailyReport(ctx: TenantContext) { ... }
```

包结构：

```
packages/shared-scheduler/
├── src/scheduler.service.ts
├── src/decorators/scheduled.decorator.ts
├── src/lock/redis-lock.ts         # 分布式锁
├── src/per-tenant-scheduler.ts    # 按 tenant 展开任务
└── src/audit-integration.ts       # 写入 BusinessAuditLog
```

---

### shared-export：业务报表导出（M2 后期）

#### 设计基调

**核心需求驱动**：审计公司 / 财务 / 运营需要"按日期范围导出出货 / 进货 / 调拨清单"等业务流水。这是**业务报表**，数据源是业务主表（不是 BusinessAuditLog），形态是**列表查询 → 流式 CSV/XLSX**。

**砍掉的边界**（Anti-patterns）：

- 不做自定义 SQL 查询接口（暴露面太大 + 权限 / 多租户边界失守）
- 不做报表定义 DSL / 低代码报表配置（违反"代码驱动 CRUD 铁律"）
- 不默认做 PDF / 图表 / dashboard 预置
- 不默认做异步 job + 邮件发链接（大数据量场景再按"未来升级路径"加）
- 不预埋 ClickHouse / OLAP 同步
- **M2 只做 xlsx**，不做 csv（审计公司 / 财务默认 Excel，csv 移 Tier 2 真需要再加 writer）
- **前端不提供 `useExport` hook**，一行 `window.location.href = '/api/<r>/export?...'` 触发浏览器下载即可；真需要状态管理时业务层自己封装

**只做**：

1. 每个业务资源**可声明**一个 `export` 配置（列定义 + i18n key + 敏感字段标记）
2. 统一 controller 约定：`GET /<resource>/export?...filters`（默认 xlsx）
3. 复用现有列表查询的 `where` 构造逻辑（`shared-contract` 的 Query 语法）→ 保证"列表能查出来的"就"能导出"
4. 流式写入，不 load 全表到内存（千万级单租户数据可用）
5. 权限走现有 ACTION PermissionNode；敏感字段走现有 sensitiveFields
6. 导出动作走现有 BusinessAuditLog

#### defineExport — 业务资源声明导出

```ts
// apps/server/src/stock-movement/stock-movement.export.ts
import { defineExport } from '@tripod-stack/shared-export';

export const STOCK_MOVEMENT_EXPORT = defineExport({
  resource: 'stock-movement',
  permission: 'stock-movement:export', // 必须已存在于 permissions.ts
  defaults: {
    sort: 'occurredAt:desc',
  },
  filters: {
    // 允许的 where 字段（白名单，M2 只 eq + date between）
    occurredAt: { op: 'between', required: true }, // 审计场景强制日期范围
    direction: { op: 'eq' }, // M2 不做 in；多选业务侧分多次调
    skuId: { op: 'eq' },
    warehouseId: { op: 'eq' },
  },
  columns: [
    // 顺序 = 导出列顺序
    { key: 'occurredAt', i18n: 'sm.occurred-at', format: 'datetime' },
    { key: 'direction', i18n: 'sm.direction', format: 'enum', enumI18nPrefix: 'sm.dir' },
    { key: 'skuCode', i18n: 'sm.sku-code' },
    { key: 'skuName', i18n: 'sm.sku-name' },
    { key: 'quantity', i18n: 'sm.qty', format: 'decimal' }, // 走 decimal.js
    { key: 'warehouseName', i18n: 'sm.warehouse' },
    {
      key: 'costUnit',
      i18n: 'sm.cost-unit',
      format: 'money',
      sensitive: 'stock-movement:read-cost',
    },
    { key: 'refOrderNo', i18n: 'sm.ref-order' },
    { key: 'operatorName', i18n: 'sm.operator' },
    { key: 'remark', i18n: 'sm.remark' },
  ],
});
// 注：maxRows / 游标步长等常量在 shared-export 源码里硬编码（M2：maxRows=500_000 / batchSize=10_000），不开配置位
```

**敏感字段**：列的 `sensitive` 指向一个 ACTION permission id；用户没有该权限时**整列不出**（不是出空值，避免"字段不对齐"误导）。

#### manifest.ts 联动

`<resource>.manifest.ts` 加 `exports` 字段与 `defineExport` 声明一致：

```ts
export const STOCK_MOVEMENT_MANIFEST = defineModuleManifest({
  resource: 'stock-movement',
  // ...
  permissions: [
    { id: 'stock-movement:list-page', type: 'PAGE' },
    { id: 'stock-movement:export', type: 'ACTION' },
    { id: 'stock-movement:read-cost', type: 'ACTION', sensitive: true },
  ],
  audits: ['moved', 'exported'], // ⬅ 必含 'exported'
  exports: ['stock-movement'], // ⬅ 新增字段，AI 读模块能一眼知道"这个资源支持导出"
});
```

`tripod doctor` 检查一致性：

- `exports[]` 里每项都要有对应 `defineExport` 注册
- `audits` 必含 `<resource>.exported`
- 每个 sensitive 列的 permission id 必在 `permissions[]` 里

#### Controller 统一约定

```ts
@Controller('stock-movements')
export class StockMovementController {
  @Get('export')
  @RequirePermission('stock-movement:export')
  @Header('Cache-Control', 'no-store')
  async export(
    @Query() query: ExportQueryDto, // shared-export 提供的 DTO 基类
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    return this.exportService.stream({
      config: STOCK_MOVEMENT_EXPORT,
      query,
      user,
      res,
      dataSource: (cursor, batchSize) =>
        this.stockMovementService.listCursor(cursor, batchSize, query),
    });
  }
}
```

**`exportService.stream()` 内部**：

1. 校验 `query` 白名单（只认 `defineExport.filters` 里声明的字段）
2. 按用户权限过滤列（敏感列抹掉）
3. xlsx 写入走 `exceljs` streaming
4. 游标分页 `dataSource(cursor, batchSize)` 调业务 service，`for await` 往 response 流写
5. 完成后 `audit.log({ action: 'stock-movement.exported', entityType: 'stock-movement', entityId: `export-${requestId}`, summary: '...', metadata: { rowCount, filters } })`
6. 超硬上限（源码常量 `MAX_ROWS = 500_000`）→ 抛 `BusinessException(EXPORT_TOO_LARGE, { max })`，前端翻译为"请缩小日期范围或分段导出"

**文件名**：Content-Disposition 格式 `<resource>_<tenantSlug>_<fromDate>_<toDate>_<timestamp>.xlsx`，审计公司一眼看清范围。

#### 多租户

查询走业务 service → Prisma middleware 自动加 tenantId。**不允许**在 export 路径绕过 middleware。ESLint rule（新）：`tripod/no-prisma-raw-in-export` — export.service 文件里禁 `prisma.$queryRaw` / `$unscoped`。

#### 前端集成

M2 **不提供** `useExport` hook；业务层一行搞定：

```ts
const url = buildUrl('/api/stock-movements/export', { 'filter[occurredAt:gte]': from, ... });
window.location.href = url;          // 浏览器自动下载；错误码走全局错误拦截器
```

需要进度 / 取消等高级状态时，业务自己用 axios `responseType: 'blob'` 封装。真抽成通用 hook 时走 Tier 2。

UI 层（M3 随 `BasePage/List` 封装）：列表页右上角"导出"按钮，仅 `hasPermission('<r>:export')` 时显示；点击复用当前筛选条件。

#### 包结构

```
packages/shared-export/
├── src/define-export.ts          # defineExport() 类型 + 校验
├── src/export.service.ts         # stream() 主逻辑 + 游标循环（M2 常量 MAX_ROWS / BATCH_SIZE 硬编码）
├── src/writers/
│   └── xlsx-writer.ts            # exceljs 流式（M2 唯一 writer）
├── src/dto/export-query.dto.ts   # class-validator 基类
├── src/audit-integration.ts      # 统一写 exported audit
└── src/permission-filter.ts      # 按用户权限抹敏感列
```

**依赖**（第三方）：`exceljs`（XLSX 流式）。
**不装**：`fast-csv` / `@fast-csv/format`（Tier 2 加 csv writer 时再装）。

#### 里程碑

- **M2 后期**：核心 service + xlsx writer + 3 条后端 API 样例（订单 / 入库 / 出库）+ `tripod doctor` 的 exports 一致性校验 + 500k 行单租户性能测试
- **M3**：`BasePage/List` 集成"导出"按钮 + 列选择 UI（用户可临时勾选要的列子集）
- **Tier 2（未来升级路径）**：
  - csv writer（`fast-csv`）+ format 参数支持
  - 前端 `useExport` hook（若真出现复用需求）
  - 异步导出：超过上限的导出任务推 BullMQ，完成后 email 发 shared-storage 预签名链接
  - PDF：真有审计要 PDF 时加 `pdf-lib` writer（不是默认）
  - OLAP / ClickHouse 同步：业务体量到亿级时考虑

#### Anti-patterns（Anti-patterns 章节对应条目）

- 不预埋 PDF writer / 图表 / 报表定义 DSL
- 不建"报表中心"统一页面（每个资源自己的列表页出导出按钮）
- 不默认做异步任务 + 邮件发送
- 不做自定义 SQL / 用户可输入字段名的动态查询
- 不预埋 OLAP 同步

#### AI 读解路径（shared-export）

1. 用户说"加导出 / 加报表"
2. AI 先读 `<resource>.manifest.ts` 的 `exports` 字段
3. 若缺 `exports[]`：在 manifest / permissions / audits 三处同步加，再建 `<resource>.export.ts` 用 `defineExport`
4. 走 `gen:crud` 或手写 controller 的 `@Get('export')` endpoint
5. 写完跑 `tripod doctor` 验一致性 + 跑 AI 自检协议 6 步

---

### 软删除约定（M2 后期）

#### 资源 opt-in，不是全局强制

**不是**所有业务表都软删除。资源在 `<r>.manifest.ts` 声明：

```ts
defineModuleManifest({
  resource: 'sales-order',
  softDelete: true,   // opt-in 软删除
  ...
});
```

`gen:crud` 根据此开关产不同代码：

- `softDelete: true` → prisma model 带 `deletedAt` + middleware 纳管 + `restore` 方法 + `<r>:restore` 权限 + `audits` 含 `'restored'`
- `softDelete: false`（默认） → 真删，`DELETE` 直通 DB

**该软删的典型**：订单 / 客户 / SKU / 合同 — 有业务关联，误删需恢复  
**该真删的典型**：临时 token / 登录日志 / 通知已读标记 / 缓存表 — 量大 + 无恢复价值

#### prisma schema 约定

```prisma
model Order {
  // ...
  deletedAt   DateTime?  @db.Timestamptz(6)
  deletedBy   String?    @db.Uuid            // 删的人（审计用）
  deleteReason String?                        // 删除原因（可选，UI 弹窗填）

  @@index([tenantId, createdAt], map: "order_tenant_active_idx")
  // ↑ 通过 migration 手写 WHERE deleted_at IS NULL 变部分索引
}
```

migration 里追加：

```sql
-- 部分索引：活跃行查询优化
DROP INDEX order_tenant_active_idx;
CREATE INDEX order_tenant_active_idx ON "order" (tenant_id, created_at)
  WHERE deleted_at IS NULL;
```

活跃行索引体积 ≈ 全表索引的 40-60%（删率越高差距越大）。

#### Prisma middleware 行为

| Prisma API                                                      | 默认行为（软删资源）                                        | 说明                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| `findMany` / `findFirst` / `findUnique` / `count` / `aggregate` | 自动加 `where: { deletedAt: null }`                         | AI 写查询不手加                         |
| `update` / `updateMany`                                         | 不改                                                        | 但只影响未删数据（因为 where 自动过滤） |
| `delete` / `deleteMany`                                         | 改写为 `update { deletedAt: now(), deletedBy: ctx.userId }` | 自动走软删                              |
| `create`                                                        | 不改                                                        | 新数据 deletedAt = null                 |

**显式跨越软删除**（查已删数据）：

```ts
await prisma.$withDeleted(() =>
  prisma.order.findMany({ where: { tenantId, deletedAt: { not: null } } }),
);
// middleware 识别 $withDeleted 包裹，跳过过滤
// 必记 audit.log({ action: 'query.with-deleted', resource: 'order' })
```

AI 使用场景：**仅** 超管回收站 API / 数据修复脚本 / GDPR 导出，业务代码一律不用。

#### 恢复 API

`POST /<resource>/:id/restore`

```ts
@Controller('orders')
export class OrderController {
  @Post(':id/restore')
  @RequirePermission('sales-order:restore')
  @Idempotent()
  async restore(@Param('id') id: string, @CurrentUser() user: User) {
    return this.orderService.restore(id, user.id);
  }
}
```

service 实现：

```ts
async restore(id: string, restoredBy: string) {
  const order = await this.prisma.$withDeleted(() =>
    this.prisma.order.findFirst({ where: { id, deletedAt: { not: null } } })
  );
  if (!order) throw new BusinessException(ORDER_NOT_FOUND_OR_NOT_DELETED);

  const restored = await this.prisma.order.update({
    where: { id },
    data: { deletedAt: null, deletedBy: null, deleteReason: null },
  });
  await this.audit.log({ action: 'sales-order.restored', resourceId: id, actor: restoredBy });
  return restored;
}
```

#### 回收站 UI / 硬删除

- 回收站 UI：M3（UI 库决策后）统一做"已删除 <resource>"列表 + 批量恢复，走 `GET /<r>?deleted=true` 开关
- 保留期：M2 默认 **180 天**（超过走 CRON 硬删 + audit.log）— 比 30 天保守，给恢复留时间；可在 `tripod.config.yaml` 调
- CRON `soft-delete-gc`（shared-scheduler，`@Scheduled({ cron: '0 3 * * *' })`） 扫 `deletedAt < now() - 180d` 的行批量硬删
- **硬删除 API**（GDPR / 用户销户）：`DELETE /<r>/:id/hard-delete` + `@RequirePermission('system:gdpr-erase')` + 审计标红；调 `prisma.$hardDelete(() => prisma.user.delete({ where: { id } }))`，middleware 放行

#### 跨资源级联

- 软删 `Customer` **不**级联软删 `Order`（订单是独立业务凭证，不因客户删除而失效）
- 软删 `SKU` 时关联的未完成订单走校验拒删（`BusinessException` 提示先处理订单）
- 级联规则写在 service 层 `beforeSoftDelete(entity)` 钩子，**不**走 prisma `onDelete: Cascade`（cascade 是真删语义）

#### AI 写代码禁令

- 手写 `where: { deletedAt: null }` — middleware 重复 + 遗漏风险
- `prisma.$executeRaw('DELETE FROM ...')` — 绕过 middleware，默默真删
- list 查询默认返回已删（除非是"回收站" API 明确声明 `?deleted=true`）
- 软删资源的 `update` 漏检 `deletedAt`，导致改到已删行的数据（middleware 自动挡了，但 raw SQL 不挡，注意）

---

### tripod-cli 扩展（`apps/cli`）

详细设计见 `## Tripod CLI 与项目配置体系` 章节。此处列命令清单。

```
# 项目生命周期（M1 基础版 + M2 完整版，对接 tripod.manifest.yaml / tripod.config.yaml）
pnpm create tripod <name> --recipe=<r>     # M1：脚手架新项目（minimal / erp-standard / erp-commerce）
pnpm create tripod <name> --from-config=<file>  # M2
pnpm tripod status                          # M1：config 摘要
pnpm tripod recipe list / recipe show <n>   # M1
pnpm tripod list-apps                       # M1：当前 app 清单 + 可装 app type
pnpm tripod validate [config-file]          # M1：JSON Schema 校验

pnpm tripod add-app <type>                  # M2：装 app（复制模板 + patch 根文件 + 激活关联 feature）
pnpm tripod remove-app <type>               # M2：禁 app（保守，重命名为 _disabled-*）
pnpm tripod add <feature>                   # M2：启用 feature（从 disabled 恢复 或 全量装）
pnpm tripod remove <feature>                # M2：禁用 feature（保守，保留代码）
pnpm tripod add-adapter <slot>=<name>       # M2：装 adapter
pnpm tripod remove-adapter <slot>=<name>    # M2：卸 adapter（激进，真删 package.json）
pnpm tripod demo <name>                     # M2：生成独立 demo 参考实现
pnpm tripod demo remove <name>              # M2
pnpm tripod doctor                          # M2：深度体检（env / 标记 / import 一致性 / migration）
pnpm tripod prune                           # M2：清理未对齐的 adapter
pnpm tripod platform:seed                   # M2+：随 add-app platform 提供，创建初始超管

# 数据库（M2）
pnpm tripod db:migrate / db:seed / db:reset

# 代码生成（M2）
pnpm tripod gen:crud <resource>             # 生成前后端 CRUD 骨架
pnpm tripod gen:permission <resource>       # 生成 permissions 声明
pnpm tripod gen:workflow <machine>          # 生成状态机骨架
pnpm tripod gen:notification-type <id>      # 生成通知类型

# Lint（M2）
pnpm tripod lint:prisma                     # 校验业务表必含 tenantId + deletedAt + RLS policy

# 环境变量（M2）
pnpm tripod env:validate <file>             # Zod schema 校验（build.sh 首步强制）
pnpm tripod env:gen-example                 # 从 Zod schema 反向生成 .env.prod.example
pnpm tripod env:doctor <file>               # 深度体检：默认值 / localhost / 弱密钥 / 开发态残留

# 版本（M2）
pnpm tripod release                         # 交互式加 changeset
pnpm tripod changeset-context               # 给 Claude Code 读的结构化 JSON

# Tier 2
pnpm tripod sync                            # 从上游模板拉新 feature 定义
pnpm tripod repair <file>                   # AI 辅助找回 hot-spot 文件的 magic comment 标记
pnpm tripod platform:enroll-mfa             # 给 platform admin 绑定 TOTP（可选开启 MFA 后用）
```

包结构：

```
apps/cli/
├── src/commands/
│   ├── lifecycle/                          # create / status / recipe / add / remove / doctor
│   ├── db/
│   ├── gen/
│   ├── lint/
│   ├── env/
│   └── release/
├── src/manifest/                           # manifest.yaml 解析 + JSON Schema
├── src/config/                             # config.yaml 读写 + diff
├── src/templates/                          # 脚手架模板（Handlebars）
└── bin/tripod                              # 入口
```

---

### shared-test：测试基础设施（M2 后期）

#### Factories（基于 faker）

```ts
// packages/shared-test/src/factories/order.factory.ts
export const orderFactory = defineFactory<Order>({
  tenantId: () => currentTenant(),
  amount: () => faker.number.float({ min: 10, max: 10000 }),
  status: 'draft',
  ...
});

// 使用
const order = await orderFactory.create();
const orders = await orderFactory.createMany(10, { status: 'shipped' });
```

#### 多租户测试隔离

```ts
describe('Order API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestTenant();  // 自动创建 tenant + 清理 hook
  });

  afterEach(async () => {
    await ctx.cleanup();              // 删 tenant + 所有业务数据
  });

  it('creates order', async () => {
    const order = await ctx.as('warehouse-manager').createOrder(...);
    expect(order).toBeDefined();
  });
});
```

#### E2E 基础

- Playwright config 模板 + 测试 DB（docker-compose `test` profile）
- 每个 spec 独立 tenant + user
- 登录 fixture / 权限 fixture / 测试数据 fixture

#### 前端 API mock

- MSW（Mock Service Worker）集成
- 从 OpenAPI 自动生成 mock handlers

包结构：

```
packages/shared-test/
├── src/factories/
├── src/test-context.ts         # createTestTenant / TestContext class
├── src/fixtures/               # 登录 / 权限 / 常用数据 fixture
├── src/e2e/                    # Playwright helpers
└── src/msw/                    # API mock handlers
```

---

### 里程碑归纳

| 模块                            | 阶段                       |
| ------------------------------- | -------------------------- |
| shared-contract                 | M2 核心                    |
| shared-notify                   | M2 核心                    |
| shared-security (CORS / Helmet) | M2 核心                    |
| 限流 Rate Limiting              | M2 核心                    |
| 健康检查 + 优雅关停             | M2 核心                    |
| shared-cache                    | M2 后期                    |
| shared-scheduler                | M2 后期                    |
| 软删除约定                      | M2 后期                    |
| tripod-cli 扩展                 | M2 后期                    |
| shared-test                     | M2 后期                    |
| **shared-feature-flag**         | M2 后期                    |
| **shared-analytics**            | M2 后期                    |
| **shared-deeplink**             | M2 后期（Mobile 接口前置） |

---

## Feature Flag / 灰度机制（shared-feature-flag）

### 设计基调

**不做"超大型 SaaS 级 flag 系统"**，只做"ERP 模板复用时的必备灰度能力"。M2 本地实现够用，接口标准化后可接 Unleash / LaunchDarkly / Flagsmith。

ERP 的典型 flag 场景：

- 新功能先开给 tenant A 试点，稳定后开给全部 tenant
- 重构某个模块时，新老两套并存，按 flag 切换实现（canary）
- 实验性 UI 给内部测试账号看
- 紧急 kill-switch：线上出问题立刻关闭某功能（不用发版）

### FeatureFlagProvider 接口

```ts
// packages/shared-feature-flag/src/types.ts
export interface FeatureFlagProvider {
  /** 判断 flag 是否启用（最常用） */
  isEnabled(flag: string, ctx?: FlagContext): boolean;

  /** 返回 variant（多桩 A/B 测试） */
  getVariant(flag: string, ctx?: FlagContext): string | null;

  /** 一次拿该用户所有 flag 状态（前端初始化用）*/
  getAllFlags(ctx: FlagContext): Record<string, boolean | string>;

  /** 运行时刷新（收到配置更新通知时调）*/
  refresh?(): Promise<void>;
}

export interface FlagContext {
  tenantId?: string;
  userId?: string;
  userRole?: string;
  custom?: Record<string, string | number | boolean>;
}
```

ctx 从 AsyncLocalStorage 自动注入（服务端）/ AuthContext 自动注入（前端），业务代码一般不手传：

```ts
// 后端
if (this.featureFlags.isEnabled('new-approval-flow')) {
  return this.newApprovalService.approve(orderId);
} else {
  return this.legacyApprovalService.approve(orderId);
}

// 前端
const isEnabled = useFeatureFlag('new-ui-layout');
return isEnabled ? <NewLayout /> : <LegacyLayout />;
```

### M2 本地实现（默认，0 依赖）

Flag 存 **两层**：

1. **全局默认**：`tripod.config.yaml` 里 `featureFlags: { newApprovalFlow: false }`
2. **Tenant 覆盖**：`Tenant.featureFlags` JSONB 字段，platform 超管从管理后台勾选每 tenant 的开关

```prisma
model Tenant {
  // ...
  featureFlags  Json  @default("{}")    // { "newApprovalFlow": true, "betaUi": "variant-a" }
}
```

运行时读取顺序（`LocalFlagProvider`）：

1. `ctx.tenantId` → `tenant.featureFlags[flag]` 有值则用
2. 回落 `tripod.config.yaml` 的全局默认
3. 都没有 → `false`

Redis 缓存 `tenant:{id}:flags` TTL 60s，避免每次 isEnabled 打 DB；tenant.featureFlags 改动时走 `shared-cache` invalidate。

### Flag 生命周期（强制）

**Flag 最容易变成飞线积累到删不掉**。强制每个 flag 有生命周期：

```yaml
# tripod.config.yaml
featureFlags:
  newApprovalFlow:
    default: false
    description: '新的订单审批流，替代 legacy service'
    createdAt: '2026-04-22'
    expectedRemoveAt: '2026-10-22' # 6 个月后必须处理
    owner: 'backend-team'
    status: 'rolling-out' # experimental | rolling-out | stable | deprecated

  legacyApprovalFlow:
    default: true
    description: '老审批流 — 保留直到新流验证稳定'
    createdAt: '2024-01-01'
    expectedRemoveAt: '2026-07-01'
    status: 'deprecated' # 提示即将删除
```

`tripod doctor` 检查：

- `expectedRemoveAt < today` 且 status ≠ `stable` → error（必须处理：删 flag 代码 或更新 expectedRemoveAt）
- `status: stable` 的 flag → warn，提示"已稳定，考虑删除 flag 代码让其成为常态"
- 代码里用了 config.yaml 未登记的 flag → error
- config.yaml 登记但代码从没用到的 flag → warn

### 前端实现

```tsx
// packages/shared-feature-flag/src/client/
<FeatureFlagProvider initialFlags={window.__FLAGS__}>
  <App />
</FeatureFlagProvider>;

// 在 root layout 初始化：SSR/HTML 里注入 window.__FLAGS__
// = result of getAllFlags(ctx from JWT) on server side
// 避免前端先渲染 legacy 再 flash 到 new

// 业务用：
const isEnabled = useFeatureFlag('new-ui-layout');
const variant = useFlagVariant('checkout-button-color'); // 'blue' | 'red' | null

// <Flag> 组件糖
<Flag name="new-export-ui" fallback={<LegacyExportButton />}>
  <NewExportPanel />
</Flag>;
```

### Adapter 清单

```
adapters/flag-local/         ★ M2 默认（DB + config.yaml 本地实现）
adapters/flag-unleash/       ☆ Tier 2（开源 + 自托管）
adapters/flag-launchdarkly/  ☆ Tier 2（商业）
adapters/flag-flagsmith/     ☆ Tier 2（开源 + 商业双版本）
adapters/flag-posthog/       ☆ Tier 2（PostHog 自带 flag 能力，和 analytics 共用）
```

切换只改 `tripod.config.yaml` 的 `featureFlag.provider` + env key，业务代码零改动。

### 管理 UI（M3 随 admin-web / platform）

- **Tenant admin 视角**：只读（看本 tenant 开了哪些 flag）
- **Platform admin 视角**：全局 flag 清单 + 每 tenant 开关 + 批量操作（"给全部 tenant 开 newApprovalFlow"）
- **Kill switch 快速入口**：platform 首页 prominent 位置 "紧急关闭 flag" 按钮

### 与权限系统的边界

**Flag 不是权限**：

- Flag：某功能是否对某 tenant/user **存在**（灰度）
- 权限：某功能对当前用户**是否可用**（授权）

典型组合：

```ts
<Flag name="new-approval-flow">
  <Gate perm="order:approve">
    <NewApproveButton />
  </Gate>
</Flag>
```

外层 flag 决定功能是否出现，内层 gate 决定是否有权限使用。

### shared-feature-flag 包结构

```
packages/shared-feature-flag/
├── src/types.ts                     # FeatureFlagProvider / FlagContext
├── src/server/
│   ├── feature-flag.module.ts
│   ├── feature-flag.service.ts
│   ├── local-flag.provider.ts       # M2 默认实现（DB + config）
│   └── doctor.ts                    # tripod doctor 检查生命周期
├── src/client/
│   ├── FeatureFlagProvider.tsx      # React context
│   ├── useFeatureFlag.ts
│   ├── useFlagVariant.ts
│   └── Flag.tsx                     # 组件糖
└── src/config.ts                    # tripod.config.yaml 解析
```

### 里程碑

- **M2**：接口 + LocalFlagProvider + Tenant.featureFlags 字段 + tripod.config.yaml 扩展 + `tripod doctor` 生命周期检查 + 前后端 hook / component
- **M3**：admin-web + platform 的 flag 管理 UI（随 admin-web UI 库）
- **Tier 2**：按需接 Unleash / LaunchDarkly 等

### AI 读解路径

- 新功能加 flag：先在 `tripod.config.yaml` 的 featureFlags 登记 + 写 `expectedRemoveAt` → 再代码里 `isEnabled(...)`
- 老 flag 稳定了：删代码里的 `isEnabled` 分支 → `tripod.config.yaml` 同步删项 → 写 changeset（patch 级别）

---

## 代码规范详细设计

### 设计基调

**SoT 是工具链配置**，不是本文档。ESLint / Prettier / tsconfig / husky hook 强制 AI 写的任何代码都符合规范（tripod 不做 CI 驱动的门槛，见 §部署 + 发版）。本章是配置的文本说明 + 自定义规则代码 + 各框架展开细则。Core §4.4 是 AI 高频查阅版，本章是详细版。

### 共享配置包清单

全部发 `@tripod-stack` scope。项目装上即生效，AI 不能绕过。

```
packages/
├── eslint-config-tripod/
│   ├── base.js              # TS + import-order + no-any + 自定义 tripod rules
│   ├── react.js             # base + react + react-hooks + jsx-a11y
│   ├── next.js              # react + next core-web-vitals
│   ├── nest.js              # base + NestJS 约束（require-permission-decorator 等）
│   ├── react-native.js      # base + react-native + tailwindcss (NativeWind)
│   ├── rules/               # 自定义 rule 实现（见下）
│   │   ├── no-direct-prisma-client.js
│   │   ├── no-default-export.js
│   │   ├── no-barrel-import.js
│   │   ├── error-code-required.js
│   │   ├── require-permission-decorator.js
│   │   └── require-idempotent-decorator.js
│   └── package.json
├── prettier-config-tripod/
│   ├── index.js
│   └── package.json
└── tsconfig-tripod/
    ├── base.json            # 通用 strict 配置
    ├── react.json           # 继承 base + react jsx
    ├── next.json            # 继承 react + next path
    ├── nest.json            # 继承 base + decorators
    ├── rn.json              # 继承 react + rn resolver
    └── package.json
```

### ESLint 配置

#### `eslint-config-tripod/base.js`

```js
const tripodRules = require('./rules');

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
    sourceType: 'module',
    ecmaVersion: 2023,
  },
  plugins: ['@typescript-eslint', 'import', 'tripod'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  settings: {
    'import/resolver': { typescript: { alwaysTryTypes: true } },
  },
  rules: {
    // G-TS 对齐
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/strict-boolean-expressions': ['error', { allowNullableObject: false }],
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    eqeqeq: ['error', 'always', { null: 'never' }], // 允许 x != null

    // 导入顺序
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [{ pattern: '@tripod-stack/**', group: 'internal' }],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      },
    ],
    'import/no-default-export': 'error',
    'import/no-cycle': 'error',

    // 命名
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'variableLike', format: ['camelCase'], leadingUnderscore: 'allow' },
      { selector: 'typeLike', format: ['PascalCase'] },
      { selector: 'enumMember', format: ['UPPER_CASE'] },
      {
        selector: 'variable',
        modifiers: ['const', 'global'],
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
      },
    ],

    // Tripod 自定义
    'tripod/no-direct-prisma-client': 'error',
    'tripod/no-default-export': 'error',
    'tripod/no-barrel-import': 'error',
    'tripod/error-code-required': 'error',

    // 控制台
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
  overrides: [
    // 测试文件放宽
    {
      files: ['**/*.spec.ts', '**/*.test.ts', '**/__tests__/**'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        'no-console': 'off',
      },
    },
    // Next 特殊文件允许 default export
    {
      files: [
        '**/app/**/page.tsx',
        '**/app/**/layout.tsx',
        '**/app/**/loading.tsx',
        '**/app/**/error.tsx',
        '**/app/**/not-found.tsx',
        '**/app/**/template.tsx',
        '**/app/**/default.tsx',
        '**/app/**/global-error.tsx',
        '**/app/**/route.ts',
        '**/middleware.ts',
        '**/instrumentation.ts',
      ],
      rules: {
        'tripod/no-default-export': 'off',
        'import/no-default-export': 'off',
      },
    },
  ],
};
```

#### `eslint-config-tripod/react.js`

```js
module.exports = {
  extends: [
    './base',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  plugins: ['react', 'react-hooks', 'jsx-a11y'],
  settings: { react: { version: 'detect' } },
  rules: {
    'react/prop-types': 'off', // 用 TS 类型替代
    'react/react-in-jsx-scope': 'off', // React 17+ 自动注入
    'react/jsx-key': ['error', { checkFragmentShorthand: true }],
    'react/no-array-index-key': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
    'react/jsx-no-leaked-render': 'error', // 防止 `{count && <X />}` 渲染 0
    'react/function-component-definition': [
      'error',
      {
        namedComponents: 'arrow-function',
        unnamedComponents: 'arrow-function',
      },
    ],
    'react/no-class-component': 'error',
  },
};
```

#### `eslint-config-tripod/next.js`

```js
module.exports = {
  extends: ['./react', 'next/core-web-vitals'],
  rules: {
    '@next/next/no-html-link-for-pages': 'error',
    // Next 15 async params 强制
    // （由自定义 rule 辅助，见 rules/）
  },
};
```

#### `eslint-config-tripod/nest.js`

```js
module.exports = {
  extends: ['./base'],
  rules: {
    'tripod/require-permission-decorator': 'error', // Controller 写操作必 @RequirePermission 或 @Public
    'tripod/require-idempotent-decorator': 'error', // payment/shipping/notification 路径
    '@typescript-eslint/parameter-properties': ['error', { prefer: 'parameter-property' }],
    // Nest 装饰器依赖 reflect-metadata 运行时
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      },
    ],
  },
};
```

#### `eslint-config-tripod/react-native.js`

```js
module.exports = {
  extends: [
    './react',
    'plugin:react-native/all',
    'plugin:tailwindcss/recommended', // NativeWind 走 Tailwind
  ],
  plugins: ['react-native', 'tailwindcss'],
  rules: {
    'react-native/no-inline-styles': 'error', // 强迫用 NativeWind className
    'react-native/no-color-literals': 'error',
    'react-native/no-raw-text': 'off', // NativeWind 下常混用
    'react-native/sort-styles': 'off', // 不用 StyleSheet
  },
};
```

### Tripod 自定义 ESLint 规则

每条规则对应 `packages/eslint-config-tripod/rules/<name>.js`，用 `@typescript-eslint` AST utilities 实现。

#### `no-direct-prisma-client`

禁 `new PrismaClient()` 和 `import { PrismaClient } from '@prisma/client'`，`packages/shared-prisma/` 内部例外。

```js
// 伪代码示意
module.exports = {
  meta: {
    type: 'problem',
    messages: { forbidden: '禁止直接使用 PrismaClient。请通过 @Inject() PrismaService 获取实例。' },
  },
  create(context) {
    const filename = context.getFilename();
    if (filename.includes('packages/shared-prisma/')) return {};
    return {
      'NewExpression[callee.name="PrismaClient"]'(node) {
        context.report({ node, messageId: 'forbidden' });
      },
      'ImportSpecifier[imported.name="PrismaClient"]'(node) {
        const source = node.parent.source.value;
        if (source === '@prisma/client') context.report({ node, messageId: 'forbidden' });
      },
    };
  },
};
```

#### `no-default-export`

```js
module.exports = {
  create(context) {
    return {
      ExportDefaultDeclaration(node) {
        context.report({
          node,
          message: '禁 default export。用 named export。Next 特殊文件已在 override 允许。',
        });
      },
    };
  },
};
```

#### `no-barrel-import`

禁从 `src/index.ts` 类聚合入口导入。

```js
module.exports = {
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (source.endsWith('/src') || source.endsWith('/src/index')) {
          context.report({ node, message: '禁从 src/index 聚合入口导入，改从具体文件导入。' });
        }
      },
    };
  },
};
```

#### `error-code-required`

`new BusinessException(...)` 第一个参数必须是 `ORDER_INVALID_STATE` 风格的常量（UPPER_SNAKE_CASE）。

```js
module.exports = {
  create(context) {
    return {
      'NewExpression[callee.name="BusinessException"]'(node) {
        const first = node.arguments[0];
        if (!first || first.type !== 'Identifier' || !/^[A-Z][A-Z0-9_]+$/.test(first.name)) {
          context.report({
            node,
            message: 'BusinessException 第一个参数必须是错误码常量（SCREAMING_SNAKE_CASE）。',
          });
        }
      },
    };
  },
};
```

#### `require-permission-decorator`

Controller 类里所有 `@Post / @Put / @Patch / @Delete` handler 必须有 `@RequirePermission(...)` 或 `@Public()` 装饰器之一。

```js
module.exports = {
  create(context) {
    const filename = context.getFilename();
    if (!filename.match(/\.controller\.ts$/)) return {};
    return {
      MethodDefinition(node) {
        const decorators = node.decorators ?? [];
        const isWriteRoute = decorators.some((d) =>
          ['Post', 'Put', 'Patch', 'Delete'].includes(d.expression.callee?.name ?? ''),
        );
        if (!isWriteRoute) return;
        const hasPerm = decorators.some((d) =>
          ['RequirePermission', 'Public'].includes(d.expression.callee?.name ?? ''),
        );
        if (!hasPerm) {
          context.report({
            node,
            message: 'Controller 写操作 handler 必有 @RequirePermission 或 @Public',
          });
        }
      },
    };
  },
};
```

#### `require-idempotent-decorator`（**M2 默认关闭**，M3 出现 payment/shipping 业务时启用）

在 `apps/server/src/{payment,shipping,notification}/` 路径下的 controller 写 handler 必有 `@Idempotent()`。实现类似 `require-permission-decorator`。

**启用时机**：M2 没有 payment / shipping 业务 controller，规则打开会造成 `notification` 等普通模块误报 → 规则代码随 `@tripod-stack/eslint-config` 发布但在 preset 里默认 `'off'`；M3 当项目真出现 payment / shipping 业务时在 `apps/server/.eslintrc` 显式 `'error'` 打开。

#### `no-raw-date`

业务代码禁 `new Date()` / `Date.now()`，统一用 `dayjs`。见架构关键原则 §8。

```js
module.exports = {
  create(context) {
    const filename = context.getFilename();
    // allowlist
    if (/\/(shared-logger|shared-audit|__tests__|\.spec\.|\.test\.|\.factory\.)/.test(filename))
      return {};
    return {
      'NewExpression[callee.name="Date"]'(node) {
        context.report({ node, message: '业务代码禁 new Date()。用 dayjs()。' });
      },
      'CallExpression[callee.object.name="Date"][callee.property.name="now"]'(node) {
        context.report({ node, message: '业务代码禁 Date.now()。用 dayjs().valueOf()。' });
      },
    };
  },
};
```

#### `no-number-for-money`

DTO / Entity 字段名命中 `price / amount / cost / fee / total / quantity / qty / stock / rate / ratio / balance` 且类型为 `number` → error。见架构关键原则 §9。

```js
// 伪代码示意（实际需结合 TypeScript parser 读 type annotation）
const MONEY_FIELD_RE =
  /^(.*?)(price|amount|cost|fee|total|quantity|qty|stock|rate|ratio|balance)$/i;
module.exports = {
  create(context) {
    return {
      'TSPropertySignature, PropertyDefinition'(node) {
        const name = node.key?.name;
        if (!name || !MONEY_FIELD_RE.test(name)) return;
        const ann = node.typeAnnotation?.typeAnnotation;
        if (ann?.type === 'TSNumberKeyword') {
          context.report({
            node,
            message: `字段 "${name}" 是金额/数量语义，禁 number。用 string（DTO 传输）或 Decimal（内部运算）。`,
          });
        }
      },
    };
  },
};
```

#### `no-parsefloat-on-money`

业务代码禁 `parseFloat(...)` / `Number(stringVar)`，强制走 `new Decimal(str)`。

```js
module.exports = {
  create(context) {
    const filename = context.getFilename();
    if (/\.(spec|test)\./.test(filename)) return {};
    return {
      'CallExpression[callee.name="parseFloat"]'(node) {
        context.report({
          node,
          message: '禁 parseFloat。金额/数量用 new Decimal(str)；普通整数用 parseInt(..., 10)。',
        });
      },
      'CallExpression[callee.name="Number"]'(node) {
        const arg = node.arguments[0];
        if (arg && arg.type !== 'Literal') {
          context.report({
            node,
            message:
              '禁对变量用 Number()。金额/数量走 Decimal；需要强转数字走 Number.parseInt/parseFloat 显式 + 同行注释说明。',
          });
        }
      },
    };
  },
};
```

### Prettier 配置

`packages/prettier-config-tripod/index.js`：

```js
module.exports = {
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  arrowParens: 'always',
  tabWidth: 2,
  useTabs: false,
  endOfLine: 'lf',
  bracketSpacing: true,
  plugins: ['prettier-plugin-tailwindcss'],
};
```

项目 `package.json`：

```json
{ "prettier": "@tripod-stack/prettier-config" }
```

### tsconfig 配置

`packages/tsconfig-tripod/base.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true
  },
  "exclude": ["node_modules", "dist", "build", ".next", ".turbo"]
}
```

`react.json` / `next.json` / `nest.json` / `rn.json` 继承 base 加框架特有（jsx / paths / decorators / rn resolver）。

### husky + lint-staged

`.husky/pre-commit`：

```bash
#!/bin/sh
pnpm lint-staged
```

`.husky/pre-push`：

```bash
#!/bin/sh
pnpm turbo run typecheck --filter=...[origin/main] &&
pnpm turbo run test --filter=...[origin/main]
```

`package.json`：

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["prettier --write", "eslint --fix"],
    "*.{json,md,yml,yaml,css}": ["prettier --write"]
  }
}
```

### Hook 强制（代替 CI）

`.husky/pre-push`：

```bash
#!/bin/sh
pnpm turbo run lint --filter=...[origin/main]
pnpm turbo run typecheck --filter=...[origin/main]
pnpm turbo run test --filter=...[origin/main]
pnpm turbo run build --filter=...[origin/main]
```

任一步骤失败阻断 push。`--filter=...[origin/main]` 只跑受影响包。

若业务真需要 CI 驱动的门槛（团队规模 / 开源场景），由项目自行加 `.github/workflows/` 或对应平台配置，tripod 不提供默认 workflow。

### 各框架延伸细则（core §4.4 已列硬规则，此处展开）

#### React 19

- **Suspense 边界**：异步数据用 `<Suspense>` 包，不在组件里手动处理 loading state
- **Server Actions**（配合 Next）：`'use server'` 函数返回可序列化值；error 用 throw（会被 error boundary 捕获）
- **Actions + useActionState**：表单提交优先用 React 19 Actions 而非手写 `onSubmit`
- **`use` hook**：读 Promise / Context 的条件用法，但不要滥用（复杂场景仍用 useEffect）
- **ref as prop**：React 19 `ref` 可直接作为 prop 传递，不需要 `forwardRef`

#### Next.js 15

- **动态 params 异步**：`export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; }`
- **静态 metadata 优先**：`export const metadata: Metadata = { ... }`；动态才 `generateMetadata`
- **Streaming**：`loading.tsx` + `<Suspense>` 组合，而不是整页等
- **Server / Client 边界**：尽量把 `'use client'` 推到树叶；状态管理 / 交互组件标 client，数据渲染 / 布局保持 server
- **Route handlers**：统一 response envelope 由 shared-contract 的 `ok()` / `err()` 辅助函数产出
- **Image**：`next/image` + 配置 `remotePatterns`，禁 `<img>`（CI 阻断）

#### NestJS

- **Module 边界**：循环依赖立即警告 → 重构；不用 `forwardRef`
- **Provider lifetime**：默认 singleton；request-scoped 只在需要 per-request 状态时（慢）
- **ValidationPipe 配置**：
  ```ts
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  ```
- **Guard 顺序**：`AuthGuard` → `TenantGuard` → `PermissionGuard` → 自定义业务 Guard
- **Interceptor 顺序**：`RequestIdInterceptor` → `CorrelationInterceptor` → `LoggingInterceptor` → `ResponseInterceptor`（自动 envelope）
- **Exception filter**：`GlobalExceptionFilter` 统一错误响应；业务层抛 `BusinessException`，基建层抛 NestJS 内置（自动映射 HTTP 码）
- **测试**：每个 Service 有单测（mock Prisma）；每个 Controller 有 e2e（真 DB）

#### React Native（Expo）

- **Safe area**：`<SafeAreaProvider>` 在 root，`useSafeAreaInsets()` 取数值 / `<SafeAreaView>` 组件
- **Navigation type**：
  ```ts
  type RootStackParamList = {
    Home: undefined;
    OrderDetail: { orderId: string };
  };
  const Stack = createNativeStackNavigator<RootStackParamList>();
  ```
- **Gesture**：用 `react-native-gesture-handler` + `react-native-reanimated`，禁 RN 内置 Animated（性能差）
- **FlashList** 替代 FlatList（大列表性能）
- **Deep link**：Expo Router 配置 `schema` + `linking`
- **EAS Build**：`eas.json` profile 分 `development` / `preview` / `production`
- **环境变量**：走 `EXPO_PUBLIC_*`（客户端） + EAS secrets（构建）

#### HTML / CSS / Tailwind

- **HTML boilerplate**：
  ```html
  <!DOCTYPE html>
  <html lang="zh-CN">
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </html>
  ```
- **Tailwind theme token**：
  - 颜色走 `bg-primary` / `text-muted-foreground`（用 CSS variable + `shared-theme`）
  - 间距走 `p-4` / `gap-2`，禁 `p-[17px]` 任意值
  - 字号用 `text-sm` / `text-base`，禁 `text-[13px]`
- **响应式断点**：
  - 默认：手机（<640px）
  - `sm:` ≥640px / `md:` ≥768px / `lg:` ≥1024px / `xl:` ≥1280px
- **暗色模式**：走 `dark:` 前缀 + CSS variable，`class` 策略切换（不是 `media`）

### AI 自检协议（实现细节）

core §4.4 定义了 6 步协议。本节说明**怎么跑**：

```bash
# AI 写完一批代码后，跑这一组命令，按 filter 只测改过的包
pnpm turbo run lint --filter=$(tripod cli changed-packages --from=HEAD~1)
pnpm turbo run typecheck --filter=$(tripod cli changed-packages --from=HEAD~1)

# 或者不依赖 git diff，直接跑所有（稍慢但稳）
pnpm turbo run lint typecheck --filter=[HEAD]
```

**AI 在 Claude Code 环境里**：

- 用 Bash tool 跑上述命令
- 读 stderr / stdout
- 如果有 error：逐条 fix（禁批量 `--fix`）
- 跑完再次校验
- 报告时明确列 "lint: 0 errors 2 warnings（已保留：XX 和 YY，理由...）"

**未修完不得报 "完成"**。

### 里程碑

- **M1**：`eslint-config-tripod/base` + `prettier-config-tripod` + `tsconfig-tripod/base` + `.husky/pre-commit`（lint-staged）+ CI lint/typecheck job
- **M2**：`eslint-config-tripod/{react,next,nest,react-native}` + 自定义规则（`no-direct-prisma-client` / `no-default-export` / `no-barrel-import` / `error-code-required` / `require-permission-decorator` / `require-idempotent-decorator`）+ Tailwind plugin 集成
- **M3+**：按选定 UI 库调整（如 shadcn/ui 可加 `tripod/prefer-ui-component` 推荐用封装组件）
- **M6+**：规则覆盖率体检（哪些业务代码绕过了规则）+ 规则演化审计（半年回看哪些规则频繁被 `eslint-disable`，该调 rule 了）

### 验收

- `pnpm create tripod my-app --recipe=minimal` 生成的项目 `pnpm lint` 必 0 error
- 故意写 `new PrismaClient()` → ESLint 立即报 `tripod/no-direct-prisma-client`
- 故意写 `export default foo` 在非 Next 特殊文件 → ESLint 报 `tripod/no-default-export`
- 故意写 `throw new BusinessException('订单状态不对')` → ESLint 报 `tripod/error-code-required`
- Controller 漏 `@RequirePermission` → ESLint 报 `tripod/require-permission-decorator`
- pre-commit 漏改 prettier 格式的文件自动格式化 + 阻断 commit

---

## Spec 驱动 TDD 工作流

### 设计基调

**需求是最终效果**。任何业务模块必须以 Spec（需求文档）为起点、以三层测试全绿为终点，中间插脚手架。AI 不写"没有测试护栏的代码"。

本工作流由 Claude Code skills 驱动，随模板分发：

| Skill                 | 职责                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `spec-driven-testing` | 写 spec → 跨 spec 审查 → 生成测试计划（三轨）→ 生成三层测试代码                             |
| `graph-code-analysis` | `spec-driven-testing` 的 Track B 依赖，图论扫描已有代码找测试盲区                           |
| `dev-startup`         | 一键起全栈 + 常见问题排查引导                                                               |
| `swap-ui-library`     | ⭐ AI 换 UI 库：web（AntD ↔ shadcn ↔ MUI ↔ Arco）+ mobile（Gluestack ↔ Tamagui ↔ RN Paper） |

### Skill 分发机制

```
templates/                         ← @tripod-stack/templates 包根
├── .claude/
│   └── skills/
│       ├── spec-driven-testing/
│       │   ├── SKILL.md
│       │   └── rules/
│       │       ├── spec-template.md
│       │       ├── cross-review-checklist.md
│       │       ├── test-plan-template.md
│       │       ├── unit-test-patterns.md
│       │       ├── playwright-patterns.md
│       │       └── playwright-ui-patterns.md
│       ├── graph-code-analysis/
│       │   └── SKILL.md
│       ├── dev-startup/
│       │   ├── SKILL.md
│       │   └── troubleshoot.md
│       └── swap-ui-library/                    ⭐ 新增
│           ├── SKILL.md                        # 换库流程（扫 -> 映射 -> 替换 -> smoke）
│           └── mappings/
│               ├── web/
│               │   ├── antd-to-shadcn.md       # 组件映射表 + props 差异
│               │   ├── antd-to-mui.md
│               │   ├── antd-to-arco.md
│               │   ├── shadcn-to-antd.md
│               │   └── shadcn-to-mui.md
│               └── mobile/
│                   ├── gluestack-to-tamagui.md
│                   ├── gluestack-to-paper.md
│                   └── tamagui-to-gluestack.md
└── apps/ ...
```

- `pnpm create tripod <name>` 运行时：**把模板根的 `.claude/` 整块原样复制到新项目根**（与 `apps/` / `packages/` 同级），**不经过 patch 引擎**（因为 skill 是 AI 协议，不是业务代码）
- `tripod.manifest.yaml` 不声明 skill slot，skill 不走 feature / adapter 配置体系
- 新项目 clone 后 Claude Code 扫描 `.claude/skills/`，所有 skill 即时可用（`/spec-driven-testing` / `/graph-code-analysis` / `/dev-startup` / `/swap-ui-library`）
- Skill 在 tripod 模板仓库内维护，升级跟 `@tripod-stack/templates` 版本。已下发项目想同步最新 skill：Tier 2 的 `tripod sync --skills-only` 拉最新 `.claude/skills/` 回来（用户手动触发，不自动）

### `swap-ui-library` skill 详细设计

**触发场景**：用户说"把 admin-web 的 UI 从 AntD 换成 shadcn"、"mall-mobile 不想用 Gluestack 换成 Tamagui"等。

**SKILL.md 流程**：

```
当用户说"换 UI 库 X → Y"：

1. 定位 app + 当前库 + 目标库
   - 读 docs/templates/<app>/components.md 确认当前用的库
   - 读 mappings/<platform>/<from>-to-<to>.md 组件映射

2. 扫代码
   - grep `from '<old-lib>'` 所有文件
   - 列出用到的组件清单

3. 换包依赖
   - 改 apps/<app>/package.json：卸 old-lib 装 new-lib
   - pnpm install

4. 替换 import + props
   - 对照 mappings/*.md：
     - 每个组件的 import 路径替换
     - props 重命名（type="primary" → variant="default"）
     - 特殊 case（AntD Form.List → shadcn 手写 useFieldArray）按映射的"特殊处理"段改

5. 处理库特有用法（按 mapping 文件的"特殊处理"段落）
   - ProTable → 拆成 <Table> + 自己写分页 / 筛选条
   - Form 验证 → React Hook Form + Zod
   - Modal / Drawer → 映射库对应组件

6. 更新样式
   - Tailwind class 大部分通用
   - 少量库锁定的 class（antd-custom-*）按映射改

7. 跑 smoke test
   - pnpm tripod smoke-test --recipe=<current> --from-npm=false
   - 修剩余 lint / typecheck 错误

8. 报告
   - 改了多少文件
   - 哪些地方留了注释（特殊处理 / 库差异无法完全映射）
   - 需要人类 review 的点
```

**mappings/web/antd-to-shadcn.md 结构示例**：

```markdown
# AntD 5 → shadcn/ui 组件映射

## Button

| AntD                      | shadcn                                                                           |
| ------------------------- | -------------------------------------------------------------------------------- |
| `<Button type="primary">` | `<Button variant="default">`                                                     |
| `<Button type="default">` | `<Button variant="outline">`                                                     |
| `<Button danger>`         | `<Button variant="destructive">`                                                 |
| `<Button size="large">`   | `<Button size="lg">`                                                             |
| `<Button loading>`        | `<Button disabled>{loading && <Spinner />}...</Button>`（shadcn 不内置 loading） |

## Input / TextArea / Select / Checkbox / Radio / ...（类似表格）

## Table（特殊处理）

**AntD 有 ProTable + Form.List 高级功能，shadcn 无对应**：

- `<Table columns={[...]} dataSource={data} />` → shadcn `<Table>` + 手写 header / body
- 分页 → TanStack Table 的 `getPaginationRowModel`
- 排序 / 筛选 → TanStack Table hook
- 参考完整迁移示例：./examples/table-antd-to-shadcn.md

## Form（特殊处理）

- AntD `<Form>` + `<Form.Item>` → shadcn `<Form>` + `react-hook-form` + `zodResolver`
- 验证 message 处理方式不同，见 ./examples/form-antd-to-shadcn.md

## Modal / Drawer / Notification / Message

...

## 不支持换的（保持 AntD）

- `<ProTable>` 功能太重，shadcn 需要用 TanStack Table + shadcn 组件重写，工作量大，建议保留 AntD 或整个模块重写
```

**AI 读到这类 mapping 后能系统性转换**，避免遗漏。

### 四阶段闭环

| 阶段                     | 入口                                    | 产出                                           | 验收                                               |
| ------------------------ | --------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| **Step 0** 写 Spec       | `/spec-driven-testing <name>`           | `docs/specs/<name>.md`                         | Spec 含功能清单 / 业务规则 / 5+ edge cases         |
| **Step 1** 测试计划      | `/spec-driven-testing generate <name>`  | `docs/specs/<name>.test-plan.md`               | Track A + B + C 去重后 TC-list，每条标 Unit/API/UI |
| **Step 2** 脚手架 + 8 项 | `pnpm tripod gen:crud <name>`           | `apps/server/src/<name>/**` + prisma migration | `tripod doctor` manifest ↔ 代码一致                |
| **Step 3** 三层测试      | `/spec-driven-testing implement <name>` | Unit + API E2E + UI E2E                        | `pnpm test` 全绿                                   |
| **Step 4** 自检          | `tripod doctor` + `pnpm lint/typecheck` | —                                              | 四方一致、零 lint 错、零 ts 错                     |

### docs/specs 目录约定

```
docs/specs/
├── sales-order.md                  # 业务模块 spec（Step 0 产出）
├── sales-order.test-plan.md        # 测试计划（Step 1 产出）
├── customer.md
├── customer.test-plan.md
├── warehouse.md
└── warehouse.test-plan.md
```

- **归档规则**：spec 进入 APPROVED 状态后入 git；DRAFT / REVIEW 状态可留本地不提交
- **跨 spec 审查**：模块数 ≥ 2 时**每次加新 spec 前**跑 `/spec-driven-testing review`，更新各 spec 的 Section 8（跨功能关联）
- **Spec ↔ manifest.ts 映射**：
  - Spec §3 F-NNN（功能清单）→ `<resource>.manifest.ts` 的 `permissions[]`（ACTION 类）
  - Spec §5 流程状态 → `<resource>.manifest.ts` 的 `states[]` / `transitions[]`
  - Spec §4 BR-NNN（业务规则）→ service 方法里的 `if` 检查 + `BusinessException(errorCode)`（见 core §4.3）
  - Spec §7 EC-NNN（edge cases）→ 测试计划 Track A（TC-<PREFIX>-A01..）

### 三轨测试的落点

| Track           | 来源                        | 数量级          | 覆盖目标                                                                                |
| --------------- | --------------------------- | --------------- | --------------------------------------------------------------------------------------- |
| **A** 用户直觉  | Spec §7 Edge Cases          | 5-15            | 业务隐性知识（跨时区、并发、权限越界）                                                  |
| **B** 代码扫描  | `/graph-code-analysis` 输出 | 视代码规模 5-20 | 代码层盲区（死代码 / 缺错误处理 / 数据流断裂）                                          |
| **C** Spec 推导 | F-NNN + BR-NNN + 流程状态   | ~40             | 功能完整性（8 维展开：正常流 / 失败流 / 权限 / 并发 / 幂等 / 多租户隔离 / i18n / 审计） |

**合并去重**按标准化签名 `[功能]:[行为]:[预期结果]`，重复 TC 保留 Track C 优先（最结构化）。

### 三层测试的落地

| Tier        | 框架       | 跑在哪            | 数据库                                   | Fixture                                               |
| ----------- | ---------- | ----------------- | ---------------------------------------- | ----------------------------------------------------- |
| **Unit**    | Vitest     | 业务服务 / 纯函数 | Mock Prisma                              | `shared-test` factories                               |
| **API E2E** | Playwright | HTTP 层           | 测试 DB（docker-compose `test` profile） | `createTestTenant()` + login fixture                  |
| **UI E2E**  | Playwright | 浏览器            | 测试 DB                                  | `createTestTenant()` + browser fixture + API 预置数据 |

**多租户隔离**：每个 spec file 的 `beforeEach` 调 `createTestTenant`，`afterEach` 调 `ctx.cleanup()` 删 tenant 及其所有业务数据 —— 测试间零污染（见 `shared-test` 章）。

**失败处理铁律**：

- 失败 TC **禁** `.skip` / `.only` / 删除 / 改 expect 让它过
- 改实现让它通过；实现不了 → 停手问用户（spec 是否有问题 / 是否改需求）
- 故意跑红让后续补实现 → 允许，但 commit message 必须标 `wip: <reason>` 且下次 PR 前补齐

### AI 的硬约束

- 用户说"加功能 / 新模块 / 做页面 / 写业务代码" → **第一步必是** `/spec-driven-testing <name>`，不是直接 `gen:crud`
- Spec 的交互式引导 AI **不代填**用户回答；AI 只在用户说完后追问、整理、归档
- Step 3 的 `pnpm test` 不全绿 → **禁止**报"完成"
- 禁止在测试里写 `expect(true).toBe(true)` / `expect(...).not.toBe(...)` 等水测；测试必须验证真实行为
- Spec 与实际代码漂移时：**先改 spec**（需求变更的真源）再改代码，反之就是偷懒

### 里程碑

- **M1**：
  - 模板根预置 `.claude/skills/spec-driven-testing/` + `graph-code-analysis/`（这次已完成的 copy）
  - `pnpm create tripod` 复制 `.claude/` 整块到新项目
  - 模板根 `docs/specs/` 空目录 + README 说明约定
  - CLAUDE.md 里登记"新增模块走 `/spec-driven-testing`"协议
- **M2**：
  - `shared-test` 的 `createTestTenant` fixture 落地（给三层测试用）
  - Playwright 基础配置随模板分发（`playwright.config.ts` + docker-compose `test` profile）
  - `tripod doctor` 加检查：每个 `apps/server/src/<resource>/` 下是否有对应 `docs/specs/<resource>.md`（可 warn 不报错）
- **Tier 2**：
  - `tripod sync --skills-only` 回流最新 skill
  - `/spec-driven-testing` 与 `<resource>.manifest.ts` 双向同步（spec 改 → 提示更新 manifest；manifest 改 → 提示回填 spec）

### 验收

- 新项目 `pnpm create tripod my-erp --recipe=erp-standard` 后，Claude Code 会话里直接 `/spec-driven-testing <name>` 可用
- 故意跳过 Step 0 直接跑 `gen:crud`：AI **必须停手反问**"没有 spec，确认要跳过 spec 直接写代码吗"
- 三层测试任一失败：AI 报告明确区分"实现问题（应改实现）vs 测试问题（应改测试）vs 需求问题（应改 spec）"，不糊过去

---

## 部署 + 发版详细设计

### 栈选型

- **部署**：**本地构建 → scp 镜像 tar → SSH load + compose up**（无 Docker Registry 依赖、无 CI 依赖）
- **版本管理**：Changesets + Claude Code 辅助生成
- **Secrets**：**本地 `secrets/` 目录维护，打包时随产物一起 scp 到 server**（build.sh 首步 `env:validate` 强制校验）
- **合入门槛**：husky pre-commit / pre-push hook（lint + typecheck + test + gitleaks），本地拦截；**不做 CI**
- **Git 托管 / 代码仓库 / 对外反代 / HTTPS 证书**：**不属 tripod 范围**，由团队工程习惯 + 运维层决定（tripod 只提供 docker 镜像 + compose 暴露 HTTP 端口）

### 部署流程（无 Registry，本地打包捎带 secrets）

**产物结构**（本地 `dist/` 下生成）：

```
dist/tripod-v1.2.3/
├── images/
│   ├── server.tar
│   └── admin.tar
├── .env.prod                    # ⭐ 本地 secrets/.env.prod 复制进来
├── docker-compose.prod.yml
├── deploy.sh                    # server 端解压后执行
└── rollback.sh
```

**本地 `infra/deploy/build.sh`**（发布负责人在本地跑）：

```bash
#!/bin/bash
set -euo pipefail                             # 任一步失败立即中止

VERSION=$1                                    # ./build.sh v1.2.3
SERVER=${DEPLOY_HOST:-server.internal}
SSH_KEY=${DEPLOY_SSH_KEY:-~/.ssh/tripod_deploy}
OUT="dist/tripod-${VERSION}"

# ===== Step 0：预检（secrets 合法性） =====
echo "🔍 校验 secrets/.env.prod..."
pnpm tripod env:validate secrets/.env.prod    # 缺值 / 格式错 / 危险默认值 → exit 1

# ===== Step 1：构建镜像 =====
echo "📦 构建镜像 ${VERSION}..."
mkdir -p ${OUT}/images
docker build -t tripod-server:${VERSION} -f infra/docker/server.Dockerfile .
docker build -t tripod-admin:${VERSION} -f infra/docker/admin.Dockerfile .
docker save tripod-server:${VERSION} -o ${OUT}/images/server.tar
docker save tripod-admin:${VERSION} -o ${OUT}/images/admin.tar

# ===== Step 2：组装产物（含 secrets，仅存本地/传输中） =====
cp secrets/.env.prod ${OUT}/.env.prod
cp infra/compose/docker-compose.prod.yml ${OUT}/
cp infra/deploy/deploy.sh ${OUT}/
cp infra/deploy/rollback.sh ${OUT}/
# 附加 schema 快照（仅 key + 类型，无值），便于排查
pnpm tripod env:gen-example > ${OUT}/.env.prod.schema

# ===== Step 3：打包 + 传输 =====
tar czf dist/tripod-${VERSION}.tar.gz -C dist tripod-${VERSION}
scp -i ${SSH_KEY} dist/tripod-${VERSION}.tar.gz deploy@${SERVER}:/opt/tripod/releases/

# ===== Step 4：远程部署 =====
ssh -i ${SSH_KEY} deploy@${SERVER} <<REMOTE
  set -e
  cd /opt/tripod
  tar xzf releases/tripod-${VERSION}.tar.gz -C releases/
  chmod 600 releases/tripod-${VERSION}/.env.prod
  rm -f current && ln -s releases/tripod-${VERSION} current
  docker load < current/images/server.tar
  docker load < current/images/admin.tar
  docker compose -f current/docker-compose.prod.yml --env-file current/.env.prod up -d
  sleep 5
  curl -f http://localhost:3000/health/readiness || exit 1
  # 保留最近 5 个 release + 清理旧镜像
  ls -1t releases/ | grep -v '\.tar\.gz$' | tail -n +6 | xargs -I {} rm -rf releases/{}
  docker image ls --format '{{.Repository}}:{{.Tag}}' | grep tripod- | tail -n +11 | xargs -r docker rmi || true
REMOTE

# 本地清理
rm -rf dist/tripod-${VERSION} dist/tripod-${VERSION}.tar.gz
echo "✅ 部署完成：${VERSION}"
```

回滚 `infra/deploy/rollback.sh`（server 端执行或远程触发，不需重新打包）：

```bash
#!/bin/bash
# ./rollback.sh v1.2.2
VERSION=$1
cd /opt/tripod
[ -d "releases/tripod-${VERSION}" ] || { echo "版本不存在"; exit 1; }
rm -f current && ln -s releases/tripod-${VERSION} current
docker compose -f current/docker-compose.prod.yml --env-file current/.env.prod up -d
# 回滚自带该版本对应的 .env.prod，不会和镜像错配
```

部署完全在发布人本地执行（`build.sh` / `deploy.sh` / `rollback.sh`），**不依赖任何 CI 平台**；`DEPLOY_HOST` / `DEPLOY_SSH_KEY` 这类部署坐标放在发布人本地 shell env 或 `~/.ssh/config`，业务敏感 secrets 永不进 git。

### Secrets 管理：本地维护 + 打包捎带

**原则**：业务敏感 secrets（DB 密码、JWT_SECRET、SMTP 密码、API Key 等）**只存在发布人本地磁盘**和**生产 server 磁盘**，永不过 CI / git。

#### 目录约定

```
tripod/
├── secrets/                     ⭐ 本地 gitignore，只有发布人电脑上有
│   ├── .env.prod                # 生产真值
│   ├── .env.staging             # 预发真值（可选）
│   └── README.md                # 提醒：FileVault 开启 + 1Password 备份
├── infra/deploy/
│   └── .env.prod.example        # 仓库提交，仅 key + 注释，无值
└── .gitignore                   # secrets/ 整个忽略
```

#### 日常流程

1. **首次配置**：复制模板填值
   ```bash
   cp infra/deploy/.env.prod.example secrets/.env.prod
   vim secrets/.env.prod
   pnpm tripod env:validate secrets/.env.prod   # 立即校验
   ```
2. **加新变量**：改 `packages/shared-config/src/env.ts` Zod schema → 重新生成 example：
   ```bash
   pnpm tripod env:gen-example > infra/deploy/.env.prod.example
   # 把新 key 加到 secrets/.env.prod，填值
   ```
3. **发布部署**：`./build.sh v1.2.3` 自动触发 `env:validate` 预检；校验失败阻断打包
4. **secrets 变更但镜像不变**：重跑 `./build.sh <same-version>-hotfix` 产出仅换 env 的新 release

#### 本地安全要求（强制）

- **磁盘加密**：Mac FileVault / Windows BitLocker 必须开启
- **离线备份**：`secrets/.env.prod` 内容复制一份到 1Password / Bitwarden（防电脑丢失）
- **不要放云盘明文**：iCloud Drive / Dropbox / Google Drive 的 `secrets/` 目录禁止同步

#### 三个辅助 CLI 命令

| 命令                              | 作用                                            | 何时用                                  |
| --------------------------------- | ----------------------------------------------- | --------------------------------------- |
| `pnpm tripod env:validate <file>` | Zod schema 校验 + 危险值检测                    | build.sh 首步强制；日常改完立即跑       |
| `pnpm tripod env:gen-example`     | 从 Zod schema 反向生成 `.env.prod.example`      | 加新字段后，保持 schema 和 example 同步 |
| `pnpm tripod env:doctor <file>`   | 深度体检：默认值 / localhost in prod / 弱密钥等 | 部署前人肉一次                          |

#### `env:validate` 行为细节

```
$ pnpm tripod env:validate secrets/.env.prod
✓ secrets/.env.prod 校验通过
  共 23 个变量，3 个可选未设置

# 或失败：
✗ secrets/.env.prod 校验失败：
  ❌ JWT_SECRET      原因：字符串长度不足 32
  ❌ DATABASE_URL    原因：缺失（required）
  ❌ STORAGE_PROVIDER 原因：必须是 local / s3 / oss / cos 之一
请补齐 secrets/.env.prod 后重试。
（exit 1，阻断 build.sh 后续步骤）
```

实现：复用 `packages/shared-config/src/env.ts` 的 Zod schema，单一来源；运行时和打包时用同一份定义，永不漂移。

#### `env:doctor` 检测项

- `JWT_SECRET` / `SESSION_SECRET` 等于模板示例值（`CHANGE_ME` / `your-secret-here`）
- `NODE_ENV=production` 但 `DATABASE_URL` / `REDIS_URL` 指向 `localhost` / `127.0.0.1`
- `STORAGE_PROVIDER=s3` 但 `S3_ACCESS_KEY` / `S3_SECRET_KEY` 为空
- 任意 secret 明显弱（纯数字 / 字典词 / 长度 <16）
- `.env.prod` 含有 `DEBUG=true` / `LOG_LEVEL=debug` 等开发态残留

命中只警告（非阻断），允许 `--strict` 升级为阻断。

#### 发布人丢电脑的恢复流程

1. 新电脑 git clone 仓库
2. 从 1Password 取回 secrets/.env.prod 内容 → 粘贴到 `secrets/.env.prod`
3. `pnpm tripod env:validate secrets/.env.prod` 确认可用
4. 正常发布

**不要**去 server 上把 `.env.prod` 拉回来覆盖本地——server 上的可能已被运维临时改过，以本地/1Password 为准。

#### Tier 2 升级路径（项目需要时切）

- `adapters/secrets-sops/`：sops + age 加密入库（GitOps 风格，secrets 可进 git）
- `adapters/secrets-vault/`：HashiCorp Vault 集成
- `adapters/secrets-doppler/`：Doppler SaaS 集成

业务代码通过 `packages/shared-config/src/env.ts` 的 Zod schema 读取，不关心底层来源。

### 环境变量 Zod 校验（打包 + 启动双重 fail-fast）

**单一 schema，两处校验**：

```ts
// packages/shared-config/src/env.ts
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  SMTP_HOST: z.string().optional(),
  STORAGE_PROVIDER: z.enum(['local', 's3', 'oss', 'cos']),
  STORAGE_LOCAL_ROOT: z.string().optional(),
  GLITCHTIP_DSN: z.string().optional(),
  OTEL_ENDPOINT: z.string().optional(),
  ...
});

export const env = EnvSchema.parse(process.env);  // 运行时：启动即校验，缺失/错类型立即 crash
```

**两层校验**：

| 时机                     | 命令 / 入口                                                       | 行为                                           |
| ------------------------ | ----------------------------------------------------------------- | ---------------------------------------------- |
| **打包时**（本地，新增） | `pnpm tripod env:validate secrets/.env.prod`（build.sh 首步强制） | 缺失/格式错 → exit 1，阻断产物构建             |
| **启动时**（server）     | `env.ts` 的 `EnvSchema.parse(process.env)`                        | 缺失/格式错 → process crash，容器 restart 回退 |

双层防护：**打包挡人为疏漏，启动挡环境漂移**（比如运维临时改了 server 上的 `.env.prod` 但改坏了）。

**新增字段流程**：

1. 改 `EnvSchema`
2. `pnpm tripod env:gen-example > infra/deploy/.env.prod.example`（schema 反向生成模板）
3. `secrets/.env.prod` 填新值
4. `pnpm tripod env:validate secrets/.env.prod` 确认通过
5. 提交 schema + example 到 git（secrets 仍不提交）

### 版本管理：Changesets + Claude Code 辅助

#### Changesets 模式：全量 Lockstep

**所有 `@tripod-stack/*` 包共享同一版本号**，任一包有 minor/major 变动时全部一起升到同一版本。

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "tripod-stack/tripod" }],
  "access": "public",
  "baseBranch": "main",
  "fixed": [
    [
      "@tripod-stack/shared-*",
      "@tripod-stack/adapter-*",
      "@tripod-stack/cli",
      "@tripod-stack/templates",
      "create-tripod"
    ]
  ],
  "linked": [],
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

**为什么全量 lockstep**：

- Tripod 是"能一起工作的套装"，不是松散工具库集合；shared-auth 改接口常带动 shared-permission / shared-platform
- 用户心智简单：`pnpm up @tripod-stack/*` 全升到同一版本，不用想包间兼容性
- 模板 `workspace:*` 发布时全部替换为同一版本号，新项目拉下来包组合 100% 经过测试
- 业界先例：Vue / Next / Angular / Nuxt 等框架都用 lockstep

**工作方式示例**：

```
当前：@tripod-stack/* 全部 1.5.3

场景 1：修 shared-auth 的 bug
  → changeset：@tripod-stack/shared-auth patch
  → changeset version 后：全部包升到 1.5.4（即便 shared-storage 没改，re-publish）
  → 用户 pnpm up @tripod-stack/* 拿到 1.5.4 全套

场景 2：shared-workflow 加新接口 + shared-cache 改内部实现
  → changeset：@tripod-stack/shared-workflow minor + @tripod-stack/shared-cache patch
  → Changesets 取较大级别：全部升 minor → 1.6.0
  → 全量 re-publish

场景 3：shared-storage 破坏性变更（接口改名）
  → changeset：@tripod-stack/shared-storage major
  → 全部升 major → 2.0.0
  → 模板里 workspace:* 替换后都是 ^2.0.0
```

**代价**：未改动的包 re-publish 浪费 npm 存储，但 npm 对此支持良好，成本可忽略。

**早期豁免**（`0.x.y` 阶段）：首个 major 版本前，lockstep 限制不严格 —— 单独改 patch 允许只动一个包，减少 0.x 快速迭代时的 re-publish 噪声。到 `1.0.0` 起完全 lockstep。

#### 用户项目里的版本一致性（防漂移）

Lockstep 是 tripod 主仓的**发版规则**，但用户项目的 `package.json` 能绕过（用户手动 `pnpm up @tripod-stack/shared-auth` 单独升 → 版本漂移 → 组合未经测试）。

两条防线：

**1. `tripod upgrade` CLI（M2）**

```bash
pnpm tripod upgrade                        # 升到 npm 上 @tripod-stack/cli@latest 的版本
pnpm tripod upgrade --to 2.1.0             # 指定版本
pnpm tripod upgrade --dry-run              # 预览改动
```

实现流程：

1. 读 npm meta：`npm view @tripod-stack/cli version` 拿到 latest lockstep 版本
2. 扫所有 `package.json`（含 apps / packages / adapters），把 `@tripod-stack/*` 的 `^x.y.z` 批量替换为 `^<新版本>`
3. 跑 `pnpm install`
4. 跑 `pnpm tripod doctor`
5. **升 major 版本时**：读 `CHANGELOG.md` 提取 breaking changes 摘要打印给用户，等回车确认再继续
6. 建议跑 `pnpm tripod smoke-test`（见缺口 6）确认业务没坏

**2. `tripod doctor` 版本一致性校验（M2）**

新增检查项：

```
✓ @tripod-stack/* 版本一致性
  扫所有 package.json → 提取 @tripod-stack/* 依赖
  所有版本号（去掉 ^/~）必须相同
  不一致 → WARN：
    Found mixed tripod versions:
      @tripod-stack/shared-auth:      ^2.1.0
      @tripod-stack/shared-storage:   ^1.5.3   ← 漂移
      @tripod-stack/cli:              ^1.5.3   ← 漂移
    Tripod uses lockstep versioning — all packages should be on the same version.
    Run `pnpm tripod upgrade` to sync.
```

校验级别选 **warn 不 error** —— 避免阻塞开发，但让用户知道该修。

**3. release-rules.md 补一条 AI 读的规则**

```
当用户说"升级 shared-auth / 升级某个 tripod 包"：
- 先问用户："tripod 包是 lockstep 版本，要不要一起升到最新版？"
- 走 `pnpm tripod upgrade`，不要 `pnpm up @tripod-stack/shared-auth`
- 例外：用户明确说"只升这一个"，但要提示可能破坏 lockstep 一致性
```

#### 三层辅助

#### 1. docs/release-rules.md（AI 读取的规则）

```markdown
# Tripod 发版规则

## 版本级别

### patch（补丁）

- bug 修复，不改 API
- 文档/注释/测试
- 内部重构

### minor（次要）

- 新增 API / 字段（向后兼容）
- 新增可选参数
- 新增 DB 字段（可空或默认值）

### major（破坏性）

- 删/重命名公开 API
- 改函数签名
- 删字段/表
- 改现有语义

## 不需要 changeset

- 仅 docs/
- 仅 tests/
- 仅 CI / workflow 配置（若项目自行引入）
- 仅注释

## Summary 写法

- 用户视角，一句话
- 说给用户带来什么（不说 refactor 这种内部动作）
```

#### 2. CLAUDE.md 指令（Claude Code 在会话里自动做）

```markdown
## 发版流程

当用户说"加 changeset" / "生成 changeset" / "release 这个改动"：

1. 读 docs/release-rules.md
2. 运行 pnpm tripod changeset-context 拿 diff + 受影响包
3. 按规则判断每个包的版本级别
4. 在 .changeset/ 下新建文件（命名 两个随机词）
5. ## 格式：
   ## "@tripod-stack/xxx": minor
   一句话 summary
6. 告诉用户为什么选这个级别，让用户确认
```

#### 3. tripod-cli 辅助命令

```ts
// apps/cli/src/commands/changeset-context.ts
// pnpm tripod changeset-context 输出结构化 JSON，给 Claude Code 读
{
  baseBranch: 'main',
  affectedPackages: ['@tripod-stack/shared-auth', '@tripod-stack/server'],
  commits: [...],
  filesChanged: 23,
  diffSummary: {
    '@tripod-stack/shared-auth': ['added TotpChallenger interface', 'added MfaResolver'],
    '@tripod-stack/server': ['new /auth/login/mfa endpoint', 'DB migration: totp_secret field'],
  }
}
```

Claude Code 读这份 JSON + release-rules.md → 自动判断 → 写 `.changeset/*.md`。零 API 调用，纯对话完成。

#### 使用体验

```
# Claude Code 会话里
用户: 帮我加 changeset

Claude Code:
  (读 docs/release-rules.md)
  (运行 pnpm tripod changeset-context)
  (分析)

  我生成了 .changeset/calm-pandas-dance.md：

  ---
  "@tripod-stack/shared-auth": minor
  "@tripod-stack/server": minor
  ---

  新增 TOTP 双因素认证支持

  级别选 minor 的理由：
  - 新增 API（TotpChallenger）向后兼容
  - 新增 DB 字段（totp_secret 可空）
  - 无破坏性变更

  确认无误请 commit 这个文件，随 PR 一起提交。
```

#### 发版动作：`pnpm tripod release` 封装（维护者本地跑）

Tripod 的 npm 发版**不走 CI**（全局决定，见 §部署 + 发版）。维护者在本地一条命令 `pnpm tripod release` 走完整流程。

##### 鉴权：`npm login` + 2FA OTP

- 维护者本地**一次性**跑 `npm login` 输账号密码 + OTP 验证码，token 存本地 `~/.npmrc`
- npm account **强制开 2FA**（Authenticator / 1Password / Authy 生成 6 位 OTP）
- **不用** Granular Access Token（token 泄漏即可 bypass 2FA，public scope 风险太高）
- 每次 `pnpm -r publish` 交互式要 OTP，单次发版输一次

##### `tripod release` 流程（一条命令走完）

```bash
$ pnpm tripod release
```

内部步骤（`@tripod-stack/cli` 里实现）：

```
[1/9] 环境前置检查
      - git 工作区干净（无 untracked / uncommitted）
      - 当前在 main 分支
      - pnpm install 幂等（无 lockfile 漂移）
      - npm whoami 有登录态

[2/9] Smoke test（见缺口 6）
      pnpm tripod smoke-test
      - 对每个 recipe 跑 create + build + 最小运行验证

[3/9] Dry-run 预览
      pnpm -r publish --dry-run --access public
      打印每个包会 publish 什么 + 版本号
      提示维护者："Press Enter to proceed, Ctrl-C to abort"

[4/9] 消费 changesets → 更新版本号 + CHANGELOG
      pnpm changeset version
      ✓ 受影响包 package.json 版本 bump
      ✓ CHANGELOG.md 生成 / 追加
      ✓ pnpm-lock.yaml 自动更新
      ✓ .changeset/*.md 已消费的自动删除

[5/9] Commit + tag
      git add .
      git commit -m "release: v<version>"
      git tag v<version>

[6/9] 正式发布
      pnpm -r publish --access public
      ⚠️ 交互式弹"Enter OTP from authenticator: ______"
      维护者输 6 位 OTP（若 pnpm -r 对多个包逐个弹，用 --otp=<code> 一次传递）
      ✓ workspace:* 自动替换为 ^<新版本>
      ✓ lockstep 的全量 @tripod-stack/* 包 publish 到 npm @latest tag

[7/9] Push git
      git push origin main
      git push --tags

[8/9] GitHub Release（可选）
      gh release create v<version> --notes-from-tag
      （有 gh CLI 且 logged in 时自动做，否则跳过 + 提示维护者手动做）

[9/9] 发版后 smoke
      再跑一次 smoke-test，但这次用 npm 真实拉包（不走本地 workspace）
      pnpm tripod smoke-test --from-npm
      验证发出去的包真能被新项目拉下来跑起来

Done!  🎉
```

任一步骤失败 → 流程终止，打印清晰错误 + 恢复建议。

##### 发版失败回滚规则

npm 规则：**发版 72 小时内**可以 `npm unpublish <pkg>@<version>`，超过不行；`npm deprecate` 永远可以。

Tripod 发版失败处理：

- **72h 内发现严重问题**：`npm unpublish @tripod-stack/<pkg>@<version>` + `git tag -d v<version>` + `git push origin :v<version>`（撤 tag）+ 修 + 重新 `pnpm tripod release`
- **超 72h**：`npm deprecate @tripod-stack/<pkg>@<version> "has <issue>, use v<next> instead"` + 立刻发 hotfix（next patch 版本）
- **绝不手动删已 publish 的 git 历史**试图"回滚"，永远 forward 修复
- hotfix 例子：1.5.3 有 bug → deprecate 1.5.3 → 发 1.5.4 同时 CHANGELOG 注明"fixes 1.5.3 regression: ..."

##### Prerelease / `@next` 分发 tag —— **M2 不做**

所有 tripod 发版直接进 `@latest`，**不启用** Changesets 的 `pre enter / pre exit` 机制。理由：

- 单人 / 小团队维护，没有"胆大用户先试 breaking change"的社区基础
- Lockstep + prerelease 组合维护复杂度高（需要管 `fixed` 组所有包一起 enter/exit）
- 真需要预览时：本地 `pnpm -r pack` 出 tarball 发给信任 tester 手动装，够用

未来触发条件（Tier 2 激活）：

- tripod 有 ≥ 50 个外部用户且稳定反馈渠道
- 单次改动足够大、怕 `@latest` 直接坑现有用户
- 准备 2.0 major，想先发 `@next` 试 1 个月+

那时再跑 `pnpm changeset pre enter next` 启用。

##### 企业私有 registry 发版

企业 fork 场景（`@mycorp/tripod-*`）在 `.npmrc` 配私有 registry：

```
@mycorp:registry=https://verdaccio.mycorp.local
//verdaccio.mycorp.local/:_authToken=${VERDACCIO_TOKEN}
```

然后 `pnpm -r publish --registry=https://verdaccio.mycorp.local`。`tripod release` 支持 `--registry=<url>` 参数 forward。**不在 tripod 官方范围**，只在 docs/secrets-management.md 提一句。

##### AI 辅助（不代跑）

AI 可以帮维护者**准备**发版（加 changeset / 写 CHANGELOG summary），但**不代跑**：

- `pnpm tripod release`（涉及对外 publish）
- `pnpm -r publish`
- `npm login` / `npm unpublish` / `npm deprecate`
- `git tag` / `git push --tags`

理由同 core §6.1：对外公开的动作 / 不可逆动作 / 需 2FA 的 → 必须维护者人工触发。

### 模板 smoke test（`pnpm tripod smoke-test`）

**为什么必须有**：砍了 CI 后，没有什么拦截"改了 shared-auth 但忘了同步改模板代码"。smoke test 是 tripod 作为模板体系的质量命脉。

#### 测什么

**每个 recipe 从头创建一个项目并跑通**：

```
For each recipe in [minimal, erp-standard, erp-commerce]:
  1. 临时目录 /tmp/tripod-smoke-<recipe>-<timestamp>/
  2. pnpm create tripod _smoke --recipe=<recipe>
     （默认走本地 workspace 版本；--from-npm 时走 npm 已发布版）
  3. cd _smoke
  4. 验证 package.json 的 @tripod-stack/* 依赖都正确解析
     （workspace:* 应该已经替换为具体版本号）
  5. pnpm install
  6. pnpm build                    # 所有 app 的 build（tsc / vite build / next build）
  7. pnpm test                     # 各 shared-* 和 apps 的 vitest 跑绿
  8. pnpm tripod doctor            # 新项目自身无不一致
  9. 清理 /tmp/tripod-smoke-*（除非 --keep）

任一步失败 → 报具体哪个 recipe + 错误摘要 + 临时目录路径
```

**不测**：

- 不起 docker / 不起 server / 不做 HTTP 端到端测试（时间成本太高，不适合 smoke）
- 不跑 Playwright UI E2E（同上）
- 这些留给 spec-driven-testing 的三层测试机制（每个具体 resource 的测试）

#### 何时跑

| 时机                                              | 谁触发   | 原因                           |
| ------------------------------------------------- | -------- | ------------------------------ |
| **`pnpm tripod release` 第 2 步**                 | 自动     | 发版前必过，防"发版挂了新项目" |
| **`pnpm tripod release` 第 9 步**（`--from-npm`） | 自动     | 发版后拉真实 npm 包验证一次    |
| 维护者改模板 / 改 shared-\* 接口后                | 手动     | `pnpm tripod smoke-test` 自检  |
| husky pre-commit/pre-push                         | **不加** | 太慢（6+ 分钟），影响日常开发  |

#### 命令

```bash
pnpm tripod smoke-test                          # 跑所有 recipe（本地 workspace 版本）
pnpm tripod smoke-test --recipe=erp-standard    # 只跑一个
pnpm tripod smoke-test --recipe=all             # 显式全量
pnpm tripod smoke-test --from-npm               # 用 npm 上的真实包（release 后验证用）
pnpm tripod smoke-test --keep                   # 保留临时项目不删（debug 用）
pnpm tripod smoke-test --parallel               # 3 个 recipe 并发（快但日志乱）
```

#### 性能目标

3 个 recipe 串行 ≈ 6 分钟（每个 recipe ~2 分钟：install 40s + build 40s + test 30s + 其他 10s）；`--parallel` 并发可压到 2.5 分钟。

#### 失败排查

```
✗ Smoke test failed: recipe=erp-standard
  Step: pnpm build (apps/admin-web)
  Error: Cannot find module '@tripod-stack/shared-workflow'
  Temp dir: /tmp/tripod-smoke-erp-standard-20260422-103045/  (--keep)

  Likely cause: adapters/auth-email-password 新增了 shared-workflow 依赖，
                但 templates/apps/admin-web/package.json 没同步加。

  修复：在 templates/apps/admin-web/package.json 加 "@tripod-stack/shared-workflow": "workspace:*"
  然后 pnpm tripod smoke-test 重跑。
```

#### Smoke fixture 比对（Tier 2，不做）

**未来可能的增强**：维护 `fixtures/smoke-baseline/<recipe>/` 黄金副本，smoke 产出和 baseline 做 file tree diff，发现"意外多 / 少 / 改了文件"→ 报警。这是 M3+ 的锦上添花，M2 不做 —— `pnpm build + pnpm test` 通过已经覆盖 95% 回归场景。

### 合入门槛（本地 husky hook，不走 CI）

Tripod **不做 CI 驱动的 PR 门槛**，合入检查靠本地 hook：

```
.husky/pre-commit
├── lint-staged      # prettier + eslint --fix
├── gitleaks         # 扫 secrets 泄漏
└── （速度敏感，只跑 staged 文件）

.husky/pre-push
├── pnpm turbo run typecheck --filter=...[origin/main]    # 受影响包
├── pnpm turbo run test     --filter=...[origin/main]
├── pnpm turbo run build    --filter=...[origin/main]
└── pnpm changeset status --since=origin/main             # 提醒"要加 changeset 吗"，非阻断
```

`--filter=...[origin/main]` 只跑受影响包，pre-push 几分钟内跑完。

**禁止 `--no-verify` 绕过 hook**。Code review 约定：reviewer 发现 PR 明显未跑 hook（commit 有未修 lint 错）直接驳回。

真正的企业协作（大团队 / 开源贡献者 / ops 审计要求）需要 CI 门槛时，项目自己加 `.github/workflows/` 或对应平台配置，tripod 不提供默认模板。

### PR 模板（`.github/pull_request_template.md` 等价，因 Git 平台而异）

模板随 tripod 模板分发，作用：**强制 PR 作者自查各项契约是否落到位**，省 reviewer 精力。

```markdown
## 本次改动

<!-- 一句话说清楚做了什么，以及为什么 -->

## 改动类型（勾选）

- [ ] Feat — 新功能
- [ ] Fix — bug 修复
- [ ] Refactor — 重构（无行为变更）
- [ ] Docs — 文档
- [ ] Chore — 工程 / 依赖 / CI
- [ ] Breaking — 破坏性变更（必须 major 版本 + 迁移指引）

## 自查清单（Tripod 契约）

> AI 生成的 PR 也要跑这个 checklist；漏项会被 reviewer 要求补齐

**多租户 / 数据隔离**

- [ ] 新建业务表：schema 有 `tenantId UUID NOT NULL` + 复合索引 + RLS policy
- [ ] 无 `new PrismaClient()`（只 `PrismaService`）
- [ ] 无手写 `tenantId: ctx.tenantId`（middleware 自动加）
- [ ] `$unscoped` 使用有审计日志

**权限**

- [ ] 新增写操作 controller 有 `@RequirePermission(...)` 或 `@Public()`
- [ ] 新增 ACTION 节点登记在 `<r>.permissions.ts` + `<r>.manifest.ts`
- [ ] 前端新增按钮用 `<Gate perm="...">` 包裹

**错误码 / i18n**

- [ ] 新增 `BusinessException` 都用登记的 errorCode 常量（非字符串）
- [ ] 新增 errorCode 4 语言翻译齐全（zh-CN / en-US / zh-TW / ja-JP）
- [ ] 错误码 HTTP status 映射匹配 core §4.3.2

**幂等 / 关键操作**

- [ ] 写操作 controller（M3+ 支付 / 发货）有 `@Idempotent()`
- [ ] 状态转换走 service 方法（不在 controller 直接改 state）+ 乐观锁版本号

**时间 / 金额**

- [ ] DB DateTime 字段用 `@db.Timestamptz(6)`
- [ ] 无 `new Date()` / `Date.now()`（业务代码）
- [ ] 金额 / 数量字段用 `Decimal` + 传输 `string`，无 `number`
- [ ] 无 `parseFloat` / `Number(str)` 做金额运算

**审计**

- [ ] 关键业务动作有 `await this.audit.log({...})`
- [ ] `<r>.manifest.ts` 的 `audits[]` 列出所有审计事件

**软删除 / 迁移**

- [ ] 软删资源的 `<r>.manifest.ts` 声明 `softDelete: true`
- [ ] 破坏性 migration（drop / alter type）配手写 `revert.sql`
- [ ] migration 命名 snake_case + 描述明确（`add_order_state_history` 而非 `fix_1`）

**测试**

- [ ] 新增资源走 `/spec-driven-testing` 三轨流程，TC 全绿
- [ ] 没删测试让 PR 过、没加 `.skip`、没加 `@ts-ignore` / `eslint-disable` 绕过

**CI / 发版**

- [ ] `pnpm lint` / `typecheck` / `test` / `build` 全绿
- [ ] 涉及 public API 变更：有 `.changeset/*.md`
- [ ] env 新增字段：`shared-config/env.ts` 更新 + `.env.prod.example` 重生成

## 测试证据

<!-- 截图 / 测试输出 / 手动验证步骤；纯文档 PR 可写 "N/A" -->

## 相关 issue / PRD

<!-- 链接 / 关闭语法（Closes #123） -->

## Breaking changes / 迁移指引

<!-- 勾了 Breaking 时必填：破坏什么 + 用户如何迁移 -->
```

### Code Review Checklist（reviewer 视角）

独立文档 `docs/code-review-checklist.md`，reviewer 看 PR 时对照：

```markdown
# Tripod Code Review Checklist

## 架构契约（核心）

1. **多租户**：任一 DB 查询 / 写入是否跨越 tenant？RLS 是否生效？
2. **权限**：每个写操作 handler 有 @RequirePermission 或 @Public？DATA_SCOPE 是否在后端 where 过滤？
3. **错误码**：无 `throw new Error('字符串')`；所有 BusinessException 的 code 都在 `error-codes.ts`；4 语言翻译齐全
4. **幂等**：外部可触发的写（支付 / 下单 / webhook）有 @Idempotent；重试语义正确
5. **时间金额**：DateTime 有 timezone；金额走 Decimal + string

## 代码质量

6. **可读性**：变量 / 函数命名直达意图，无 `tmp1` / `doStuff`
7. **Silent failure**：`catch(e) {}` 是否有意义地处理了错误？
8. **Prisma N+1**：循环里有 `prisma.xxx.findMany`？应合并成单查询或加 `include`
9. **过度抽象**：有没有预埋未来也许用得到的接口？按 YAGNI 拒
10. **遗留的 TODO / FIXME**：是否登记到 issue tracker？

## 测试

11. **TC 覆盖率**：新增 public 方法 / controller 至少一个 happy path + 一个 edge case
12. **多租户测试**：用 `createTestTenant` fixture，不裸 insert
13. **Mock vs 真实 DB**：业务测试跑真实 Postgres（测试容器），别 mock Prisma

## UX / 前端（admin-web / portal）

14. **Loading 态**：长操作（>300ms）有 loading / skeleton
15. **Error 态**：网络失败的 UI 反馈（不是 silent 或白屏）
16. **Empty 态**：列表空态有引导 CTA
17. **可访问性**：按钮 `aria-label` / 表单 label 关联 / 键盘可达

## 性能

18. **分页**：列表默认走 paginate helper；无深 offset
19. **索引**：新增 where 条件的字段是否有索引？
20. **缓存**：强可缓存读（字典、公共配置）是否用 shared-cache
```

这个清单 reviewer 不需要逐条打钩，但遇到红线项（1-5 架构契约）必须确认；其他是"值得关注"级别。

### 数据库迁移策略

- 启动前跑 `prisma migrate deploy`
- **零停机迁移**：先改 schema 兼容老代码（新列可空/新表），部署新代码后再迁移数据
- 大表用 `pg-osc` 避免锁表
- 部署前自动 DB 快照（`infra/deploy/snapshot-db.sh`）

### infra 目录最终结构

```
infra/
├── docker/
│   ├── server.Dockerfile
│   ├── admin.Dockerfile
│   └── platform.Dockerfile
├── compose/
│   ├── docker-compose.yml                   # 开发 pg+redis+mailhog+minio+glitchtip
│   ├── docker-compose.prod.yml              # 生产模板（只暴露 HTTP 端口；HTTPS/反代由运维层负责）
│   └── observability.yml                    # profile: GlitchTip 单容器（M2 唯一）
├── deploy/
│   ├── build.sh                             # 本地构建 + env:validate + 打包 + scp（主入口）
│   ├── deploy.sh                            # server 端解压后执行（被 build.sh 远程调用）
│   ├── rollback.sh                          # server 端切 current symlink + restart
│   ├── snapshot-db.sh                       # 部署前 DB 快照
│   ├── smoke-test.sh                        # 部署后冒烟
│   ├── .env.prod.example                    # 模板（仅 key + 注释，无值；gen-example 自动生成）
│   └── README.md                             # 部署流程文档
├── db-scripts/                              # RLS policy 模板 + tenant 表 generator
├── backup/                                  ⭐ M2 — DB 备份（自建部署命脉，详见下节）
│   ├── pg-backup.sh                         # pg_dump 定时脚本（系统 cron 调用）
│   ├── pg-restore.sh                        # 单次恢复（带确认提示）
│   ├── verify-backup.sh                     # 每周验证恢复 + schema diff
│   ├── rotation.conf                        # 保留：日 7 / 周 4 / 月 12 / 年 ∞
│   └── README.md                            # 备份 / 恢复 runbook（含 RPO / RTO）
└── mobile-selfhost/                         # Tier 2 Fastlane + 自托管 OTA
```

**不在 tripod 范围**（由运维层 / 团队工程习惯解决）：

- Git 代码托管平台 / CI / 流水线
- HTTPS 证书管理（生产证书由 LB / CDN / 运维自行处理）
- 对外反向代理（生产 LB / Kong / 云厂商 CDN 都行；tripod 容器只暴露 HTTP 端口）
- Mobile CI / EAS Build 集成（M5 做 mobile 时由团队自选）

#### 仓库根部的其他目录（非 infra）

```
secrets/                                     # ⭐ 仅本地（发布人电脑），整个 gitignore
├── .env.prod                                # 生产真值
├── .env.staging                             # 预发真值（可选）
└── README.md                                # 安全提醒：FileVault + 1Password 备份

apps/cli/                                    # tripod-cli（含 env:validate / changeset-context 等）

docs/
├── release-rules.md                         # 版本判断规则（AI 读）
├── deployment.md
├── secrets-management.md                    # 本地 secrets 维护 + 打包捎带流程（默认）
└── secrets-management-sops.md                # Tier 2: sops 加密入库

CLAUDE.md                                    # 告诉 Claude Code 如何做发版/审计/etc
```

### DB 备份策略（M2 核心）

**为什么 M2 就要上**：自建部署没有云厂商自动备份兜底；DB 是唯一不可复建的生产资产（代码可从 git / 镜像恢复，secrets 在本地有）。

#### 备份节奏

| 类型 | 频率                            | 保留  | 存放                                       |
| ---- | ------------------------------- | ----- | ------------------------------------------ |
| 日备 | 每天 `03:30`（tenant 时区低峰） | 7 份  | DB 服务器 `/var/backups/tripod/daily/`     |
| 周备 | 每周日 `03:30`                  | 4 份  | `weekly/`（硬链接日备，不占额外空间）      |
| 月备 | 每月 1 号 `03:30`               | 12 份 | `monthly/`                                 |
| 年备 | 每年 1 月 1 号                  | 永久  | `yearly/` + **异地拷贝**（至少一份离机房） |

实现：系统 `cron` 调 `pg-backup.sh`；脚本内部按日期判定是否周 / 月 / 年节点，硬链接到对应目录（不重复占磁盘）。

#### `pg-backup.sh` 主流程

```bash
#!/usr/bin/env bash
set -euo pipefail

TS=$(date +%Y%m%d-%H%M%S)
OUT=/var/backups/tripod
FILE="${OUT}/daily/tripod-${TS}.sql.gz"

# 1. pg_dump（custom format + 压缩）
pg_dump --host="${PGHOST}" --username="${PGUSER}" \
  --format=custom --compress=6 --file="${FILE%.gz}.dump" "${PGDATABASE}"

# 2. 验证 dump 可读
pg_restore --list "${FILE%.gz}.dump" > /dev/null

# 3. 额外出 SQL 文本（便于 grep / partial restore）
gzip -c < <(pg_restore --no-owner --no-acl -f - "${FILE%.gz}.dump") > "${FILE}"

# 4. 硬链接到周 / 月 / 年
[[ "$(date +%u)" == "7" ]]  && ln "${FILE}" "${OUT}/weekly/"
[[ "$(date +%d)" == "01" ]] && ln "${FILE}" "${OUT}/monthly/"
[[ "$(date +%j)" == "001" ]] && ln "${FILE}" "${OUT}/yearly/"

# 5. 清理过期
find "${OUT}/daily"   -name "tripod-*.sql.gz" -mtime +7   -delete
find "${OUT}/weekly"  -name "tripod-*.sql.gz" -mtime +28  -delete
find "${OUT}/monthly" -name "tripod-*.sql.gz" -mtime +365 -delete

# 6. 元数据 + 通知
echo "{\"ts\":\"${TS}\",\"size\":$(stat -c%s ${FILE}),\"sha256\":\"$(sha256sum ${FILE}|cut -d' ' -f1)\"}" \
  >> "${OUT}/backup.log.ndjson"
curl -X POST "${OPS_WEBHOOK_URL}" -d "{\"text\":\"tripod backup done: ${TS}\"}" || true
```

#### RPO / RTO 目标

| 指标                        | M2 目标                                | 实现       |
| --------------------------- | -------------------------------------- | ---------- |
| RPO（最大数据丢失窗口）     | **24 小时**                            | 日备       |
| RTO（恢复时间）             | **< 1 小时**                           | 单命令恢复 |
| 更严 RPO（小时级 / 分钟级） | Tier 2 — WAL archiving + Barman / PITR | M2 不做    |

#### 每周验证（关键：没验证过的备份等于没备份）

`verify-backup.sh` 每周日 `05:00`：

```
1. 起临时 Postgres 容器（docker run postgres:17）
2. pg_restore 最新日备到临时 DB
3. pg_dump --schema-only 临时 vs 生产，diff 空才通过
4. 跑 smoke 查询（tenant 数 / 用户数 / 订单数 > 0）
5. 关容器，结果写 infra/backup/verify.log；失败发 ops 群
```

#### 恢复 runbook（`infra/backup/README.md`）

- **场景 1**：误删一个 tenant 的所有订单 → `pg-restore.sh --only-table=order --where="tenant_id='...'"` partial restore 到临时 DB，手动 INSERT 恢复到生产
- **场景 2**：生产 DB 完全损坏 → 停服 → `pg-restore.sh latest.sql.gz --target=prod --force` → smoke → 放流量
- **场景 3**：Prisma migration 出 bug → 优先 `prisma migrate resolve` 修复，备份恢复是兜底

#### AI 相关约束

- AI 生成的破坏性 migration（drop column / alter type）**必须**配手写 `revert.sql` 放 `prisma/migrations/<ts>_<name>/revert.sql`
- AI 提议"生产直接跑 `prisma db push`" → 立即拦住（绕过 migration history）
- AI 提议对 prod 执行 `DELETE / DROP / TRUNCATE` → **必先**要求用户确认最近备份已跑且验证通过
- AI **禁**自主跑 `pg-backup.sh` / `pg-restore.sh`（涉及生产 DB 的操作都由用户手动触发）

### 里程碑

- **M1**：基础 CI（lint/test/build on PR）+ Turborepo 缓存
- **M2**：env Zod schema + Docker 镜像构建 + `infra/deploy/` 脚本 + Changesets + tripod-cli 辅助命令 + release-rules.md + CLAUDE.md 指令（**无 CI / 无 workflow 模板**，门槛靠 husky hook）
- **M3**：生产部署 + 回滚 + 冒烟
- **M5**：Mobile EAS CI
- **M6**：安全扫描 + K8s adapter（Tier 2）+ Secrets adapter（sops/Vault/Doppler）

### AI 读解路径（CI/CD + Secrets + Release）

**加 env 字段 5 步**（见 core §CLAUDE.md 规范 §5）：

1. `packages/shared-config/src/env.ts` Zod schema 加字段
2. `tripod env:gen-example > infra/deploy/.env.prod.example` 同步模板
3. 告诉用户补 `secrets/.env.prod`（AI **不代填真值**）
4. 用户跑 `tripod env:validate secrets/.env.prod` 通过
5. 使用 env 走 `import { env } from '@tripod-stack/shared-config'`

**加 changeset**（AI 全自动）：

1. 读 `docs/release-rules.md`
2. 跑 `pnpm tripod changeset-context` 拿结构化 diff
3. 按规则判断每个受影响包的版本级别
4. 写 `.changeset/<two-random-words>.md`
5. 告诉用户级别选择理由 + 等用户 commit（**不代 commit**）

**发版 / 部署 AI 禁令**：

- 不代跑 `build.sh`、`pnpm changeset version`、`git tag`、`git push --tags`、`docker compose up -d`、`prisma migrate deploy`
- 不改 `secrets/.env.prod`（只能提示用户）
- 不跳过 pre-commit hook（gitleaks 必过）
- 不在 CI workflow 里引用敏感 secrets 值（部署坐标 `DEPLOY_HOST` 可，业务 secrets 不可）

**AI 诊断**：用户说"发版失败"：

1. 先问 `build.sh` 是在第几步挂的（env:validate / docker build / scp / ssh deploy）
2. env 阶段 → 跑 `tripod env:validate` + `env:doctor` 定位
3. build 阶段 → 查 Dockerfile 路径 + base image pull 权限
4. scp 阶段 → 查 SSH key + DEPLOY_HOST 可达
5. deploy 阶段 → SSH 进 server 看 `docker compose logs`

---

## Tripod CLI 与项目配置体系

### 目标

让**新项目从模板脱钩后仍能结构化地加/减/换功能（含整个 app）**，且 AI（Claude Code）和非 AI 用户都能操作，不靠 wizard。

### 八条核心决策

| #   | 议题                   | 决策                                                                                                                                                        |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 模板分发               | `npm create tripod`（scaffold 后脱钩），非 git upstream                                                                                                     |
| 2   | AI 角色                | AI 起草 `tripod.config.yaml` diff → 用户确认 → AI 执行 CLI                                                                                                  |
| 3   | Remove 策略            | **Feature 级保守**：保留代码 + DB 表，`disabled` 不加载；**Adapter 级激进**：真删 `package.json`；**App 级保守**：`apps/<type>/` → `apps/_disabled-<type>/` |
| 4   | 配置存哪               | 单文件 `tripod.config.yaml`（含 `apps` / `features` / `adapters` 三段）                                                                                     |
| 5   | Recipe 颗粒度          | 大 recipe + 微调；3 个 recipe：`minimal` / `erp-standard` / `erp-commerce`；均含 apps + features + adapters                                                 |
| 6   | Wizard                 | 不做 inquirer；仅 recipe + AI；非 AI 用户手改 yaml                                                                                                          |
| 7   | 装包 vs feature vs app | 三层并列：`apps:` 定物理目录与业务形态；`features:` 定功能模块；`adapters:` 定实现绑定；运行时行为走 `.env`                                                 |
| 8   | 包分发                 | 公共 npm；scope `@tripod-stack`；bootstrap 包 `create-tripod`；模板包 `@tripod-stack/templates`                                                             |

### App 层架构

**7 种 app 类型**：

| Type           | 定位                          | 技术栈          | 默认 recipe                           |
| -------------- | ----------------------------- | --------------- | ------------------------------------- |
| `server`       | NestJS 后端（所有业务 API）   | NestJS + Prisma | minimal / erp-standard / erp-commerce |
| `platform`     | 平台超管（总部 / SaaS 超管）  | React 19 + Vite | **不进任何默认 recipe**，按需加       |
| `admin-web`    | 租户管理后台                  | React 19 + Vite | minimal / erp-standard / erp-commerce |
| `admin-mobile` | 租户管理移动端（现场 / 经理） | Expo RN         | **不进任何默认 recipe**，按需加       |
| `portal`       | 门户 / 官网 / 文档站          | Next.js 15      | erp-commerce                          |
| `mall-web`     | 商城 Web（购物车 / 结算）     | Next.js 15      | erp-commerce                          |
| `mall-mobile`  | 商城移动端（含支付 SDK）      | Expo RN         | erp-commerce                          |

**命名规则**：需要区分形态才加 suffix（`admin-web` / `admin-mobile` / `mall-web` / `mall-mobile`）；天然唯一形态不加（`server` / `platform` / `portal`）。

**Platform 特别说明**：

- **数据底层始终多租户**，即便不装 `apps/platform/` SPA。M1 Seed 会建 `default-tenant`，所有业务数据自动归属 —— 让"后期加 platform"**零数据迁移**
- 两种等价语义：**SaaS 模式**（platform = SaaS 服务商，tenant = 客户公司）/ **企业集团模式**（platform = 总部，tenant = 分公司 / 加盟商 / 独立门店）。技术架构相同，业务叙述不同
- MFA 默认**关闭**；需要时 `tripod add-adapter mfa.totp=mfa-totp` + `tripod platform:enroll-mfa`
- 后端 platform 模块代码由 `@tripod-stack/templates/modules/platform/` 提供，`tripod add-app platform` 时自动激活 AppModule 里的 import

### 模板的"装配描述"：`tripod.app.yaml`

每个 app 模板自带 `tripod.app.yaml`，声明安装时对根级文件的修改 —— CLI 本身零硬编码，新增 app 类型 = 新增模板目录。

```yaml
# templates/apps/portal/tripod.app.yaml
type: portal
depends-on-features: [i18n, logger]
shared-packages: [shared-theme, shared-i18n, shared-logger, shared-api-client, shared-contract]

patches:
  - file: pnpm-workspace.yaml
    op: yaml-array-add
    path: packages
    value: 'apps/portal'
  - file: turbo.json
    op: yaml-merge
    path: pipeline
    value: { build: { dependsOn: ['^build'], outputs: ['.next/**'] } }
  - file: infra/compose/docker-compose.yml
    op: yaml-service-add
    template: service.yml.tpl
  - file: infra/docker/
    op: file-add
    name: portal.Dockerfile
    template: Dockerfile.tpl

hot-spot-edits: # 需要走 magic comment 的 TS 文件
  - file: apps/server/src/app.module.ts
    marker: 'tripod:module-imports'
    insert: 'PortalPublicModule'
```

### 三份 Schema

#### `tripod.manifest.yaml`（模板里固定，事实源）

```yaml
version: 1
tripodVersion: '0.1.0'
requires: { node: '>=20', pnpm: '>=9' }
templates-package: '@tripod-stack/templates' # 可被企业 fork 覆盖

apps:
  server:
    required: true
    template: templates/apps/server
  platform:
    required: false
    template: templates/apps/platform
    on-disable: { rename-to: 'apps/_disabled-platform/' }
    correlates-feature: platform-admin # add-app 时自动启用此 feature
  admin-web:
    required: false
    template: templates/apps/admin-web
  admin-mobile:
    required: false
    template: templates/apps/admin-mobile
  portal:
    required: false
    template: templates/apps/portal
  mall-web:
    required: false
    template: templates/apps/mall-web
  mall-mobile:
    required: false
    template: templates/apps/mall-mobile

features:
  auth:
    description: '登录/登出/token 生命周期'
    required: true # 不可 disable
    package: '@tripod-stack/shared-auth'
    module: 'SharedAuthModule'
    module-path: 'apps/server/src/app.module.ts'
    depends-on: [shared-config, shared-contract]
    adapter-slots:
      credential: { multi: true, default: [email-password] }
      recovery: { multi: false, default: email-link }
      mfa: { multi: true, default: [] } # 默认空，按需开启
    migrations: [prisma/migrations/XXX_auth.sql]

  platform-admin:
    description: '后端 /api/platform/** 模块（由 apps/platform 激活）'
    required: false
    package: '@tripod-stack/shared-platform'
    module: 'SharedPlatformModule'
    depends-on: [auth, permission, audit]
    on-disable: { keep-code: true, keep-tables: true, comment-import: true }

  audit:
    description: '业务审计日志'
    required: false
    package: '@tripod-stack/shared-audit'
    module: 'SharedAuditModule'
    depends-on: [auth, logger]
    migrations: [prisma/migrations/XXX_audit.sql]
    env-optional: [AUDIT_MODE]
    on-disable: { keep-code: true, keep-tables: true, comment-import: true }

  notification:
    adapter-slots:
      email: { multi: false, default: smtp }
      sms: { multi: false, default: null }
      push: { multi: false, default: null }
      webhook: { multi: false, default: null }
      realtime: { multi: false, default: sse }

  storage:
    adapter-slots:
      backend: { multi: false, default: local }

adapters:
  storage-local:
    feature: storage
    slot: backend
    package: '@tripod-stack/adapter-storage-local'
    env-required: [STORAGE_ROOT]
  storage-s3:
    feature: storage
    slot: backend
    package: '@tripod-stack/adapter-storage-s3'
    env-required: [AWS_REGION, AWS_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY]
  auth-email-password:
    feature: auth
    slot: credential
    package: '@tripod-stack/adapter-auth-email-password'
  mfa-totp:
    feature: auth
    slot: mfa
    package: '@tripod-stack/adapter-mfa-totp'
    env-required: [MFA_TOTP_ISSUER]

recipes:
  minimal:
    description: '最小骨架：server + admin-web，最小 feature 集'
    apps: [server, admin-web]
    features: [auth, permission, i18n, logger]
    adapters:
      'auth.credential': [email-password, email-otp] # 默认两种登录方式
      'auth.recovery': email-link
      'storage.backend': local
    ui-library: # ⭐ 每种 app 的默认 UI 库
      admin-web: antd
      platform: antd
      portal: shadcn
      mall-web: shadcn
      admin-mobile: gluestack
      mall-mobile: gluestack
    preset-modules: [] # 不预置业务模块

  erp-standard:
    description: '通用 ERP（纯管理后台）：场景 2 起点 — 仓储 + 销售'
    extends: minimal
    features:
      [workflow, storage, notification, audit, scheduler, cache, export, feature-flag, analytics]
    adapters:
      'auth.credential': [email-password, email-otp, magic-link] # 默认 3 种
      'notification.email': smtp
      'notification.realtime': sse
      'audit.backend': postgres
      'analytics.provider': null
      'flag.provider': local
    preset-modules: # 预置的业务领域骨架
      - customer
      - sku
      - warehouse
      - stock-location
      - inventory
      - stock-movement
      - sales-order
      - purchase-order
      - supplier
      - price-list

  erp-commerce:
    description: 'ERP + 门户 + 商城：场景 1 起点'
    extends: erp-standard
    apps: [portal, mall-web, mall-mobile] # 追加到 minimal/erp-standard 继承的
    features: [payment, cart, promotion, shipping] # mall 场景新增
    adapters:
      'payment.provider': mock # M2 默认 payment-mock（业务 Tier 2 接真实支付）
      'shipping.provider': mock # 同上
      'search.provider': pg-fulltext # M2 Postgres 全文检索
    preset-modules: # 在 erp-standard 基础上追加
      - product # 面向消费者的商品（SKU 的对外呈现）
      - product-category
      - cart
      - customer-order # 消费者订单（和 sales-order 不同）
      - payment # 订单支付
      - shipment
      - coupon
      - review

demos:
  warehouse:
    description: '仓储销售参考实现'
    path: demos/warehouse
    generates: [warehouse, sku, stock-location, inbound-order, outbound-order]
  sales: { ... }
  hr: { ... }

generators:
  crud:
    description: '前后端 CRUD 骨架（AI 首选命令）'
    command: 'pnpm tripod gen:crud <resource>'
    inputs:
      - name: resource
        example: 'sales-order'
        transform: { kebab, pascal, camel } # 同一输入生成 SalesOrder / salesOrder / sales-order 三种形式
    outputs:
      # 后端
      - 'apps/server/src/<resource>/<resource>.module.ts'
      - 'apps/server/src/<resource>/<resource>.controller.ts'
      - 'apps/server/src/<resource>/<resource>.service.ts'
      - 'apps/server/src/<resource>/<resource>.manifest.ts' # ⭐ AI 索引卡
      - 'apps/server/src/<resource>/<resource>.permissions.ts'
      - 'apps/server/src/<resource>/dto/<resource>.dto.ts'
      - 'apps/server/src/<resource>/dto/create-<resource>.dto.ts'
      - 'apps/server/src/<resource>/dto/update-<resource>.dto.ts'
      - 'apps/server/prisma/migrations/<timestamp>_add_<resource>/migration.sql' # 含 RLS policy + tenantId 复合索引
      # 前端（admin-web 装了才产出）
      - 'apps/admin-web/src/pages/<resource>/index.tsx'
      - 'apps/admin-web/src/pages/<resource>/<resource>-list.tsx'
      - 'apps/admin-web/src/pages/<resource>/<resource>-form.tsx'
      - 'apps/admin-web/src/pages/<resource>/hooks/use-<resource>.ts'
    patches:
      - file: 'apps/server/src/app.module.ts'
        marker: 'tripod:module-imports'
        insert: '<Resource>Module'
      - file: 'prisma/schema.prisma'
        op: 'append'
        content: 'model <Resource> { ... }'
      - file: 'apps/admin-web/src/router.tsx'
        marker: 'tripod:routes'
        insert: "{ path: '/<resource>', element: <<Resource>Page /> }"
    header-comment: '// tripod:generated-by gen:crud <resource>'

  permission:
    description: '只生成权限声明文件（无 prisma / UI）'
    command: 'pnpm tripod gen:permission <resource>'
    outputs:
      - 'apps/server/src/<resource>/<resource>.permissions.ts'
    header-comment: '// tripod:generated-by gen:permission <resource>'

  workflow:
    description: '生成状态化实体的 state 字段 + history 表 + manifest transitions'
    command: 'pnpm tripod gen:workflow <resource>'
    outputs:
      - 'apps/server/src/<resource>/<resource>.manifest.ts' # 更新 states + transitions 段
      - 'apps/server/prisma/migrations/<timestamp>_add_<resource>_state/migration.sql'
    patches:
      - file: 'apps/server/src/<resource>/<resource>.service.ts'
        marker: 'tripod:state-transitions'
        insert: '<state transition methods...>'
    header-comment: '// tripod:generated-by gen:workflow <resource>'

  notification-type:
    description: '注册通知类型'
    command: 'pnpm tripod gen:notification-type <typeId>'
    outputs:
      - 'apps/server/src/<resource>/<resource>.notification-types.ts'
      - 'apps/server/src/<resource>/templates/<typeId>.hbs' # 默认 Handlebars 模板
    header-comment: '// tripod:generated-by gen:notification-type <typeId>'
```

**AI 使用 generator 的规则**：

- 用户说"加订单模块 / 写个订单管理"，AI **首选**跑 `pnpm tripod gen:crud order`，不手写
- 跑完后根据业务逻辑补 manifest.ts 里的 transitions / audits / notifications 等业务专属内容
- generator 产物文件顶部 `// tripod:generated-by gen:crud <resource>` magic comment 保留不删
- 改动超过 50% 时把注释改为 `// tripod:manually-edited from gen:crud <resource>`，让后续 AI 知道这不再是纯脚手架
- 每个 generator 在 manifest.yaml 里 **必须声明 `outputs:` 完整清单** —— AI 跑前可以 `tripod recipe show` 预览会生成什么，避免惊讶

**统一 `adapter-slots` 概念**：所有有多 adapter 的 feature 都用 slot 表达（不只 auth）。`multi: true` 允许多选（如 auth 可同时开 email-password + oauth-google），`multi: false` 单选。

**`extends` 合并规则**：

- `apps` / `features`：**并集 dedup**（子追加到父）
- `adapters`：**浅合并**（子覆盖父同 key）
- 没列的 slot 走 manifest 里的 `default`

#### `tripod.config.yaml`（项目里变化）

```yaml
version: 1
tripodVersion: '0.1.0'
generatedFrom: erp-standard # 注释性，无语义

apps: # 当前装了的 app 物理目录
  - server
  - admin-web

disabled-apps: # 曾装过现禁用（apps/_disabled-* 保留）
  platform:
    at: '2026-05-01'
    reason: '暂停分公司管理'

features: # 当前启用
  - auth
  - permission
  - i18n
  - logger
  - storage
  - notification
  - audit
  - scheduler
  - cache

disabled: # 曾启用现禁用的 feature（代码保留）
  workflow:
    at: '2026-04-21'
    reason: '单人项目暂不需要审批流'

adapters: # 装即生效
  'auth.credential': [email-password]
  'auth.recovery': email-link
  'storage.backend': s3
  'notification.email': smtp
```

**三态语义（app 与 feature 一致）**：

- 在 `apps:` / `features:` → active（目录存在 + 代码加载 + module 装载）
- 在 `disabled-apps:` / `disabled:` → 代码保留（目录重命名或 import 注释），`add-app` / `add` 秒恢复
- 两处都不在 → 从未装（`add-app` / `add` 走全量安装 + migration）

#### `CLAUDE.md`（模板根，教 AI 怎么 interview）

```
当用户说"用 tripod 新建项目"时：
1. pnpm create tripod <name>                       # 先不带 recipe，起空白 manifest
2. 问业务形态：纯 ERP / ERP + 商城 / 多分公司 / 多客户 SaaS
3. 从 manifest 推荐 recipe + 必要的 app 增减
4. 生成 tripod.config.yaml diff → 给用户看 → 等确认
5. 确认后执行 tripod add-app / add / add-adapter 命令组合
6. 最后 tripod doctor 体检 + 报告

当用户说"加个门户 / 商城 / 移动管理端 / 平台超管"：
1. 读当前 config
2. 判断要加哪个 app type
3. tripod add-app <type>
4. 告诉用户改了哪些文件 + 需要填哪些 env

当用户说"加 XXX 功能 / 改 XX adapter"：
同上，用 tripod add / remove / add-adapter / remove-adapter。
```

### Recipe 预置业务领域模型（preset-modules）

**预置业务模块 = 完整 gen:crud 产出**（prisma model + manifest + permissions + service + controller + dto + 基础测试）。新项目 `pnpm create tripod my-erp --recipe=erp-standard` 后，开箱即有仓储 + 销售业务骨架，项目组只需**在此基础上改 UI 和业务规则**。

#### erp-standard 预置模块清单

| 模块               | 核心表                                 | 默认状态                                                                                 | 关键权限点                                                            | 典型业务方法                                                                     |
| ------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **customer**       | Customer                               | active / inactive / blacklist                                                            | `customer:read-all` / `:read-own` / `:create` / `:update` / `:export` | create / update / activate / deactivate / blacklist                              |
| **sku**            | Sku（+ SkuAttribute JSON）             | active / discontinued                                                                    | `sku:read-all` / `:create` / `:update` / `:update-cost` / `:export`   | create / updatePrice / updateCost / discontinue                                  |
| **warehouse**      | Warehouse                              | active / inactive                                                                        | `warehouse:read-all` / `:manage`                                      | create / update / activate                                                       |
| **stock-location** | StockLocation（warehouse 下的货位）    | —                                                                                        | `stock-location:manage`                                               | create / move                                                                    |
| **inventory**      | Inventory（sku × stockLocation × qty） | —                                                                                        | `inventory:read-all` / `:adjust`                                      | getStock / adjust（盘点）                                                        |
| **stock-movement** | StockMovement（所有库存变动流水）      | pending / completed / cancelled                                                          | `stock-movement:read-all` / `:create` / `:cancel`                     | 出入库 / 调拨 / 盘盈盘亏（由其他模块调用）                                       |
| **supplier**       | Supplier                               | active / inactive                                                                        | `supplier:read-all` / `:manage`                                       | create / update                                                                  |
| **purchase-order** | PurchaseOrder + PurchaseOrderLine      | draft / submitted / approved / receiving / received / cancelled                          | `purchase-order:*` 10+ 权限                                           | submit / approve / receive / cancel（关联 stock-movement inbound）               |
| **sales-order**    | SalesOrder + SalesOrderLine            | draft / pending-approval / approved / picking / packed / shipped / completed / cancelled | `sales-order:*` 10+ 权限                                              | submit / approve / pick / pack / ship / complete（关联 stock-movement outbound） |
| **price-list**     | PriceList（tenant 级定价策略）         | active / archived                                                                        | `price-list:manage`                                                   | create / apply-to-customer                                                       |

每个模块都是 `gen:crud` 能产出的标准骨架 + 额外写的**跨模块串联逻辑**（比如 `sales-order.ship` 自动触发 `stock-movement.outbound`）。项目组改这些模块就是改业务细节，不用从零写框架代码。

#### erp-commerce 追加模块（消费者视角）

| 模块                 | 核心表                                           | 关键差异                                                                                                  |
| -------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **product**          | Product（面向 C 端展示）+ ProductSku（关联 SKU） | 对外名称 / 描述 / 主图 / 详情页富文本；SKU 是内部管理单位，Product 是客户看到的                           |
| **product-category** | ProductCategory（树形 + 排序）                   | —                                                                                                         |
| **cart**             | Cart + CartItem（guest / member 两态）           | 未登录 cookie-guest / 登录合并                                                                            |
| **customer-order**   | CustomerOrder + CustomerOrderLine                | 和 sales-order 区别：这是 C 端生成，需要支付 / 发货 / 评价；sales-order 是 B 端销售（内部员工帮客户下单） |
| **payment**          | Payment（订单 ↔ 支付记录）                       | 对接 PaymentProvider adapter（stripe / 支付宝 / 微信支付），状态 pending / success / failed / refunded    |
| **shipment**         | Shipment（订单 ↔ 物流记录）                      | 对接 ShippingProvider adapter（顺丰 / 中通 / Shippo）                                                     |
| **coupon**           | Coupon + CouponUsage                             | 百分比 / 满减 / 首单 / 限品类                                                                             |
| **review**           | ProductReview                                    | 订单完成后可评价                                                                                          |

#### 用户可自由改动的程度

**预置模块不是锁死的**。项目组拿到后可以：

- **改字段**：加业务字段（`Customer.industry` / `Sku.hsCode`） — 走正常 migration
- **改状态流**：改 state / transitions 的具体名字 — 跟着 manifest 同步改
- **改权限粒度**：加细粒度权限点（`sales-order:edit-discount`） — 加到 permissions.ts
- **改关联关系**：加新模块关联到已有模块 — 正常开发
- **删模块**：不需要的模块（比如没有 Purchase 业务）直接 `tripod remove-module purchase-order`（标脏 + rename disabled）

**预置模块 ≠ tripod 硬约束**。只是"行业常见骨架节省时间"。

#### 如何决定"哪些模块该预置"

判断标准：

1. **90% 仓储 + 销售 ERP 都需要的**（Customer / SKU / Warehouse / Inventory / Order）→ 预置
2. **跨行业差异大的**（HR / 财务科目 / 生产排程 / 质检）→ **不预置**（随 tripod demo 或 Tier 2）
3. **基础设施类**（feature flag / analytics / audit）→ shared-\* 基建，不是预置业务模块

`demos/` 目录留给 Tier 2 的行业示例：

- `demos/warehouse`（完整仓储 demo 含 WMS 细节）
- `demos/sales`（销售分成 / 返点示例）
- `demos/hr`（入离调转 + 考勤）
- `demos/manufacturing`（BOM + 工单）

用户 `pnpm tripod demo <name>` 按需拷贝到自己的项目。

### 包分发（@tripod-stack scope）

| 包                        | 作用                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `create-tripod`           | bootstrap 包（瘦跳板），`pnpm create tripod` 调用（`create-*` npm 约定）                                   |
| `@tripod-stack/cli`       | tripod CLI 本体（真正的脚手架 + 所有 tripod 命令实现）                                                     |
| `@tripod-stack/templates` | 所有 app 模板 + platform 后端模块模板 + migrations                                                         |
| `@tripod-stack/shared-*`  | 各 shared-\* 基建包（auth / permission / workflow / storage / notification / audit / i18n / logger / ...） |
| `@tripod-stack/adapter-*` | 所有 adapter 包                                                                                            |

发包：公共 npm（`npmjs.com`），`pnpm -r publish --access public`，Changesets 管版本 + Changelog。

#### `create-tripod` bootstrap 实现：瘦跳板模式

**不在 bootstrap 里复制脚手架逻辑**。`create-tripod` 只是一个引导层，把用户输入 forward 给真正的 CLI：

```ts
// create-tripod/src/index.ts（完整实现，就这么短）
#!/usr/bin/env node
import { execSync } from 'node:child_process';

const args = process.argv.slice(2).join(' ');
const cliVersion = process.env.TRIPOD_CLI_VERSION ?? 'latest';

execSync(
  `npx -y @tripod-stack/cli@${cliVersion} create ${args}`,
  { stdio: 'inherit' }
);
```

**package.json**：

```json
{
  "name": "create-tripod",
  "version": "1.5.3",
  "bin": "dist/index.js",
  "dependencies": {} // 零依赖！不 import @tripod-stack/cli，运行时 npx 临时拉
}
```

**好处**：

- 脚手架逻辑 **只在** `@tripod-stack/cli`，DRY
- bootstrap 几乎永远不用改；lockstep 发版时 re-publish 也是同样的跳板代码
- 用户 `pnpm create tripod my-app` 总是调到 `@tripod-stack/cli@latest`（等价于 lockstep 最新 tripod 版本）
- 高级用户可 `TRIPOD_CLI_VERSION=1.5.0 pnpm create tripod my-app` 指定老版本

**纳入 lockstep**：虽然代码几乎不变，`create-tripod` 仍纳入 Changesets `fixed` 组（见 §Changesets 模式），保持全家族版本号一致；实际 changeset 条目只在**命令签名变了**时才 bump（几乎从不发生），其他场景只跟随 lockstep re-publish。

**AI 维护提示**：

- 改 `@tripod-stack/cli` 的 `create` 命令签名时 → 同步改 bootstrap 里的 forward 参数解析 + 加 changeset
- 其他任何 CLI 改动都不用动 bootstrap

**企业私有化路径**：fork `@tripod-stack/templates` → `@mycorp/tripod-templates`（发到私有 npm registry / Verdaccio），在项目 `tripod.config.yaml` 设 `templates-package: "@mycorp/tripod-templates"` 切换。

#### 模板内部依赖写法：`workspace:*`

Tripod 主仓库内所有**模板代码**（`templates/apps/*/package.json` / `templates/modules/*/package.json`）引用 `@tripod-stack/*` 包时**统一写** `workspace:*`：

```json
// templates/apps/server/package.json
{
  "dependencies": {
    "@tripod-stack/shared-auth": "workspace:*",
    "@tripod-stack/shared-permission": "workspace:*",
    "@tripod-stack/shared-workflow": "workspace:*"
    // ...
  }
}
```

**开发时**：pnpm 识别 `workspace:*` 走本地 link，改 shared-auth 源码立即在模板里生效。

**`pnpm publish` 时**：pnpm **自动**把 `workspace:*` 替换为发布时的具体版本范围（`^x.y.z`），写入 npm 的最终 tarball。用户 `pnpm create tripod` 拿到的 `package.json` 已是：

```json
"@tripod-stack/shared-auth": "^1.5.3"   // pnpm publish 自动替换
```

**替换规则**（pnpm 原生支持）：

| 写法              | 替换后                                              |
| ----------------- | --------------------------------------------------- |
| `workspace:*`     | `^<当前版本>`（默认用 caret，宽松接受 patch/minor） |
| `workspace:~`     | `~<当前版本>`（仅接受 patch）                       |
| `workspace:^`     | `^<当前版本>`（显式 caret，等价 `workspace:*`）     |
| `workspace:1.5.3` | `1.5.3`（精确锁定）                                 |

**Tripod 默认用 `workspace:*`**，用户享受自动吃 patch / minor 修复；需要严格锁版本（shared-auth 1.x 和 2.x breaking 场景）时在对应模板写 `workspace:^`（或 Changesets 同步升 major）。

**配套强制**：

- `tripod doctor` 检查所有 templates/**/package.json 的 `@tripod-stack/*` 依赖必须是 `workspace:*` / `workspace:^` / `workspace:~`，**禁止\*\*硬编码 `"^1.5.0"` 字符串（会发版漂移）
- `tripod doctor` 检查 `dependencies` vs 实际 `import` 一致性（避免 import 了 shared-storage 但 package.json 漏写）

**用户项目（非 tripod 主仓）里不用 workspace 语法**：`pnpm create tripod my-app` 产出的新项目 `apps/server/package.json` 已是 `"^1.5.3"`，新项目自己不是 monorepo，直接从 npm 拉包。

**AI 维护注意**：

- 新增 shared-_ 包时，在所有用到它的模板 `package.json` 加 `"@tripod-stack/shared-xxx": "workspace:_"`；AI 不要手写版本号
- 删 shared-_ 包时，全 grep `workspace:_` 引用清理
- 手写的 `"^1.5.3"` 这种硬编码字符串触发 `tripod/templates-no-pinned-version` lint 报错

#### `pnpm-lock.yaml` 策略

**三层 lockfile 职责分明**：

##### 1. Tripod 主仓 lockfile（`pnpm-lock.yaml` at repo root）

- **入 git，必提交**
- 反映 monorepo 内部 workspace 链接 + 所有外部依赖的精确版本
- 开发者 clone 主仓后 `pnpm install --frozen-lockfile` 拿到和维护者一致的环境
- `pnpm changeset version` 会自动触发主仓 lockfile 更新（workspace 内部版本号变动），维护者 commit 入 git

##### 2. npm 发布的包 tarball（**不含** lockfile）

`pnpm publish` 默认**不**把 lockfile 打进 npm 包。符合 pnpm / npm 官方约定：

- **库包**（library，如 `@tripod-stack/shared-auth`）：不锁 lockfile，允许下游 app 在 semver 范围内选子依赖版本
- **app**（最终应用，用户的项目）：锁 lockfile，保证生产环境可复现

库包带 lockfile 会导致依赖冲突（下游一堆 `@tripod-stack/*` 各带不同 lockfile 起冲突）。

##### 3. 用户项目 lockfile（`pnpm create tripod` 产出）

- **`pnpm create tripod my-app` 的最后一步**：
  1. 跑 `pnpm install`（从 npm 真实拉包 + 解析子依赖）
  2. 产出 `pnpm-lock.yaml`
  3. `git init` + 首次 commit 把 `pnpm-lock.yaml` 一并提交

- **用户项目的 lockfile 入 git，必提交**（是 app，不是 library）
- 反映创建时 npm 上 `@tripod-stack/*` 一致 lockstep 版本的完整解析树

##### 配套约束

- `tripod doctor` 检查：用户项目跑 `pnpm install --frozen-lockfile` 必过（package.json 和 lockfile 一致）
- `tripod upgrade` 自动更新用户 lockfile（内部跑 `pnpm install`）
- 用户 lockfile 有漂移（手动改了 package.json 没跑 install）→ doctor warn
- **禁止**在发布包里塞 lockfile（`.npmignore` / `files` 白名单过滤）—— CI 检查 tarball 不含 `pnpm-lock.yaml`

### CLI 命令表

| 命令                                             | 作用                                                                                                            | 里程碑 |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------ |
| `pnpm create tripod <name>`                      | 脚手架（默认 minimal）                                                                                          | M1     |
| `pnpm create tripod <name> --recipe=<r>`         | 按 recipe 脚手架                                                                                                | M1     |
| `pnpm create tripod <name> --from-config=<file>` | 用既有 config 新建                                                                                              | M2     |
| `tripod status`                                  | 当前 config 摘要（apps / features / adapters / env 缺失项），人类可读                                           | M1     |
| `tripod snapshot --json`                         | ⭐ **AI 专用**：一次性输出全景 JSON（config + env + hot-spot + migration + git + unaligned），AI 会话开局首命令 | M1     |
| `tripod recipe list` / `recipe show <name>`      | 看可用 recipe                                                                                                   | M1     |
| `tripod list-apps`                               | 当前项目 app 清单 + 可装 app type                                                                               | M1     |
| `tripod validate [file]`                         | 校验 config.yaml 合法性（JSON Schema）                                                                          | M1     |
| `tripod add-app <type>`                          | 装 app：复制模板 + apply patches + 激活关联 feature                                                             | M2     |
| `tripod remove-app <type>`                       | 禁 app（保守：`apps/_disabled-<type>/`）                                                                        | M2     |
| `tripod add <feature>`                           | 启用 feature：从 disabled 恢复 or 从零装（跑 migration）                                                        | M2     |
| `tripod remove <feature>`                        | 禁 feature（保守：保留代码 + 注释 import）                                                                      | M2     |
| `tripod add-adapter <slot>=<name>`               | 装 adapter（写 package.json + 装 deps + 更新 config）                                                           | M2     |
| `tripod remove-adapter <slot>=<name>`            | 卸 adapter（真删，激进）                                                                                        | M2     |
| `tripod demo <name>` / `demo remove <name>`      | 生成 / 删独立 demo 参考                                                                                         | M2     |
| `tripod doctor`                                  | 深度体检（env + 标记完整性 + migrations + module 一致性 + `@tripod-stack/*` 版本一致性）                        | M2     |
| `tripod prune`                                   | 清理：disable 的 feature 下未 remove 的 adapter 建议列表                                                        | M2     |
| `tripod upgrade`                                 | ⭐ 把所有 `@tripod-stack/*` 依赖升到 latest lockstep 版本（含自动 doctor + smoke test）                         | M2     |
| `tripod upgrade --to <version>`                  | 升到指定版本                                                                                                    | M2     |
| `tripod upgrade --dry-run`                       | 预览会动哪些包                                                                                                  | M2     |
| `tripod release`                                 | ⭐ **维护者用**：smoke-test + changeset version + commit + tag + publish + push 全流程封装（交互式输 npm OTP）  | M2     |
| `tripod release --dry-run`                       | 只跑前面的检查 + dry-run publish，不真发                                                                        | M2     |
| `tripod release --registry=<url>`                | 发到私有 registry（企业 fork 场景）                                                                             | M2     |
| `tripod smoke-test`                              | 每个 recipe 跑 create + build + 最小运行验证（见 §smoke-test）                                                  | M2     |
| `tripod platform:seed`                           | 创建初始 platform admin 账号（随 add-app platform 提供）                                                        | M2+    |
| `tripod repair <file>`                           | AI 辅助找回 hot-spot 文件的 magic comment 标记                                                                  | Tier 2 |
| `tripod platform:enroll-mfa`                     | 给 platform admin 绑 TOTP（可选开启后用）                                                                       | Tier 2 |
| `tripod sync`                                    | 从上游模板拉新定义，merge 不覆盖                                                                                | Tier 2 |
| `tripod sync --skills-only`                      | 只同步 `.claude/skills/`（不碰 apps / packages / config）                                                       | Tier 2 |

### 行为规则

**`pnpm create tripod <name>` 执行顺序**（M1 关键）：

1. 创建目标目录 `<name>/`
2. 解析 recipe，确定要拷的 apps / packages / adapters
3. 按 recipe 从模板拷目录（过 patch 引擎处理 pnpm-workspace / turbo / compose / nginx / CI matrix）
4. **把模板根的 `.claude/` 原样整块拷贝**到新项目根（不经过 patch 引擎 —— skill 是 AI 协议资产，不是业务代码）
5. **拷贝 `docs/specs/` 空目录 + `docs/specs/README.md`**（登记 spec 命名与归档约定）
6. 跑 `pnpm install`
7. 跑 `tripod validate` / `tripod snapshot --json` 确认状态正常

`.claude/skills/` 下发后归属**新项目自有**。升级跟 `@tripod-stack/templates` 版本：想回收上游更新 → `tripod sync --skills-only`（Tier 2），用户手动触发。

**`tripod doctor` env 检查规则**：

- 只检查**当前 config.yaml 里选中的 adapter** 的 `env-required`
- `storage.backend: local` → 只检查 `STORAGE_ROOT`；**不**报 AWS\_\* 缺失
- `storage.backend: s3` → 检查 AWS\_\*；不报 `STORAGE_ROOT`
- 同时检查：disabled feature 的 module 是否真的没被 import、prisma schema 是否和当前 features 匹配、hot-spot 文件的 magic comment 标记是否完整

**`depends-on` 级联策略**：报错而非自动级联。

```
$ tripod remove auth
❌ 无法 remove auth：以下 feature 依赖它
   - permission （depends-on: [auth]）
   - audit      （depends-on: [auth, logger]）
请先 remove 下游，或用 --cascade 级联（谨慎）
```

`--cascade` 为逃生口，默认禁止。

### `tripod snapshot --json`（AI 全景入口）

AI 会话开局首命令。一次输出 JSON，覆盖 AI 做任何决策前需要的全部信息。**不要**拼凑 `status + doctor + validate + env:validate` 四个命令的 stdout——那是给人看的格式。

**输出 schema**：

```jsonc
{
  "tripodVersion": "0.1.0",
  "timestamp": "2026-04-22T10:00:00Z",

  "git": {
    "branch": "main",
    "commit": "abc1234",
    "dirty": false,
    "ahead": 0,
    "behind": 0,
  },

  "config": {
    "recipe": "erp-standard", // config.yaml 里的 generatedFrom
    "apps": ["server", "admin-web"],
    "disabledApps": [{ "type": "platform", "at": "2026-05-01", "reason": "暂停分公司管理" }],
    "features": ["auth", "permission", "i18n", "logger", "storage", "notification", "audit"],
    "disabledFeatures": [
      { "name": "workflow", "at": "2026-04-21", "reason": "单人项目暂不需要审批流" },
    ],
    "adapters": {
      "auth.credential": ["email-password"],
      "auth.recovery": "email-link",
      "storage.backend": "s3",
      "notification.email": "smtp",
      "notification.realtime": "sse",
    },
  },

  "env": {
    "source": "packages/shared-config/src/env.ts", // Zod schema 文件
    "file": "secrets/.env.prod", // 校验对象
    "present": true, // 文件是否存在
    "valid": false, // Zod parse 结果
    "missing": ["AWS_REGION", "AWS_BUCKET"], // required 但缺失
    "invalid": [
      // required 存在但不通过
      { "key": "JWT_SECRET", "reason": "字符串长度不足 32" },
    ],
    "warnings": [
      // env:doctor 的非阻断警告
      { "key": "DATABASE_URL", "reason": "值包含 localhost，NODE_ENV=production 下可疑" },
    ],
    "optionalUnset": ["SMTP_HOST", "GLITCHTIP_DSN"], // optional 且未设置
  },

  "hotSpots": {
    // 每个 hot-spot 文件 + magic comment 对的完整性
    "apps/server/src/app.module.ts": {
      "exists": true,
      "markers": {
        "tripod:imports": { "startLine": 5, "endLine": 6, "ok": true },
        "tripod:module-imports": { "startLine": 14, "endLine": 15, "ok": true },
      },
      "ok": true,
    },
    "prisma/seed.ts": {
      "exists": true,
      "markers": {
        "tripod:seed-calls": { "ok": false, "reason": "标记缺失或被删除" },
      },
      "ok": false,
    },
    "packages/shared-config/src/env.schema.ts": {
      "ok": true,
      "markers": { "tripod:env-fields": { "ok": true } },
    },
    "packages/shared-auth/src/strategies/index.ts": {
      "ok": true,
      "markers": { "tripod:credential-providers": { "ok": true } },
    },
  },

  "prisma": {
    "schemaPath": "apps/server/prisma/schema.prisma",
    "migrationsDir": "apps/server/prisma/migrations",
    "pendingMigrations": [], // 未 apply 的 migration
    "driftDetected": false, // prisma migrate status 有无 drift
    "lastMigration": { "name": "20260420_add_audit_log", "appliedAt": "2026-04-20T03:00:00Z" },
  },

  "modules": [
    // 所有业务模块（apps/server/src/<resource>/）
    {
      "resource": "sales-order",
      "path": "apps/server/src/sales-order",
      "hasManifest": true,
      "manifestConsistent": true, // manifest.ts 里声明的 states 与 service 代码里出现的 state 字符串一致
      "states": [
        "draft",
        "pending-approval",
        "approved",
        "picking",
        "packed",
        "shipped",
        "completed",
      ],
      "permissions": 7, // permissions.ts 里节点数
      "auditActions": 5, // manifest.audits 数量
    },
    {
      "resource": "customer",
      "hasManifest": false,
      "ok": false,
      "reason": "缺 customer.manifest.ts，AI 无法可靠解析此模块",
    },
  ],

  "unaligned": [
    // 关键不一致（AI 需要先解决再做其他）
    {
      "severity": "error",
      "type": "hotspot-missing",
      "detail": "prisma/seed.ts 缺 tripod:seed-calls 标记",
    },
    { "severity": "error", "type": "env-invalid", "detail": "secrets/.env.prod 缺 AWS_REGION" },
    {
      "severity": "warn",
      "type": "disabled-feature-still-imported",
      "detail": "shared-workflow disabled 但 app.module.ts 仍 import SharedWorkflowModule",
    },
    {
      "severity": "warn",
      "type": "adapter-env-missing",
      "detail": "adapter storage-s3 装了但 AWS_BUCKET 未设置",
    },
    { "severity": "warn", "type": "module-no-manifest", "detail": "customer 模块无 manifest.ts" },
  ],

  "nextActions": [
    // snapshot 给出的推荐下一步（AI 不必照做，仅参考）
    "跑 tripod repair prisma/seed.ts 恢复标记",
    "补 secrets/.env.prod 的 AWS_REGION / AWS_BUCKET",
    "生成 apps/server/src/customer/customer.manifest.ts",
  ],
}
```

**实现要点**：

- 零网络请求、零 DB 查询，纯本地文件 + git CLI。响应 <500ms
- `unaligned` 排序：error 在前，warn 在后
- `nextActions` 条数 ≤5，只给"最关键的下一步"，不是完整 TODO
- `modules[*].manifestConsistent` 对比：grep `'<state>'` 字符串出现集合 vs manifest.states 声明集合
- 不输出敏感值：`env` 段只给 key 名 / 缺失 / 校验错误，**永不输出**实际值
- `--json` 是默认输出。`tripod snapshot`（无 flag）输出人类可读的摘要版本（供人偶尔直接看）

**AI 使用规则**：

- 每次 tripod 项目会话**第一个** tool call 是 `tripod snapshot --json`
- 读到 `unaligned[].severity === 'error'` 时：先解决不一致再继续用户任务
- 读到 `modules[*].hasManifest === false` 且用户任务涉及该模块：先补 manifest 再动手
- 缓存 snapshot 结果：同一会话内文件无改动则不重跑。有改动后重跑以刷新

### 代码改动三层防御

`tripod add-app <type>` / `add <feature>` / `add-adapter` 会编辑项目里少数几个 hot-spot 文件（`apps/server/src/app.module.ts` / `prisma/seed.ts` / `packages/shared-config/env.schema.ts` 等）。为了不破坏用户手改的代码，三层防御：

#### 第一层：Magic Comment 标记（默认，覆盖 ≥ 95% 场景）

模板骨架自带标记，CLI 只修改**标记之间**的内容。用户在标记外任意编辑都不受影响。

```ts
// apps/server/src/app.module.ts
import { Module } from '@nestjs/common';
import { SharedAuthModule } from '@tripod-stack/shared-auth';
// tripod:imports-start
// tripod:imports-end
import { MyBusinessModule } from './my-business/my-business.module'; // ← 用户代码

@Module({
  imports: [
    SharedAuthModule,
    // tripod:module-imports-start
    // tripod:module-imports-end
    MyBusinessModule, // ← 用户代码
  ],
})
export class AppModule {}
```

```ts
// prisma/seed.ts
async function main() {
  await seedDefaultTenant();
  await seedInitialTenantAdmin();
  // tripod:seed-calls-start
  // tripod:seed-calls-end
  await seedMyBusinessData(); // ← 用户代码
}
```

```ts
// packages/shared-config/env.schema.ts
export const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'prod']),
  DATABASE_URL: z.string(),
  // tripod:env-fields-start
  // tripod:env-fields-end
  MY_CUSTOM_ENV: z.string().optional(), // ← 用户代码
});
```

**Hot-spot 文件清单**（CLI 唯一会动的 TS 文件）：

| 文件                                           | 标记                                       | 触发命令                          |
| ---------------------------------------------- | ------------------------------------------ | --------------------------------- |
| `apps/server/src/app.module.ts`                | `tripod:imports` + `tripod:module-imports` | `add-app` / `add`                 |
| `prisma/seed.ts`                               | `tripod:seed-calls`                        | `add-app` / `add`                 |
| `packages/shared-config/env.schema.ts`         | `tripod:env-fields`                        | `add-app` / `add` / `add-adapter` |
| `packages/shared-auth/src/strategies/index.ts` | `tripod:credential-providers`              | `add-adapter auth.credential=*`   |

其他所有 TS 文件（业务 module / controller / service / router / 中间件 / prisma model）**CLI 永不触碰**。

#### 第二层：Doctor 预检（检测标记完整性）

`tripod add-app` / `tripod add` 前自动跑：

```bash
tripod add-app platform
→ [pre-check] 验证 hot-spot 标记...
  ✅ apps/server/src/app.module.ts   (imports + module-imports 标记完整)
  ❌ prisma/seed.ts                   (seed-calls 标记缺失)

⚠️ prisma/seed.ts 的 tripod:seed-calls 标记被删除（或文件被重构过）

    解决方式（三选一）：
    1) tripod repair prisma/seed.ts        # AI 协助找回（Tier 2）
    2) 手动加回 // tripod:seed-calls-start / -end 一对注释
    3) 按 docs/manual-patches/add-platform.md 手工接入

    修复后重跑 tripod add-app platform
```

CLI 检测到不安全直接拒绝硬写，不会覆盖用户代码。

#### 第三层：AI 辅助合并（Tier 2）

```bash
tripod repair prisma/seed.ts
→ 生成待办补丁：.tripod/pending-patches/add-platform.patch
→ 在 Claude Code 会话里："把 .tripod/pending-patches/add-platform.patch 合并到当前 seed.ts，保持我的代码结构"
→ AI 合并 → diff 给你看 → 你确认
```

AI 当智能合并工，比机械 patch 鲁棒得多，天然契合"AI 起草 → 用户确认 → CLI 执行"协作模型。

### 验证场景

#### 场景 A：ERP 去 workflow、换 S3

```bash
pnpm create tripod my-erp --recipe=erp-standard
cd my-erp

# Claude Code 里说 "我不用审批流，存储换 S3"
# AI 生成 diff → 用户确认 → AI 执行：
tripod remove workflow
tripod remove-adapter storage.backend=local
tripod add-adapter storage.backend=s3

tripod doctor
#   ❌ .env 缺 AWS_REGION / AWS_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
#   ✅ shared-workflow disabled 且代码保留
#   ✅ AppModule 里 SharedWorkflowModule import 已注释
#   ✅ prisma schema 与 features 一致

# 填 AWS 到 .env → doctor 全绿 → pnpm dev

# 半年后想开审批流：
tripod add workflow       # 秒恢复，无损
```

#### 场景 B：电力 ERP → 后期加 portal → 后期加分公司管理

```bash
# 初始：最小管理后台（场景 2）
pnpm create tripod electric-erp --recipe=erp-standard
# apps/ = server + admin-web
cd electric-erp && pnpm dev

# 半年后要做官网
tripod add-app portal
# → 复制 @tripod-stack/templates/apps/portal → apps/portal/
# → patch pnpm-workspace / turbo / docker-compose / nginx / CI
# → apps/server/src/app.module.ts 加 PortalPublicModule（走标记）
# → .env.example 追加 PORTAL_URL

# 又过半年要开分公司管理（总部 + 3 个分公司独立数据域）
tripod add-app platform
# → 复制 templates/apps/platform → apps/platform/
# → 激活 platform-admin feature（后端模块从 templates/modules/platform/ → apps/server/src/platform/）
# → AppModule 加 SharedPlatformModule（走标记）
# → 跑 platform 专用 migration（platform_role / platform_permission 表）
# → 现有业务数据继续在 default-tenant，不迁移

tripod platform:seed --email=hq@mycorp.com --password-stdin
# → 创建总部超管账号，纯密码登录
# → 登录 platform.example.com 开始建分公司 tenant
```

#### 场景 C：仓储 + 商城起步 → 后期加现场管理移动端

```bash
pnpm create tripod warehouse-mall --recipe=erp-commerce
# apps/ = server + admin-web + portal + mall-web + mall-mobile

# 一年后仓库现场要用手机扫码收货
tripod add-app admin-mobile
# → 复制 templates/apps/admin-mobile → apps/admin-mobile/
# → 自动装 expo-barcode-scanner 等依赖
# → patch EAS 配置 + CI matrix
# → AppModule 无需改动（admin-mobile 消费已有 API）
```

### 里程碑

- **M1 落地**：
  - `tripod.manifest.yaml` 解析 + JSON Schema
  - `pnpm create tripod` + `tripod status` / `recipe list` / `recipe show` / `list-apps` / `validate`
  - 3 个初始 recipe（`minimal` / `erp-standard` / `erp-commerce`）
  - 根目录 `CLAUDE.md` 模板骨架（AI interview 指令）
  - Magic Comment 标记规范 + 所有 hot-spot 文件模板里预置标记
  - **`.claude/skills/` 分发**：`spec-driven-testing` + `graph-code-analysis` 随模板原样拷到新项目根，不走 patch 引擎
  - `docs/specs/` 空目录 + README 登记 spec 命名约定
- **M2 落地**：
  - `tripod.app.yaml` patch 引擎 + app 层命令（`add-app` / `remove-app`）
  - feature / adapter 层命令（`add` / `remove` / `add-adapter` / `remove-adapter`）
  - `tripod doctor`（含 env + 标记 + migration + module 一致性预检 + 每 `apps/server/src/<resource>/` 对应 `docs/specs/<resource>.md` 警告）
  - `tripod prune` + demo 命令
  - 完整 JSON Schema 校验
  - `tripod platform:seed` 随 add-app platform 提供
  - `shared-test` 的 `createTestTenant` fixture 落地（给 spec-driven-testing Step 3 三层测试用）
  - Playwright 基础配置 + docker-compose `test` profile 预置
- **Tier 2**：
  - `tripod repair`（AI 辅助找回标记）
  - `tripod sync`（上游能力回流）+ `tripod sync --skills-only`（只同步 `.claude/skills/`）
  - `tripod platform:enroll-mfa`（可选 MFA 开启）

---

## 开发体验 / 本地环境启动（M2 核心）

### 目标

**新项目 clone → 5 分钟能点到第一个页面**。"开箱即用"是 tripod 基建的主要承诺之一。

### 一条命令起全栈

```bash
pnpm create tripod my-erp --recipe=erp-standard
cd my-erp
pnpm dev
# ↑ 这一条命令内部做所有事
```

`pnpm dev` 内部（`package.json` root scripts）：

```json
{
  "scripts": {
    "dev": "tripod dev",
    "dev:fresh": "tripod dev --fresh" // 重置 DB + reseed demo
  }
}
```

`tripod dev` 实现（`apps/cli/src/commands/dev.ts`）：

```
1. 检查 Docker Desktop 在跑；否则提示用户启动
2. 启动 docker compose（pg + redis，可选 mailhog/minio/glitchtip），等健康 ✓
3. 检查 Prisma 迁移状态；有 pending → auto apply（dev 环境）
4. 检查 demo tenant 是否 seed；否则 `prisma db seed`
5. turbo run dev --parallel --filter=... （按装了哪些 app 动态 filter）
6. 所有服务健康后，terminal 打印：
   ✓ API:        http://localhost:3000 (Swagger: /docs)
   ✓ Admin Web:  http://localhost:5173
   ✓ Platform:   http://localhost:5174
   ✓ Portal:     http://localhost:3001
   ✓ Mailhog:    http://localhost:8025 (测试邮件)
   ✓ MinIO:      http://localhost:9001 (文件存储)
   ✓ GlitchTip:  http://localhost:8088 (错误上报)

   Demo 账号：
     admin@demo.local / demo1234  (tenant: demo-company)
     platform@tripod.local / platform1234 (platform 超管)
```

### dev 环境访问方式（无 HTTPS，端口直连）

**不做本地 HTTPS / mkcert / 反代**。HTTPS 证书和对外反代是**运维层职责**，不是 tripod 基建范围；dev 走 HTTP + 端口直连即可：

```
http://localhost:3000     api          (NestJS server)
http://localhost:5173     admin-web    (Vite)
http://localhost:5174     platform     (Vite)
http://localhost:3001     portal       (Next.js)
http://localhost:8025     mailhog web  (查测试邮件)
http://localhost:9001     minio web    (查本地 S3 文件)
http://localhost:8088     glitchtip    (查错误上报)
```

**多租户在 dev 环境的切换方式**（不靠子域）：

- 登录后 `Tenant` 在 JWT claim 里，前端切换走 "切换租户" 下拉；不依赖子域
- admin-web 开发时走 URL query `?tenant=demo-company` 或 cookie `x-tenant-slug`；`TenantResolver` 优先级已支持 `FromHeader` / `FromCookie`（§多租户架构里已定）
- 生产真实场景（`admin.tenant-a.example.com` 子域路由）由**运维层反代**识别 Host header 后塞给后端，server 只读 header/cookie / JWT，不关心前面的域

**如果业务必须**在本地测试 OAuth redirect / Service Worker 等要 HTTPS 的场景，由开发者自己装 mkcert + 配本地反代；tripod 不提供模板。

### Demo tenant seed（让 dev 5 分钟能点）

`prisma/seed.ts` 预置（随 `erp-standard` recipe）：

```ts
// prisma/seed.ts
await prisma.tenant.upsert({
  where: { slug: 'demo-company' },
  create: {
    slug: 'demo-company',
    name: 'Demo Company Co., Ltd.',
    timezone: 'Asia/Shanghai',
    locale: 'zh-CN',
    featureFlags: { newApprovalFlow: true },
    status: 'active',
  },
  update: {},
});

// 2 个用户：tenant admin + 普通员工
await seedUser({
  email: 'admin@demo.local',
  password: 'demo1234',
  role: 'tenant-admin',
  tenantSlug: 'demo-company',
});
await seedUser({
  email: 'staff@demo.local',
  password: 'demo1234',
  role: 'employee',
  tenantSlug: 'demo-company',
});

// 1 个 platform 超管
await seedUser({
  email: 'platform@tripod.local',
  password: 'platform1234',
  role: 'platform-admin',
});

// recipe=erp-standard 的 demo 数据
await seedSKUs(5); // 5 个 SKU
await seedCustomers(3); // 3 个客户
await seedWarehouses(2); // 2 个仓库
await seedInventory(); // 库存初始化
await seedOrders(10); // 10 个订单（不同状态覆盖）
```

seed 代码分模块放在 `prisma/seed/*.ts`，recipe 决定包哪些：

- `minimal`: 只 tenant + 2 user
- `erp-standard`: + SKU / Customer / Warehouse / Inventory / SalesOrder
- `erp-commerce`: erp-standard + Product / Category / Cart / Order

**tenant 级 opt-in**：生产环境 seed 的是 migration 数据（角色模板、字典），demo 数据只在 `NODE_ENV=development` 跑。

### docker-compose dev 服务清单

```yaml
# infra/compose/docker-compose.yml (M2 dev 模板)
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: tripod
      POSTGRES_PASSWORD: tripod
      POSTGRES_DB: tripod_dev
    healthcheck: ...

  redis:
    image: redis:8-alpine
    healthcheck: ...

  mailhog: # 本地 SMTP + web UI（测试邮件通知）
    image: mailhog/mailhog:latest
    ports: ['8025:8025']

  minio: # 本地 S3 兼容（测试 storage-s3 adapter）
    image: minio/minio:latest
    ports: ['9001:9001']
    environment:
      MINIO_ROOT_USER: tripod
      MINIO_ROOT_PASSWORD: tripod123

  glitchtip: # 错误上报本地起
    image: glitchtip/glitchtip:latest
    depends_on: [postgres, redis]
    ports: ['8088:8000']
```

`tripod dev` 起的时候 profile 可选：

- `pnpm dev` = minimal profile（pg + redis）
- `pnpm dev --profile=full` = all（+ mailhog + minio + glitchtip，测通知/存储/错误上报走真实链路）

### `.claude/skills/dev-startup` skill

```
.claude/skills/dev-startup/
├── SKILL.md                       # AI 如何引导用户起环境
└── troubleshoot.md                # 常见问题排查（端口冲突、证书失效等）
```

SKILL.md 简化内容：

```
当用户说"起项目 / 跑不起来 / dev 挂了"时：
1. 先确认是否跑过 pnpm install
2. 跑 tripod doctor 看 hot-spot / env / migration 是否 ok
3. 检查 docker ps 看依赖是否健康
4. 看 terminal 里 pnpm dev 最后几行错误
5. 对照 troubleshoot.md 的症状表

troubleshoot.md 症状表：
| 症状 | 原因 | 修复 |
| "EADDRINUSE :3000" | 上次进程没关 | lsof -i:3000 + kill |
| DB 连不上 | postgres 容器没起 | docker compose up -d postgres |
| Prisma "Drift detected" | dev 和 migration 不同步 | prisma migrate reset（dev 才可以！）|
| Redis 连不上 | redis 容器没起 | docker compose up -d redis |
```

### CLI 命令补充

新增：

```
pnpm tripod dev                         # M2：一条命令起全栈
pnpm tripod dev --fresh                 # M2：重置 DB + reseed demo
pnpm tripod dev --profile=minimal|full  # M2：profile 选择（min=pg+redis / full=+mailhog+minio+glitchtip）
pnpm tripod demo:reset                  # M2：只重置 demo 数据，不碰 schema
```

### 里程碑

- **M2**：tripod dev 实现 + mailhog/minio/glitchtip compose + demo seed + dev-startup skill
- **M3+**：macOS/Win/Linux 跨平台边界 case 打磨

### AI 读解路径（dev 启动）

- 用户说"跑不起来"：先 `tripod doctor` + `docker ps` + 看最新 `pnpm dev` 错误；对照 dev-startup skill troubleshoot
- 用户说"端口冲突"：`lsof -i:<port>` 查占用，不主动 kill，提示用户
- 用户说"要本地 HTTPS / OAuth 回调"：提示"tripod 不管 HTTPS，你自己配 mkcert + 反代"

---

## 7 种 App 模板完整交付清单

本章按 §模板交付总原则 的三条原则，给出 7 种 app 模板**各自的开箱即用清单**。共同原则在前，各 app 独立清单在后（按从简到繁：server / admin-web / platform / admin-mobile / portal / mall-web / mall-mobile）。

### 共同原则（所有 7 种 app）

| 维度             | 所有 app 都有                                                                         |
| ---------------- | ------------------------------------------------------------------------------------- |
| **鉴权 / 权限**  | 登录 / refresh / 401 拦截 / 权限守卫（来自 shared-auth + shared-permission）          |
| **API 调用**     | axios + 拦截器 + 错误处理 + traceId（shared-api-client）                              |
| **错误处理**     | 400 toast / 401 跳登录 / 403 无权限页 / 404 / 5xx 带 traceId                          |
| **i18n**         | 4 语言切换 + 错误码自动翻译（shared-i18n）                                            |
| **埋点**         | `analytics.track` 自动页面 / 点击（shared-analytics，默认 null impl）                 |
| **Feature flag** | `useFeatureFlag` hook + `<Flag>` 组件（shared-feature-flag）                          |
| **主题**         | light / dark + tenant 色板占位（shared-theme）                                        |
| **测试**         | Unit（Vitest / jest-expo）+ API / UI 测试骨架（Playwright / 砍 Detox）                |
| **文档配对**     | `docs/templates/<type>/{README, components, pages, customization, testing}.md` 五件套 |
| **换 UI 库支持** | `/swap-ui-library` skill（web 三栈 / mobile 三栈互换）                                |

### 1. server（NestJS 后端）

**定位**：无 UI，"开箱"= shared-\* 全装 + 13 内置 module + 25-30 endpoint + 基础业务 manifest + 测试全绿。

**技术栈**：NestJS + Prisma 5（`prismaSchemaFolder`）+ Postgres + Redis + BullMQ + @nestjs/swagger。

**13 个内置 Module**：AuthModule / UserModule / TenantModule / MembershipModule / NotificationModule / AuditModule / StorageModule / HealthModule / PermissionModule / I18nModule / FeatureFlagModule / AnalyticsModule / PlatformModule（只在装 platform app 时激活）。

**25-30 个 HTTP 接口**：见 §Server 接口清单（位于本章节末）。

**Prisma schema 预置**：Tenant / User / Membership / Role / Permission / RolePermission / TenantInvitation / NotificationType / Notification / NotificationReadReceipt / BusinessAuditLog / FileRecord / UserDevice / PlatformAdmin（platform app 激活时）。

**测试覆盖（Y 中等）**：Unit Vitest / API Playwright / 多租户 fixture / 专项（idempotency / 分页超限 / API 版本 / 软删 / 权限 403）。

**Seed**：Migration seed（默认 tenant / 5 角色模板 / 20 基础权限 / 通知模板 / 4 语言）+ Demo seed（`erp-standard`: 5 SKU / 3 Customer / 2 Warehouse / 10 Order；`pnpm tripod demo:grow` 可扩到 50+20+3+100）。

**文件结构**：见 §Server 文件结构（本章节末）。

### 2. admin-web（租户管理后台）

**定位**：Tenant Admin / 员工登录，管本 tenant 业务。

**技术栈**：React 19 + Vite + **AntD 5**（默认，可换）+ Tailwind + shared-web-ui + shared-auth + ...

**14 项开箱即用功能**：

| 功能                                                        | 说明                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 登录 / 两阶段（多 tenant 选） / logout / 401 拦截 / refresh | 4 种登录方式（email-password / email-otp / magic-link / username-password）按 config 渲染 |
| 账号管理                                                    | 用户 CRUD / 改密 / 禁用                                                                   |
| 邀请                                                        | 邮箱 token 链接 / 接受 / 撤销                                                             |
| 角色 / 权限管理                                             | 角色 CRUD / 权限点分配 / 预置 5 模板                                                      |
| 通知中心                                                    | SSE 实时接收 / 列表 / 未读徽标 / 标记已读                                                 |
| 权限守卫                                                    | 菜单按 PAGE 过滤 / `<Gate>` 按钮 / `<RouteGuard>` / 403 页                                |
| API client                                                  | axios + 拦截器 + 自动 traceId + 错误码翻译 toast                                          |
| 错误处理                                                    | 400/401/403/404/5xx 全自动                                                                |
| 多语言                                                      | 4 语言切换（zh-CN / en-US / zh-TW / ja-JP）                                               |
| 埋点                                                        | analytics.track 自动 page / click 埋点                                                    |
| Feature flag                                                | `<Flag>` / `useFeatureFlag`                                                               |
| 主题                                                        | light / dark 切换 + tenant 色板                                                           |
| 文件上传 / 下载                                             | ≤100MB 单次，带进度                                                                       |
| Idempotency                                                 | 写操作自动带 Idempotency-Key                                                              |

**11 个必带页面**：

- `/login` / `/select-tenant` / `/dashboard`
- `/profile` / `/settings/users` / `/settings/invitations` / `/settings/roles`
- `/notifications` / `/settings/tenant`（时区 / 语言配置）
- `/403` / `/404` / `/500`

业务模块页面（订单 / 客户 / 库存）**不带**，由 `gen:crud` 按需产出。

**换 UI 库**：默认 AntD 5；用户说"换 shadcn / MUI / Arco" → 跑 `/swap-ui-library` skill。

**测试（Y 中等）**：Unit（hook / util / 业务组件）+ UI E2E 三条路径（登录成功 → dashboard / 401 → 跳登录 / 403 → 显示无权限）。

### 3. platform（超管 / SaaS 控制台）

**定位**：Platform Admin 独立登录，跨租户管理。

**技术栈**：React 19 + Vite + **AntD 5**（同 admin-web）+ 同栈复用 shared-web-ui。

**15 个必带页面**：

```
/platform/login                           # 独立登录（不选 tenant）
/platform/dashboard                       # 全租户概览
/platform/tenants                         # 租户列表
/platform/tenants/new                     # 新建租户 + 发邀请
/platform/tenants/batch                   # CSV 批量建
/platform/tenants/:id                     # 单租户详情
/platform/tenants/:id/impersonate         # 介入租户（double audit）
/platform/quotas                          # 配额管理
/platform/feature-flags                   # flag × tenant 矩阵 + kill-switch
/platform/admins                          # Platform admin 账户管理
/platform/audit-logs                      # 跨租户审计
/platform/search                          # 跨租户搜索（$unscoped 合法入口）
/platform/health                          # 所有 tenant 健康巡检
/platform/profile                         # 个人 + MFA 绑定（M6 激活）
/403 / 404 / 500
```

**Platform 特有功能**：

- 独立鉴权流（`PlatformAdmin` 表 / JWT 含 `system: true` + `platformRole`）
- 跨租户调用（`X-Platform-Admin: true` header + `$unscoped`）
- Impersonate（短期 token + double audit）
- Kill-switch（dashboard 顶部紧急按钮）

**不进默认 recipe**：单公司场景不需要，按需 `tripod add-app platform` 加。

**测试**：Platform admin 登录 / tenant CRUD / impersonate double audit / 跨租户搜索 / PlatformAdmin vs User token 隔离安全测试。

### 4. admin-mobile（租户管理移动端）

**定位**：现场扫码 / 经理审批 / 出差速查。Tenant Admin JWT（同 admin-web）。

**技术栈**：Expo SDK 52+ + RN + NativeWind + **Gluestack UI v2**（默认，可换）+ shared-mobile-ui + shared-auth + ...

**9 个必带屏幕**：`Login` / `SelectTenant` / `Home`（通知 bell + 扫码 FAB）/ `Scanner` / `Notifications` / `Profile` / `Settings/About` / `PushPermission` / `403/404/Offline`。

**原生能力**：扫码（`expo-barcode-scanner`）/ 相机 / 推送（PushProvider 接口 M2，fcm/apns 实现 M5）/ 深链（DeepLinkResolver）/ SecureStore / 生物识别（M5）。

**离线**：TanStack Query persist 到 AsyncStorage；下单 / 写操作必须在线；完整离线 Tier 2。

**测试**：Unit（jest-expo + @testing-library/react-native）；Detox E2E 砍（手动 + EAS Build preview 真机测）。

**构建**：M2 默认 EAS Build 免费 30/月；Tier 2 `infra/mobile-selfhost/`。

### 5. portal（门户 / 官网 / 文档站）

**定位**：公开访问为主（游客）+ 客户登录后自服务。

**技术栈**：Next.js 15 + App Router + React 19 + **shadcn/ui**（不是 AntD —— Portal 设计更自由）+ Tailwind + shared-web-ui 逻辑层 + @next/mdx。

**7 个核心必带页面**：`/` / `/contact` / `/login` / `/customer/orders` / `/customer/invoices` / `/docs/[...slug]` / `/404 /500`。

**4 个可选按 flag 开启**：`/products` / `/pricing` / `/blog` / `/blog/[slug]`。

**Portal 特有功能**：

- SEO 工具（`<SEO>` + JSON-LD + sitemap + robots.txt + canonical）
- MDX 文档（`@next/mdx` + gray-matter + code highlight）
- 多语言路由（Next.js 15 i18n routing，`/[locale]/*`）
- Shopper 登录（`User.userType = 'SHOPPER'`，和 tenant admin 独立体系）
- SSG / ISR 策略（首页 / 产品页 SSG，blog ISR 60s）

**测试**：SEO 元数据正确 / MDX 渲染 / 客户登录流 / SSG build 过。

### 6. mall-web（商城 C 端）

**定位**：Shopper 浏览 / 购物 / 下单 / 支付 / 订单 / 评价。

**技术栈**：Next.js 15 + App Router + React 19 + **shadcn/ui**（同 portal）+ shared-cart + shared-payment + shared-promotion + shared-shipping。

**13 核心必带 + 4 可选页**：

- 核心：`/` / `/products` / `/products/[slug]` / `/category/[slug]` / `/search` / `/cart` / `/checkout` / `/checkout/payment` / `/checkout/success` / `/orders` / `/orders/[id]` / `/account` / `/login /register /403 /404 /500`
- 可选（flag 开）：`/orders/[id]/review` / `/coupons` / `/favorites` / `/blog`

**Mall 特有功能**：

- **购物车合并**：guest cookie → user 登录后自动合并（shared-cart）
- **库存预占**：加购不占 / 下单预占 15min / 支付成功锁定 / 超时 CRON 释放
- **订单状态机**：draft → payment-pending → paid → picking → packed → shipped → delivered → completed（+ cancelled / refund-requested / refunded）
- **支付 adapter**：PaymentProvider 接口 + `payment-mock` M2 默认 / Stripe / 支付宝 / 微信支付 Tier 2
- **搜索**：M2 Postgres 全文检索（≤ 10 万 SKU 够用）；Tier 2 ES / Meilisearch / Algolia
- **SEO**：Product JSON-LD / sitemap 含所有商品 / canonical URL / 多语言路由
- **Shopper 鉴权**：同 portal Shopper 体系

**测试**：Unit（购物车合并 / 订单状态机 / 支付 mock）/ API（加购 / 下单 / 支付回调 / 退款 / 并发下单乐观锁）/ UI E2E（游客加购 / 登录合并 / 直接登录下单 三条路径）。

### 7. mall-mobile（商城移动 C 端）

**定位**：Shopper mobile 购物。业务同 mall-web，mobile UX 差异化。

**技术栈**：Expo SDK 52+ + RN + NativeWind + **Gluestack UI v2**（同 admin-mobile）+ shared-mobile-ui + shared-cart / shared-payment / shared-promotion / shared-shipping（前端 hook）。

**16 核心必带 + 4 可选屏幕**：

- 核心：`Home` / `ProductList` / `ProductDetail` / `Search` / `Category` / `Cart` / `Checkout` / `Payment`（WebView / 原生 SDK）/ `OrderList` / `OrderDetail` / `Login / Register` / `Account` / `Notifications` / `Scanner` / `Settings` / `403 /404 /Offline`
- 可选（flag 开）：`Reviews` / `Coupons` / `Favorites` / `Addresses`

**Mall-mobile 特有**：

- **扫码购物**：商品条码 / 二维码 → 深链 → 商品详情
- **支付 mobile 模式**：M2 默认 WebView + `payment-mock`；Tier 2 Stripe RN SDK / 支付宝 / 微信 SDK
- **深链分享**：分享商品到微信朋友圈 → Universal Link + App Link → 打开 App 商品详情
- **离线**：同 admin-mobile 轻量；下单必须在线

**测试**：同 admin-mobile（Unit + 砍 Detox）。

### Server 接口清单（Server app 补充）

约 25-30 个 endpoint：

```
鉴权（AuthModule）:
  POST /api/v1/auth/login                    # 邮箱密码
  POST /api/v1/auth/logout
  POST /api/v1/auth/refresh
  POST /api/v1/auth/otp/request              # 邮箱 OTP 请求
  POST /api/v1/auth/otp/verify               # 邮箱 OTP 校验
  POST /api/v1/auth/magic-link/request       # magic link 请求
  POST /api/v1/auth/magic-link/verify        # magic link 校验
  POST /api/v1/auth/invitations/accept
  POST /api/v1/auth/password/reset/request
  POST /api/v1/auth/password/reset/verify
  POST /api/v1/auth/mfa/*                    # MFA 接口预留（M6 实现）

用户（UserModule）:
  GET  /api/v1/users                         # 分页 + 筛选
  POST /api/v1/users                         # tenant admin 创建
  GET  /api/v1/users/:id
  PATCH /api/v1/users/:id
  POST /api/v1/users/:id/disable
  POST /api/v1/users/:id/change-password

邀请（MembershipModule）:
  GET  /api/v1/invitations
  POST /api/v1/invitations
  POST /api/v1/invitations/:id/revoke

权限（PermissionModule）:
  GET  /api/v1/permissions/me                # 当前用户有的权限点
  GET  /api/v1/roles
  POST /api/v1/roles
  PATCH /api/v1/roles/:id

通知（NotificationModule）:
  GET  /api/v1/notifications                 # 列表（按 status 过滤）
  POST /api/v1/notifications/:id/read
  GET  /api/v1/notifications/stream          # SSE 实时

审计（AuditModule）:
  GET  /api/v1/audit-logs                    # 按 correlationId / resource / user / time 查

文件（StorageModule）:
  POST /api/v1/storage/upload                # 单次 ≤ 100MB
  GET  /api/v1/storage/:id/download          # 签名 URL

租户配置（TenantModule）:
  GET  /api/v1/tenants/me
  PATCH /api/v1/tenants/me                   # 改 timezone / locale

Feature flag（FeatureFlagModule）:
  GET  /api/v1/feature-flags                 # 当前用户所有 flag

健康（HealthModule）:
  GET  /api/v1/health/live
  GET  /api/v1/health/ready
  GET  /api/v1/health/startup

Meta:
  GET  /api/v1/meta/versions                 # API 版本清单（mobile 兼容检查）

Platform 专属（装 platform app 才启用）:
  POST /api/v1/platform/tenants              # 创建
  GET  /api/v1/platform/tenants              # 列表
  PATCH /api/v1/platform/tenants/:id/status  # active/suspended/archived
  PATCH /api/v1/platform/tenants/:id/quotas
  PATCH /api/v1/platform/tenants/:id/feature-flags
  POST /api/v1/platform/tenants/:id/impersonate
  GET  /api/v1/platform/search               # 跨租户搜索
  GET  /api/v1/platform/audit-logs           # 跨租户审计
  GET  /api/v1/platform/health
```

### Server 文件结构（补充）

```
apps/server/
├── src/
│   ├── main.ts
│   ├── app.module.ts                      # magic comment 自动填
│   ├── auth/ user/ tenant/ membership/    # 13 个 module 各一个目录
│   ├── notification/ audit/ storage/ health/
│   ├── permission/ i18n/ feature-flag/ analytics/
│   ├── platform/                          # 装 platform app 时激活
│   └── common/                            # pipe / filter / interceptor
├── prisma/
│   ├── schema/                            # Prisma 5 多文件
│   │   ├── main.prisma                    # enable prismaSchemaFolder
│   │   ├── tenant.prisma / user.prisma / ...
│   ├── migrations/
│   └── seed.ts                            # magic comment 区 + 模块化 seed/*.ts
├── tests/e2e/                             # Playwright API 测试
├── package.json
├── tripod.app.yaml
└── README.md
```

### 每种 app 模板的配对文档（`docs/templates/<type>/`）

**强制**：每种 app 模板**必须**配套 5 份 AI 友好文档。随 `@tripod-stack/template-<type>` 发包；用户 `pnpm create tripod` 时也复制到新项目的 `docs/` 方便业务阅读。

```
docs/templates/<app-type>/
├── README.md                    # 拉下来看什么 / 怎么跑 / 必备 env
├── components.md                # 用了哪些 UI 组件 + 替换指引（给 swap-ui-library skill 读）
├── pages.md                     # 有哪些页面 + 路由 + 权限要求 + 页面类型（SSG/SSR/CSR）
├── customization.md             # 改 UI / 改色板 / 加菜单项 / 换 UI 库 的路径
└── testing.md                   # 怎么跑测试 + 自带测试覆盖了什么
```

#### 每份文档的结构模板（AI 友好）

**`README.md`** 结构：

```markdown
# <App 类型> 模板

## 定位

一句话说清楚这个 app 是做什么的、谁用。

## 技术栈

| 层    | 选型 |
| ----- | ---- |
| 框架  | ...  |
| UI 库 | ...  |
| ...   | ...  |

## 开箱即用功能（表格）

| 功能 | 来源 | 说明 |

## 必备 env

| 变量 | 作用 | 示例 |

## 快速起（3 步以内）

1. ...
2. ...
3. ...

## AI 读解路径

用户说"xxx" → 做 yyy
```

**`components.md`** 结构（给 `swap-ui-library` skill 读）：

```markdown
# <App 类型> 组件清单

## UI 库

默认用：`<lib-name>@<version>`

## 使用组件

| 组件   | import path | 出现位置 | 特殊用法                         |
| ------ | ----------- | -------- | -------------------------------- |
| Button | `antd`      | 90% 页面 | `type=primary/default/danger`    |
| Table  | `antd`      | 列表页   | ProTable 高级功能（分页 / 排序） |
| ...    | ...         | ...      | ...                              |

## 换库指引

见 `.claude/skills/swap-ui-library/mappings/<platform>/<from>-to-<to>.md`

## 业务自建组件

| 组件              | 功能               | 何时替换           |
| ----------------- | ------------------ | ------------------ |
| BrandedLogoHeader | 顶栏 logo + 品牌名 | 改 logo / 品牌色时 |
| ...               | ...                | ...                |
```

**`pages.md`** 结构：

````markdown
# <App 类型> 页面清单

## 必带页面

| 路径     | 文件                     | 类型 | 权限   | 业务可改程度 |
| -------- | ------------------------ | ---- | ------ | ------------ |
| `/login` | `src/auth/LoginPage.tsx` | CSR  | 未登录 | 整体替换可   |
| ...      | ...                      | ...  | ...    | ...          |

## 可选页面（按 flag）

...

## 路由守卫

... `<RouteGuard>` 如何工作

## 业务加新页面

```bash
pnpm tripod gen:crud <resource>  # 产出列表 / 详情 / 表单页
```
````

````

**`customization.md`** 结构：

```markdown
# <App 类型> 定制指引

## 轻改（30 分钟内）
### 改品牌色 / 字体
改 `tailwind.config.ts` 的 theme：
```ts
theme: { colors: { primary: '#你的色' } }
````

### 改 logo

替换 `public/logo.svg`。

### 改菜单项

改 `src/config/menu.ts`...

## 中改（半天）

### 替换 LoginPage 的表单样式

...

## 重改（1-2 天）

### 整体替换 LoginPage

**保留所有 useAuth() hook 调用**，只改视觉...

## 换 UI 库

跑 `/swap-ui-library` skill...

````

**`testing.md`** 结构：

```markdown
# <App 类型> 测试

## 跑测试
```bash
pnpm test              # Unit
pnpm test:e2e          # Playwright（仅 web app 有）
pnpm test:coverage     # 覆盖率
````

## 自带测试覆盖

| 层     | 覆盖                                             |
| ------ | ------------------------------------------------ |
| Unit   | hook / util / 业务组件                           |
| API    | 登录 / 邀请 / 通知 / 权限 / 幂等 / 分页 / 多租户 |
| UI E2E | 登录流 / 401 / 403 三条路径                      |

## 加业务测试

`gen:crud` 自动产出 `<resource>.spec.ts`，按模板扩展。

```

#### 文档 AI 友好的强制规则（`tripod doctor` 校验）

- 单文件 ≤ 1000 行
- 平均段落 ≤ 80 字（超了 warn "拆清单"）
- 无 TODO / FIXME / XXX（这些属于 issue tracker 不属于文档）
- 含 "AI 读解路径" 小节（README 必须有）
- 代码示例可复制运行（不用伪代码 / 省略号）

---

## 整体架构（待细化）

### 仓库结构（草案）

```

tripod/
├── apps/ # 按需装载：tripod add-app <type>（除 server 必装、cli 为开发工具）
│ ├── server/ # NestJS 后端（必装；所有业务 API）
│ ├── platform/ # 超管控制台（按需；platform.example.com；MFA 默认关，可选开启）
│ ├── admin-web/ # 租户管理后台（React 19 + Vite）
│ ├── admin-mobile/ # 租户管理移动端（Expo RN；现场 / 经理用）
│ ├── portal/ # 门户 / 官网 / 文档站（Next.js 15）
│ ├── mall-web/ # 商城 Web（Next.js 15；购物车 / 结算）
│ ├── mall-mobile/ # 商城移动端（Expo RN；含支付 SDK）
│ └── cli/ # tripod-cli 本体（开发工具；发布为 @tripod-stack/cli）
├── packages/
│ ├── shared-types/ # 前后端共享 DTO / Enum / 错误码枚举
│ ├── shared-config/ # Zod env schema（启动 fail-fast）
│ ├── shared-contract/ # HTTP Response/Error envelope / 分页 / 排序 / Idempotency-Key / Request ID
│ ├── shared-api-client/ # axios + 全局错误拦截 + 重试 + OpenAPI codegen（orval）
│ ├── shared-notify/ # UI 无关提示接口（NotifyTransport，各 app 注册具体实现）
│ ├── shared-security/ # CORS + Helmet + CSRF + body-limit
│ ├── shared-auth/ # Credential Provider + Session Policy + MFA + Recovery（UI 无关）
│ ├── shared-permission/ # PermissionNode 3 type（PAGE/ACTION/DATA_SCOPE）+ Guard + Registry
│ ├── shared-workflow/ # State history 查询能力（状态判断/事务在业务 service 自己写）
│ ├── shared-storage/ # StorageProvider 接口 + 单次上传/下载 + File 模型
│ ├── shared-notification/ # NotificationService + ChannelProvider + 模板 + 速率控制
│ ├── shared-realtime/ # RealtimeChannel 抽象（M2 默认 SSE + Redis Pub/Sub）
│ ├── shared-audit/ # BusinessAuditLog 单表 + 显式 audit.log() + CorrelationContext
│ ├── shared-cache/ # CacheProvider 抽象 + @Cacheable 装饰器 + 多租户前缀
│ ├── shared-scheduler/ # 定时任务 + 分布式锁 + per-tenant CRON + 审计集成
│ ├── shared-logger/ # 前端错误上报 + 后端 pino + OTEL 代码插桩（endpoint 可空）
│ ├── shared-i18n/ # i18next + 四语言基础翻译 + 格式化工具
│ ├── shared-test/ # Factories + 多租户测试隔离 + E2E helper + MSW
│ ├── shared-theme/ # 主题 token（light/dark + tenant 色板）+ useTheme hook（M2）
│ ├── shared-web-ui/ # M2：UI 库无关逻辑组件 + hook（<Gate> / <Flag> / useAuth / useNotifications / ...）
│ ├── shared-mobile-ui/ # M2：RN 版本同上（useScanner / usePushRegistration / useDeepLink / ...）
│ ├── shared-feature-flag/ # FeatureFlagProvider + Tenant.featureFlags + doctor 生命周期校验
│ ├── shared-analytics/ # AnalyticsProvider + null impl + 自动埋点
│ ├── shared-deeplink/ # DeepLinkResolver + Registry（M2 接口，M5 实现）
│ ├── shared-payment/ # M2：PaymentProvider + payment-mock（mall 场景）
│ ├── shared-cart/ # M2：购物车合并 + 库存预占（mall）
│ ├── shared-promotion/ # M2：优惠券 / 折扣引擎（mall）
│ ├── shared-shipping/ # M2：ShippingProvider + shipping-mock（mall）
│ ├── shared-utils/ # 跨端工具（日期、货币、校验）
│ │ # 开发配置包（不是运行时基建）
│ ├── eslint-config-tripod/ # ESLint preset（base/react/next/nest/rn）+ 自定义 rules
│ ├── prettier-config-tripod/ # Prettier preset
│ └── tsconfig-tripod/ # tsconfig base 五份
├── adapters/ # 只登记 M2 默认装配；其他接口已开放，按需新增 adapter 包
│ ├── auth-email-password/ ★ M2
│ ├── auth-username-password/ ★ M2
│ ├── recovery-email-link/ ★ M2
│ ├── storage-local/ ★ M2（默认，生产可用）
│ ├── storage-s3/ ★ M2（S3 / MinIO / R2 / OSS-S3 兼容）
│ ├── notification-email-smtp/ ★ M2
│ ├── realtime-sse/ ★ M2（默认）
│ ├── i18n-file/ ★ M2（本地 JSON）
│ ├── error-reporting-glitchtip/ ★ M2
│ └── audit-postgres/ ★ M2（单表 + 复合索引）
├── infra/
│ ├── docker/ # 每个 app 一份 Dockerfile（server / admin-web / platform / portal / mall-web；admin-mobile / mall-mobile 走 EAS）
│ ├── compose/ # docker-compose.yml + .prod.yml + observability.yml
│ ├── deploy/ # build.sh / deploy.sh / rollback.sh / snapshot-db.sh / .env.prod.example
│ ├── db-scripts/ # RLS policy 模板 + tenant 建表 generator
│ ├── backup/ # pg_dump / restore / verify 脚本 + 恢复 runbook
│ └── mobile-selfhost/ # Tier 2：Fastlane + 自托管 OTA
├── secrets/ # ⭐ 仅本地，gitignore（.env.prod / .env.staging / README）
├── .claude/ # ⭐ Claude Code 行为资产（随模板分发，`pnpm create tripod` 整块拷到新项目）
│ └── skills/
│ ├── spec-driven-testing/ # Spec → 三轨测试计划 → 三层测试代码（TDD 官方流程）
│ │ ├── SKILL.md
│ │ └── rules/ # spec-template / cross-review / test-plan / unit / playwright / playwright-ui
│ ├── graph-code-analysis/ # 图论代码分析（spec-driven-testing 的 Track B 依赖）
│ │ └── SKILL.md
│ └── dev-startup/ # 一键起全栈 + 常见问题排查
│ ├── SKILL.md
│ └── troubleshoot.md
├── plans/ # 设计文档（本文件所在目录）
├── docs/
│ ├── specs/ # ⭐ 业务模块 spec + 测试计划（spec-driven-testing 产出地，入 git）
│ │ ├── <resource>.md # Step 0 产出
│ │ └── <resource>.test-plan.md # Step 1 产出
│ ├── release-rules.md # Changesets 版本判断规则（Claude Code 读）
│ ├── deployment.md # 部署流程
│ ├── secrets-management.md # 本地 secrets 维护 + 打包捎带流程（默认）
│ └── secrets-management-sops.md # Tier 2：sops 加密入库
└── CLAUDE.md # Claude Code 行为指令（发版/审计/代码规范 etc）

```

### Adapter 模式切入点（接口已开放，M2 默认见各章"Adapter 清单"）

只列 M2 有默认实现的抽象位。其他（支付 / 推送 / 富文本 / 图表）由业务场景驱动，真接入时新建 adapter 包即可，不预登记。

1. **CredentialProvider**（登录方式）：M2 默认 email-password + username-password
2. **SessionPolicy**（会话策略）：M2 默认 MaxDevicesPolicy + SingleGlobalPolicy（Platform Admin 专用）
3. **RecoveryProvider**（密码恢复）：M2 默认 email-link
4. **StorageProvider**（对象存储）：M2 默认 local + s3（S3 / MinIO / R2 / OSS-S3 兼容）
5. **ChannelProvider**（通知渠道）：M2 默认 email-smtp
6. **RealtimeChannel**（实时通道）：M2 默认 SSE
7. **I18nBackend**（翻译源）：M2 默认本地 JSON

未来扩展点（接口预留但 M2 不做实现）：`MfaChallenger` / Permission Engine 外置（Casbin/Cerbos） / PreviewProvider / 支付 / 推送 — 首次业务需要时再加。

---

## 里程碑

### M1：Monorepo 地基 + Server 骨架 + 多租户基建 + 最简 Web 联通

- pnpm workspace + Turborepo + commitlint 基线
- **代码规范基础层**：`packages/eslint-config-tripod/base.js` + `prettier-config-tripod` + `tsconfig-tripod/base.json` 三个共享配置包；`.husky/pre-commit`（lint-staged）+ CI lint/typecheck job（见 §代码规范详细设计）
- `apps/server`：NestJS + Prisma + Postgres + Redis + BullMQ 最小可跑模块，含 config、logger、health check
- **多租户基础设施 M1 即纳入**：
  - Prisma schema 包含 `User` / `Tenant` / `TenantMembership` 三张核心表
  - User 表字段预留：`email` 可选 + `phone` 字段 + `userType` 枚举（MEMBER / SHOPPER / HYBRID / PLATFORM_ADMIN），为未来商城 shopper 避免迁移
  - `PrismaService` 内置 tenant middleware（读时自动 `where tenantId`；写时自动填 `tenantId`；async-local-storage 传递上下文）
  - `TenantContextInterceptor` + `TenantResolver` 接口（M1 只内建 `FromJwtResolver` + `FromMockResolver`；FromEnv / FromSubdomain / FromPath 留到 `plans/future-portal-mall.md` 激活时做）：每请求按策略链解析 tenantId → async-local-storage → 执行 `SET LOCAL app.tenant_id`
  - `infra/db-scripts/` 提供两套 RLS policy 模板：`rls-policy-tenant-only.sql.template`（默认，纯私密）+ `rls-policy-public-readable.sql.template`（public_read + tenant_all 双 policy，为门户/商城预留）
  - `create-tenant-table.ts` generator 支持 `--mode=tenant-only|public-readable` 参数；public-readable 模式生成 `published: boolean` + `visibility: Visibility` + `deletedAt` 字段 + 双 RLS policy
  - `Visibility` 枚举（PUBLIC / TENANT / PRIVATE）预置到 schema
  - `@Public()` 装饰器占位（M1 mock auth，M2 真实现 AuthGuard 时联动）
  - Seed 脚本：创建 `default-tenant` + 初始 `platform-admin` + 一个 `tenant-admin` demo 账号
- `packages/shared-types`：错误码、统一响应结构、分页契约
- `packages/shared-api-client`：axios 实例 + 拦截器 + 错误码映射 + OpenAPI codegen pipeline（orval）
- `apps/admin-web` 最简 React 19 + Vite SPA（UI 库暂缺，只用原生标签），调通一个受保护接口
- `infra/compose`：docker-compose.yml 一键起 pg + redis + server
- **Tripod CLI 基础层（M1）**：
  - `apps/cli` scaffold + `tripod.manifest.yaml` + JSON Schema 定义
  - `tripod.config.yaml` 读写 + `tripod validate` 校验
  - `pnpm create tripod <name> --recipe=minimal|erp-standard|erp-commerce` 脚手架命令 + `tripod list-apps`
  - `tripod status` / `tripod recipe list` / `tripod recipe show <name>`
  - 根目录 `CLAUDE.md` 模板骨架（教 AI 如何 interview + 调用 CLI）
  - 三个初始 recipe：`minimal`（server + admin-web）/ `erp-standard`（继承 minimal + 完整 feature）/ `erp-commerce`（继承 erp-standard + portal + mall-web + mall-mobile）
  - Hot-spot 文件模板里预置 Magic Comment 标记（`app.module.ts` / `seed.ts` / `env.schema.ts` / `strategies/index.ts`）
- **Claude Code skill 分发层（M1）**：
  - 模板根 `.claude/skills/spec-driven-testing/`（SKILL.md + rules/ 六份）+ `graph-code-analysis/`（SKILL.md）预置
  - `pnpm create tripod` 执行流程加一步：拷模板根 `.claude/` 整块到新项目根（不过 patch 引擎）
  - 模板根 `docs/specs/` 空目录 + `docs/specs/README.md`（登记 spec 命名与归档约定）
  - CLAUDE.md 骨架登记"新增模块走 `/spec-driven-testing`"协议（链接到 plan-full §Spec 驱动 TDD 工作流）
- **验收**：
  - `pnpm i && pnpm dev` 本地起得起来
  - 前端调通一个受保护接口（返回当前 tenant 信息）
  - 错误拦截生效
  - 用两个 tenant 的账号分别登录，各自数据完全隔离（即便 raw SQL 查也只看到自己的）
  - `ps` 连 psql 未 `SET app.tenant_id` 时业务表返回 0 行
  - `pnpm create tripod test-app --recipe=minimal` 能在 30 秒内生成可跑项目
  - `tripod status` 正确显示当前 config 状态
  - `tripod validate` 对手工改坏的 config.yaml 能给出清晰错误
  - 新项目 `.claude/skills/spec-driven-testing/` 与 `graph-code-analysis/` 原样到位，在 Claude Code 会话里 `/spec-driven-testing` 可触发

### M2：鉴权 + 权限 + 多租户完整能力 + i18n + 状态机（UI-agnostic）

**shared-auth**（鉴权核心）：
- `CredentialProvider` 接口 + Map 注册分发；统一 `POST /auth/login` 端点
- 两阶段登录：单 membership 直接发 token；多 membership 返回 `preAuthToken` + 列表，`POST /auth/login/tenant` 完成
- `SessionPolicy` 接口 + 2 个内建（`MaxDevicesPolicy` 默认 / `SingleGlobalPolicy` Platform Admin 强制）；Unlimited / PerPlatform / RoleBased 为 Tier 2
- Token 生命周期：Access 15 min + Refresh 轮换 + 重放检测 + 滑动 7d / 绝对 30d
- Device ID 管理（客户端 UUID v4）
- `MfaChallenger` / `MfaResolver` / `RecoveryProvider` 接口在 M2 预留，默认 resolver 始终返回空；具体 adapter 留 M6
- 首次登录 `mustChangePassword` 流程
- `POST /auth/switch-tenant`（切换公司）
- `POST /auth/recover/*`（密码重置）
- `useAuth` hook + Zustand session store（UI 无关）

**Platform Admin 入口**（M2 完成；**SPA 按需加，不默认 scaffold**）：
- `@tripod-stack/templates/apps/platform/` 模板就位：login / tenants 管理 / 首位 tenant admin 创建 / 审计日志（基础版）—— 用户跑 `tripod add-app platform` 才写入项目
- `@tripod-stack/templates/modules/platform/` 后端模块骨架就位；`tripod add-app platform` 时自动复制到 `apps/server/src/platform/` 并激活 AppModule import
- `isPlatformAdmin` claim 守卫在 `shared-auth` 常驻（不依赖 platform SPA 是否装）
- `SingleGlobalPolicy` session policy 默认装配到 shared-auth（platform 生效后自动启用）；MFA 接口预留但**默认关闭**（需要时 `tripod add-adapter mfa.totp=mfa-totp` + `tripod platform:enroll-mfa`）
- `tripod platform:seed` 命令提供（随 add-app platform），支持纯密码创建初始超管

**必备 adapters**（M2 完成）：
- `adapters/auth-email-password/`
- `adapters/auth-username-password/`
- `adapters/recovery-email-link/`

**shared-permission**（权限核心）：
- `PermissionNode` 3 type（PAGE / ACTION / DATA_SCOPE）
- `PermissionRegistry.sync()` 启动时自动 upsert 开发者声明的节点
- `@RequirePermission` 装饰器 + `PermissionGuard`
- `hasPermission` 前后端共享函数（一行 `includes` 检查）
- Data-scope：`own / all` 两档，service 层显式处理 `where.createdBy = user.id`
- 预置 5 个模板角色（tenant-owner / tenant-admin / manager / employee / viewer）seed
- Admin 后台 API：角色 CRUD、权限点树查询、Role ↔ Permission 组合编辑
- Admin 前端 demo 页面：角色管理（勾选权限节点）
- `usePermission` hook（UI 无关）
- 字段级脱敏走 service 层显式代码（不做 FieldPermissionInterceptor）

**shared-workflow**（极薄）：
- 通用 state history 查询 API（按 entityId / correlationId）；状态转换在各业务 service 自己写（事务 + 乐观锁 + history 表）
- 不做 DSL / Outbox / machineVersion registry / FlowProducer / timeout 调度，接口均不预埋

**shared-storage**（M2 后期）：
- StorageProvider 接口 + File 模型（**不含** FileUploadSession）
- `/files/upload` 单次上传（≤100MB）+ `/files/:id/download`
- 前端 `useUpload` hook：XHR 进度 + 失败重试（不做 pause/resume/cancel / sha256 / 断点续传）
- 必备 adapters：`storage-local` ★ + `storage-s3` ★（S3 adapter 内部用 `@aws-sdk/lib-storage` SDK 自动分片并发，对上层透明）
- 不做 multipart 协议 / FileUploadSession 表 / 孤儿清理 CRON，真遇 >100MB 需求一次性追加

**shared-notification + shared-realtime**：
- NotificationType / UserPreference / Notification / NotificationDelivery 四表
- NotificationService 编排 + ChannelProvider 接口 + Handlebars 模板 + 速率控制
- 站内信（内置）+ RealtimeChannel 抽象（M2 默认 SSE + Redis Pub/Sub 跨实例广播）
- 三通用频道：`user:{id}:notifications` / `user:{id}:auth-events` / `tenant:{id}:broadcast`
- 必备 adapters：`notification-email-smtp` ★ + `realtime-sse` ★

**shared-audit**：
- BusinessAuditLog 单表 + 4 个复合索引 + CorrelationContext（AsyncLocalStorage）
- Service 层显式调用 `audit.log({ action, entityType, entityId, correlationId, summary, diff })`，异步写入走 BullMQ（env 开关）
- **不做** 装饰器 AOP / Prisma middleware 兜底 / 多实体关联表 / 月分区（真需要时再加）
- Prisma middleware 自动审计兜底
- CorrelationId 跨 HTTP / BullMQ / 外部回调贯穿
- 查询 API：`/audit/by-entity` / `by-correlation` / `by-workflow` / `by-user`
- 必备 adapter：`audit-postgres` ★

**shared-logger**（M2 接入）：
- 前端 Sentry SDK 封装 + ErrorBoundary + breadcrumbs + 脱敏
- 后端 pino → stdout + LoggingContextInterceptor（tenantId/userId/traceId/route 自动注入）
- GlobalExceptionFilter 全局异常捕获
- OpenTelemetry 代码插桩（`OTEL_ENDPOINT` 可空时不导出，插桩仍生成 traceId 供日志关联）
- `docker compose --profile observability up` 起 GlitchTip 单容器（不含 Tempo / Loki / Prometheus / Grafana，未来按需加）

**shared-config**：Zod env schema（启动 fail-fast），统一 `process.env` 读取

**shared-i18n**：i18next 封装 + **zh-CN / en-US / zh-TW / ja-JP** 四语言 × 四命名空间（common / auth / permission / errors）+ 格式化工具

**通用基建层（M2 核心）**：
- **shared-contract**：响应/错误 envelope、分页/排序/筛选 query 语法、错误码枚举、Idempotency-Key、X-Request-Id 跨层传递
- **shared-notify**：NotifyTransport 接口 + null-transport（默认）；admin/mobile 分别用 AntD/Toast 注册
- **shared-api-client**：axios 全局错误拦截（401/403/429/5xx 分类）+ 自动退避重试 + silent 选项
- **shared-security**：CORS（tenant-aware 白名单）+ Helmet + body-limit（上传路由特殊）
- **限流 Rate Limiting**：@nestjs/throttler 多级（IP / user / tenant / endpoint）
- **健康检查**：/health/liveness｜readiness｜startup + Docker compose healthcheck + 优雅关停（SIGTERM drain）

**通用基建层（M2 后期）**：
- **shared-cache**：CacheProvider（Redis 实现）+ @Cacheable 装饰器 + 多租户前缀 + stale-while-revalidate
- **shared-scheduler**：定时任务 + Redis 分布式锁 + per-tenant CRON + 审计集成
- **软删除约定**：业务表强制 `deletedAt`，Prisma middleware 自动过滤 + 改写 delete；回收站基础 API
- **shared-test**：Factories + 多租户测试隔离（`createTestTenant` fixture，供 spec-driven-testing Step 3 三层测试使用）+ E2E Playwright fixture + MSW
- **Playwright 基础配置**：`playwright.config.ts` 模板 + docker-compose `test` profile + `tests/api/` `tests/ui/` 目录预置（随模板分发）
- **tripod doctor 扩展**：每个 `apps/server/src/<resource>/` 检查是否有对应 `docs/specs/<resource>.md`（warn 级别，不 fail）
- **tripod-cli 扩展**：
  - 项目生命周期（对接 manifest.yaml / config.yaml）：`add / remove / add-adapter / remove-adapter / demo / doctor / prune`
  - db / gen / lint / env / release 命令组（详见 tripod-cli 扩展章节）

**部署骨架**（M2，无 CI）：
- Zod env schema + Docker 镜像构建 + `infra/deploy/build.sh`（本地构建 + scp + SSH load）
- Changesets + `apps/cli` changeset-context 命令 + `docs/release-rules.md` + CLAUDE.md 指令
- `infra/deploy/.env.prod.example` + secrets-management.md 文档
- husky pre-commit (lint-staged + gitleaks) + pre-push (typecheck + test + build) 本地门槛

**代码规范完整层**（M2）：
- `eslint-config-tripod/{react,next,nest,react-native}.js` 四个框架子配置
- 6 条 Tripod 自定义 ESLint 规则（`no-direct-prisma-client` / `no-default-export` / `no-barrel-import` / `error-code-required` / `require-permission-decorator` / `require-idempotent-decorator`）
- `tsconfig-tripod/{react,next,nest,rn}.json` 四个框架继承版
- husky pre-push 跑 turbo lint / typecheck / test / build（受影响包）
- 详细设计见 §代码规范详细设计

**验收**：
- 两个 tenant 的账号登录，各自看到本 tenant 数据（RLS + Prisma middleware 双层）
- Alice 同时是 ACME 和 Globex 的成员 → 登录后弹选择页 → 选公司后进入对应空间 → 切换公司 token 重发
- Admin 后台勾选权限组合自定义角色 → 员工登录看到的菜单/按钮/数据范围都受约束
- 测试：`hasPermission` 前后端各自跑同一套权限列表，结果一致
- 测试：只有 `order:read-own` 的员工看到别人创建的订单 → 列表自动过滤 / 直接访问 → 403
- 测试：故意 kill refresh 刚换掉的旧 token → 再次使用 → 整个 family 被踢
- （可选）执行 `tripod add-app platform` + `tripod platform:seed` 后，超管在 `apps/platform` 新建一家公司 + 首位 tenant admin → 员工登录完成强制改密
- Admin demo 切 **zh-CN / en-US / zh-TW / ja-JP 四语言**生效
- "订单状态流转"示例：下单 → 审核 → 发货 → 签收 四步，每步事务 + history 表 + audit.log 都落地；并发审批同一订单 → 乐观锁 409
- 上传 50MB 合同到 storage-local，后端内存峰值 <100MB；>100MB 返回 413；切 `STORAGE_PROVIDER=s3` 指向 MinIO 代码零改动
- 审核订单触发"审核通过"通知（站内信 + email）送达
- 订单全流程（SUBMIT/APPROVE/PICK/SHIP/DELIVER）所有步骤在 `/audit/by-correlation?correlationId=sales-order:{id}` 里形成时间线
- Claude Code 会话里说"加 changeset"自动生成合法 `.changeset/*.md`
- 任何业务错误前端自动弹 toast（根据 code 翻译），5xx 错误带 traceId 显示
- 同一个 Idempotency-Key 重复 POST 订单，第二次返回第一次的结果，不重复创建
- `/auth/login` 连续 10 次失败 → 429 + Retry-After；前端自动退避重试
- `/health/readiness` 在 DB/Redis 断连时返回 503；SIGTERM 优雅关停内 BullMQ job 全处理完
- 多实例部署下同一定时任务只执行一次（分布式锁）
- 删除一个订单 → 列表查询不到 → "已删除" 页看得到 → 30 天内可恢复
- `pnpm tripod gen:crud sales-order` 5 分钟内生成完整 CRUD 骨架并联通权限

**M2 app 模板交付**（开箱即用，业务只改 UI）：

| App | M2 交付内容 | 默认 UI 库 |
|---|---|---|
| **server** | 13 内置 module / ~25-30 endpoint / Prisma 5 schemaFolder / OpenAPI 自动 / 测试 Y 覆盖 | — |
| **admin-web** | 11 必带页（login / select-tenant / dashboard / profile / users / invitations / roles / notifications / tenant-config / 403-404-500）/ 14 项开箱即用功能（登录 4 种方式 / 401 拦截 / API client / 错误处理 / 通知 SSE / 权限守卫 / i18n 4 语言 / 埋点 / flag / 主题 / 上传 / idempotency / 测试）/ 换 UI 库 skill | **AntD 5** |
| **platform** | **不进默认 recipe**（按需 `tripod add-app platform`）/ 15 必带页（login / dashboard / tenants CRUD / quotas / flags 矩阵 / admins / audit / search / health / impersonate / profile） | AntD 5（同 admin-web） |
| **admin-mobile** | **M2 只定接口 + 模板骨架**（Expo RN + Gluestack UI v2 + 9 必带屏幕），完整实现走 M5 | Gluestack UI v2 |
| **portal** | **M2 只定骨架**，完整实现走 M3 | — |
| **mall-web / mall-mobile** | **M2 只定 shared-cart / shared-payment / shared-promotion / shared-shipping 接口**，完整实现走 M3 / M5 | — |

**M2 新增 shared 包**：
- `shared-web-ui`（UI 库无关逻辑组件 + hook，之前规划 M3+ 提前到 M2）
- `shared-mobile-ui`（同上，RN 版）
- `shared-payment` / `shared-cart` / `shared-promotion` / `shared-shipping`（mall 基础）

**M2 新增 auth adapter**：
- `auth-email-otp`（邮箱 6 位验证码）
- `auth-magic-link`（邮箱一次性链接）
- 加上已有 `auth-email-password` / `auth-username-password` / `recovery-email-link`，M2 默认装 **5 个 auth adapter**，业务按 `tripod.config.yaml` 任意组合启用

**M2 新增 skill**：
- `.claude/skills/swap-ui-library/`（AI 换 UI 库，web + mobile 互换 mapping）
- `.claude/skills/dev-startup/`（一键起全栈 + 排查）

### M3：完整 UI + Portal + 部分 Mall（业务场景下放）

M2 已把 admin-web / platform 做到 "开箱即可登录 / 通知 / 权限" 的生产级完整。M3 聚焦 **业务模板完整度 + portal + mall Web 端**：

- **admin-web 业务场景完整化**：`gen:crud` 产出模板进一步打磨（AntD Pro 复杂表单 / ProTable / 树形选择 / 级联 / 审批流 UI）
- **portal 模板就绪**（Next.js 15 + App Router + shadcn + MDX + 客户自服务骨架）
- **mall-web 模板就绪**（Next.js 15 + shadcn + 购物车 + 结算 + 支付 mock + 订单 + 物流）
- **storage-s3 / storage-oss / storage-cos** adapter 实现
- **notification channel 扩展**：channel-sms（接短信 SaaS）/ channel-wecom / channel-dingtalk / channel-feishu
- **分析 PostHog 接入**：`analytics-posthog` adapter（Tier 2 激活）
- **PostHog feature flag**：可选切 `flag-posthog`

### M4：Portal 深化 + SEO 优化

（M3 已有 portal 骨架，M4 深化）
- **性能**：Core Web Vitals / Lighthouse 90+ / 图片优化
- **SEO 工具链完善**：sitemap 自动生成多租户版 / canonical / OG 图片动态生成（`@vercel/og`）
- **i18n 路由深化**：语言检测 / hreflang / 多语言 SEO
- **博客 / 文档站完整**（MDX + syntax highlight + TOC + 搜索）

### M5：Mobile 模板完整化（admin-mobile + mall-mobile）

（M2 已有 mobile 接口前置 / shared-mobile-ui）
- **admin-mobile 模板就绪**（Expo + Gluestack UI v2 + 9 页 + 扫码 + 推送 / 深链真实实现）
- **mall-mobile 模板就绪**（16 页 + WebView 支付 + 深链分享）
- **推送 adapter 实现**：`push-fcm` / `push-apns`
- **深链 adapter 实现**：Universal Link / App Link 真实注册
- **EAS Build + EAS Update 模板**（默认）；`infra/mobile-selfhost/` 提供 Fastlane + 自托管 OTA 参考
- **Detox E2E 按需激活**（默认砍，团队大时启用）

### M6：横向工程化 + Tier 2 能力激活

- **MFA 实现**：`mfa-totp` / `mfa-backup-code` / `mfa-webauthn` / `mfa-sms` adapters；默认对所有用户（含 Platform Admin）**关闭**，按 tenant / role 政策可选启用
- **主题系统**：`shared-theme` token + 暗色模式（和 UI 库 token 对齐）
- **观察栈升级**：Prometheus + Alertmanager / 自定义 Grafana dashboard；可选切 Sentry SaaS 或自托管 Sentry（Session Replay）
- **审计冷数据归档**：`audit-archive-s3` adapter（老数据转 parquet + DuckDB/Athena）；数据量大时 `audit-elasticsearch` 同步
- **真实支付集成**：`payment-stripe` / `payment-alipay` / `payment-wechat` adapters
- **真实物流集成**：`shipping-sf` / `shipping-zto` / `shipping-shippo` 等 adapters
- **搜索升级**：`search-meilisearch` / `search-elasticsearch` / `search-algolia` adapters（商品 ≥ 百万级时）
- **Push 通道增强**：极光 / 个推 / 统一推送联盟
- **安全扫描完整**：Dependabot / CodeQL / Trivy（Docker 镜像扫描）/ gitleaks pre-commit
- **K8s adapter**（Tier 2）：`infra/k8s/` Helm chart 模板 + ArgoCD 配置
- **Secrets adapter 升级**：`secrets-sops` / `secrets-vault` / `secrets-doppler` 按项目需求
- **通知模板后台 UI**：admin 可编辑 Handlebars 模板 + 送达率 dashboard
- **计费**：订阅管理 / 发票 / Stripe Billing 接入
- **SSO / SAML / Enterprise**：`auth-saml` / `auth-oidc-enterprise`
- **CI workflow 模板（按需）**：若团队规模扩大，可加 GitHub / GitLab / Gitea 等平台的 preview deploy / release / matrix build 模板；tripod 不强制

---

## 验证方式

每个里程碑都按"可 clone 可 run + 10 分钟业务页 + Adapter 可替换"三条验收：

1. **可 run**：全新机器执行 `docker compose up -d db redis && pnpm i && pnpm dev`，所有 app 都能起
2. **10 分钟业务页**：按 README 指引，10 分钟内能新增一个带权限的 CRUD 页面并联通后端
3. **Adapter 可替换**：以 auth 为例，JWT → OAuth 的切换只改环境变量和 1 个 adapter 文件，业务代码无感

此外：

- **Server**：`pnpm -C apps/server test` 通过；启动后 `/health` 返回 200，`/api-docs` 能看到 OpenAPI
- **Admin**：Playwright 跑登录→权限→一个 CRUD 的冒烟脚本
- **Mobile**：`eas build --profile preview` 能成功产出可安装包

## 下次开工起点

M1。在后续会话中，我会从 Monorepo 骨架 + NestJS server + shared-api-client 开始落地。

---

## 待定项（后续里程碑时再对齐）

1. **Web UI 库**（M3 开始前）：AntD / shadcn/ui / Arco / Semi。CRUD 走**代码驱动 + 脚手架**路线，不做 Schema-driven。基建层已保证 UI-agnostic，延后不影响 M1/M2
2. **Portal 框架细节**（M4）：Next.js 15 App Router 基本是默认，具体 ISR/SSG 策略届时定
3. **富文本引擎 + 文件预览**（M3）：Tiptap / Lexical / Quill，和 UI 库一起定
4. **前端错误上报服务**（M6）：默认 GlitchTip，Tier 2 支持 Sentry SaaS / 自托管 Sentry
5. **图表引擎**（业务阶段）：ECharts / Recharts / visx
```
