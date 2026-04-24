# Tripod Core（AI 首加载文件）

> **本文件是 AI 日常加载入口**。约 500 行，集中 AI 做任何动作前必须知道的契约。
> 详细设计 / 接口代码 / 决策论证见 `plans/design/mobile-react-19-x-mobile-encapsulated-quokka.md`（下称 **plan-full**）。
> 文档优先级：`tripod.manifest.yaml`（机器可读 SoT） > 本文件 > plan-full > 人类注释。

---

## 1. 文档定位

**所有 tripod 文档写给 AI 读，不是给人维护**。

- 约定即契约，AI 严格遵守；"不做 X" 比 "应做 Y" 更强制
- CLI / YAML / Zod schema 才是真值源，本文件和 plan-full 是 AI 读的副本
- AI 发现副本与代码/YAML 不一致 → 先改副本再继续，不是忽略
- 人的角色是审阅 AI 改动，不是维护文档
- `.claude/skills/` 目录下的 skill 是 AI 行为协议的一部分（Claude Code 自动加载），随模板分发到每个 tripod 项目

---

## 2. 会话开局协议（每次固定）

AI 进入 tripod 项目会话的前 3 步：

1. **读本文件的 Anti-patterns 章（§3）** — 明确禁令
2. **跑 `tripod snapshot --json`** — 拿全景状态（schema 见 §10）
3. **判断用户意图类型**（§5 映射表）— 不立即动手，先对齐

跳过条件：用户明确说"直接做 X"且 X 是查单文件 / 改一个字符串的琐事。

---

## 3. Anti-patterns（AI 必读禁令）

M2 阶段以下能力**明确不做**。AI 生成代码 / 提建议 / 回答问题时**不得主动补回**。用户明确要求才加，加前先把对应项从本章移到"已激活"。

### 权限（shared-permission）

- 不加 `BUTTON` / `FIELD` 节点类型（只 PAGE / ACTION / DATA_SCOPE 三类）
- 不做 4 档 scope（own/assigned/team/all），只 **own / all** 两档
- 不做 `FieldPermissionInterceptor` / `@RequireField` / `ScopeBuilder`
- 不做 tenant 自定义权限节点（L2 低代码已否决）
- 不接 Casbin / Cerbos / openFGA
- `hasPermission` 就一行 `includes` 检查，不做 scope rank 匹配

### 工作流（shared-workflow）

- 不自实现 DSL（`defineStateMachine` / guards / hooks / onEnter 不要）
- 不默认加 Outbox（`OutboxEvent` / `OutboxPublisher` 不建）
- 不做 `machineVersion` 列 + `name@version` registry
- 不抽 BullMQ `FlowProducer` 封装 / Processor 基类
- 不做 SLA timeout 调度
- 状态转换只用：**状态字段 + 乐观锁 + `{Entity}StateHistory` 表 + Prisma 事务**，service 层手写每个动作方法

### 审计（shared-audit）

- 不建 `BusinessAuditLogEntity` 多对多表（关联实体塞 `metadata.relatedEntities`）
- 不做月分区 / 冷数据 S3 parquet / DuckDB / Athena / ES / OpenSearch / ClickHouse
- 不做 `@AuditAction` / `@AuditEntities` / `@AuditDiff` 装饰器 + `AuditInterceptor` AOP
- 不做 Prisma middleware 自动审计兜底
- 埋点只用：service 层显式 `await this.audit.log({...})`

### 存储（shared-storage）

- 不做 multipart 分片协议（`/files/upload/init|status|chunk|complete|abort` 全砍）
- 不建 `FileUploadSession` 表 / 孤儿清理 CRON
- 不做 hash-wasm 流式 sha256 / localStorage 断点续传 / pause-resume-cancel
- 不做前端并发分片控制 / session 配额
- 上传只支持：**单次 ≤100MB，XHR 进度 + 失败重试**
- `StorageProvider` 接口不含 `startMultipart / uploadPart / completeMultipart / abortMultipart`
- 不预留 `fileHash / providerMultipartId / chunkSize` 字段

### 观察栈（shared-logger + observability）

- 不默认起 Prometheus / Grafana / Tempo / Jaeger / Loki / Promtail
- 不做 Grafana dashboards 预置 / `alerts.yml`
- 不做 `metrics.ts`（Prometheus client），不做自定义 metrics 打点
- OTEL 代码插桩保留，`OTEL_ENDPOINT` 默认空（trace 不导出）
- observability profile 只含 **GlitchTip 单容器**

### 通知（shared-notification）

- M2 adapter 只 `email-smtp` + `realtime-sse` 两个
- 不预登记 SMS（Twilio / AWS SNS）/ Slack / Discord / Microsoft Teams / LINE Notify / Push / webhook 各类 adapter
- 不做 Debounce / 速率控制 / quiet hours / 紧急通道多渠道回退

### 鉴权（shared-auth）

- M2 adapter 只 `auth-email-password` + `auth-username-password` + `recovery-email-link`
- 不预登记 OAuth（Google / Apple / LINE / Microsoft / GitHub / Facebook）/ SMS（Twilio）/ SSO-SAML / SSO-OIDC / passkey / MFA
- MFA 相关接口 M2 预留，默认 resolver 始终返回空

### 账号 / 邀请 / 员工扩展

- 不在 `User` / `TenantMembership` 表塞员工业务字段（工号 / 部门 / 入职日期 等），员工是业务模块
- 邀请 M2 只邮箱 token 链接（`TenantInvitation` 不加 `phone`）；**不做 `resend`**（revoke+新建）、**不做防滥用计数**、不做审批流、不做 Platform 批量建租户 UI
- 员工扩展只留 `MembershipLifecycleHook` 一个钩子；不做 `createMember.metadata` 透传、不做 `<MemberExtraColumns>` UI slot

### 导出（shared-export）

- 不预埋 PDF / 图表 / dashboard / "报表中心" / 报表 DSL / 低代码 / 自定义 SQL / OLAP / ClickHouse / ES 同步
- **M2 只 xlsx**（csv→Tier 2）；**不提供前端 `useExport` hook**（业务一行 `window.location.href` 搞定）
- filters 走 `defineExport` 白名单，**M2 只 `eq` + 日期 `between`**；禁动态字段名 / 禁 `in` / 禁 AND-OR 组合
- 超 `MAX_ROWS=500k` 直接报错提示分段（不做异步 job + 邮件）；`MAX_ROWS` / `BATCH_SIZE` 源码常量不暴露配置

### shared-contract 契约

- 不做完整 filter DSL；M2 只白名单字段 + `eq` + 日期 `between`
- 不做 `openapi.ts` 二次封装，直接用 `@nestjs/swagger` 原生 `@ApiOkResponse`

### 时间 / 金额（强制契约 — 详 plan-full §架构原则 §8 / §9）

- **时间**：业务禁 `new Date()` / `Date.now()`（logger / audit / test 例外）、禁 `moment` / `date-fns`，统一 `dayjs`
- **金额/数量**：DTO 禁 `number`，DB `Decimal`，传输 `string`，运算 `decimal.js`；禁 `parseFloat` / `Number(str)` / `toFixed()` 做计算

### i18n

- 不接 Tolgee / Crowdin / Lokalise

### 通用

- 不做 Schema-driven 表单 / ProTable / 低代码配置平台（代码驱动 CRUD 铁律）
- 不做 "Tier 2 adapter 清单预埋"（除 M2 ★ 外不在 plan / manifest.yaml 里预列名）
- 不做 Session Policy 除 `MaxDevicesPolicy` + `SingleGlobalPolicy` 以外的实现

### AI 行为准则

- 遇"要不要加 X"：先查本章。如果在禁令里，直接答"plan 明确不做，除非你明确要求"
- 用户说"未来可能要 X"：**不要**主动埋接口 / 预留字段 / 建目录占位
- 改代码时发现自己正在写禁令里的模式：立即停手，反问用户

---

## 4. 核心架构不变量（绿名单 — 不能省）

以下是骨架，AI 必须尊重：

- **多租户**是地基。所有业务表 `tenantId UUID NOT NULL` + 复合索引 + RLS policy + Prisma middleware。开销 = 一行 where 条件，可忽略
- **多平台** 7 种 app type：`server` / `platform` / `admin-web` / `admin-mobile` / `portal` / `mall-web` / `mall-mobile`
- **Adapter 模式**：`CredentialProvider` / `SessionPolicy` / `StorageProvider` / `ChannelProvider` / `RealtimeChannel` / `RecoveryProvider` / `I18nBackend` 接口稳定
- **UI-agnostic 基建**：`shared-*` 不依赖任何 UI 库，只导出 hooks / stores / primitives / 契约接口
- **CorrelationId** 跨 HTTP / BullMQ / 外部回调贯穿（AsyncLocalStorage）
- **Secrets 禁入 git**：`secrets/` gitignore，本地维护 + 打包捎带 scp
- **env Zod schema 启动 fail-fast**：`packages/shared-config/src/env.ts` 是 SoT

---

## 4.1 多租户编码契约（AI 最易犯错处）

AI 写任何 DB / API 代码前检查：

| 场景                          | 必须做                                                                              | 禁止做                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 取 Prisma 客户端              | `@Inject PrismaService`                                                             | `new PrismaClient()`                                      |
| 新建业务表                    | Prisma schema 加 `tenantId UUID NOT NULL` + 复合索引 `[tenantId, ...]` + RLS policy | 漏 tenantId 字段；遗忘 RLS                                |
| 查询业务表                    | 直接 `prisma.order.findMany({ where: { ... } })`（middleware 自动加 tenantId）      | 手动写 `tenantId: ctx.tenantId`（重复且易漏）             |
| 写入业务表                    | `create/update` middleware 自动填 tenantId                                          | 手填 tenantId 值（等同绕过）                              |
| 跨租户场景（超管 / 维护脚本） | `prisma.$unscoped(() => {...})` 显式绕过 + 审计日志强制                             | 直接无感跨租户读写                                        |
| 业务 job 入队                 | 通过 service 层（自动带 tenantId / correlationId 到 job data）                      | `queue.add()` 直接写原始 data 不带上下文                  |
| BullMQ processor              | `@Processor` 自动从 `job.data._tenantId / _correlationId` 恢复 ALS                  | 在 processor 里手读 `job.data.tenantId` 然后手传给 prisma |
| 新建 controller               | 走 `@CurrentUser()` + `@RequirePermission`                                          | 手解 JWT / 手读 req.user                                  |

**AI 自检**：写完业务代码后 grep 自己改过的文件：

- `new PrismaClient` → 必须为 0
- `tenantId:` 赋值语句 → 只在 seed / migration / explicit $unscoped 场景允许

---

## 4.2 CorrelationId 编码契约

AI 加新的"跨进程动作"时的强制规则：

| 动作                            | 约束                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 外部 HTTP 入站                  | `CorrelationInterceptor` 自动读 `X-Correlation-Id` header，缺失则生成；AI 写 controller **什么都不用做**                         |
| BullMQ job 入队                 | 调 `this.queue.add('job-name', { ...data })` 时，service 基类自动注入 `_correlationId / _tenantId`；AI **不手加**                |
| BullMQ job 消费                 | `@Processor` 基类自动 `correlationContext.run(data._correlationId, () => ...)`；AI 写业务方法**不用感知**                        |
| 外部 HTTP 出站                  | 走 `shared-api-client` 或 `@tripod-stack/shared-http`；header 自动带 `X-Correlation-Id`                                          |
| 外部回调（支付 / 物流 webhook） | 入站时从 metadata / orderId 反查 correlationId 再 `.run()` — AI 写这类 controller 时 **必须** 显式 `correlationContext.run(...)` |
| 日志                            | `pino` 实例从 ALS 自动注入，AI 直接 `logger.info({...}, msg)` 即可                                                               |
| 审计                            | `audit.log({...})` 自动带 correlationId，AI 不传                                                                                 |
| Sentry/GlitchTip                | `setTag('correlationId', ...)` 已在 shared-logger 自动做，AI 不做                                                                |

**AI 自检**：新引入的"跨进程代码"里如果出现 `new Axios` / `axios.create` / `queue.add` 的直接调用，必须检查是否绕过了封装。发现立即换成 shared 包的包装。

---

## 4.3 错误码 / i18n 协作流程

AI 抛业务错误时的**强制五步**：

1. **加错误码枚举**：`packages/shared-types/src/error-codes.ts`
   ```ts
   export const ORDER_INVALID_STATE = 'ORDER_INVALID_STATE';
   ```
2. **后端抛**（NestJS 异常）：
   ```ts
   throw new BusinessException(ORDER_INVALID_STATE, { currentState: order.state });
   // GlobalExceptionFilter 返回 { error: { code: 'ORDER_INVALID_STATE', params: {...}, traceId } }
   ```
3. **翻译 JSON 添加**：`packages/shared-i18n/locales/{zh-CN,en-US,zh-TW,ja-JP}/errors.json`
   ```json
   { "ORDER_INVALID_STATE": "订单当前状态（{{currentState}}）不可执行此操作" }
   ```
4. **前端** `shared-api-client` 拦截器**自动**按 `code` 翻译并弹 toast — AI **不写** `try/catch + notify.error`
5. **文档同步**（若属于模块语义）：在对应 `<resource>.manifest.ts` 的未来 `errors?:` 字段里登记（暂留扩展位）

**AI 禁止**：

- 直接 `throw new Error('订单状态不对')` —— 字符串 message 不可被翻译
- 前端 `catch(e) { notify.error('出错了') }` —— 绕过了错误码 + 翻译
- 抛错误没加 `params` —— 前端翻译模板失去上下文

### 4.3.1 错误码命名规范

- 格式：`<MODULE>_<CAUSE>_<DETAIL>`（全大写 snake），例 `ORDER_INVALID_STATE` / `AUTH_TOKEN_EXPIRED` / `PERMISSION_DENIED_RESOURCE`
- MODULE 前缀必须是**已登记资源名**或**横切前缀**之一：`AUTH` / `PERMISSION` / `VALIDATION` / `TENANT` / `SYSTEM` / `IDEMPOTENCY` / `<resource>`
- 全局唯一：所有 code 集中在 `packages/shared-types/src/error-codes.ts`；CI `tripod/error-code-unique` lint 检查 value 无重复
- 新增 code **必须**同步补 4 份翻译（`packages/shared-i18n/locales/{zh-CN,en-US,zh-TW,ja-JP}/errors.json`），`tripod doctor` 校验任一 locale 缺漏则 error

### 4.3.2 HTTP status 映射（GlobalExceptionFilter 硬规则）

| code pattern                                     | HTTP status | 示例                           |
| ------------------------------------------------ | ----------- | ------------------------------ |
| `VALIDATION_*`                                   | 400         | `VALIDATION_REQUIRED_FIELD`    |
| `AUTH_*`（未登录 / token 无效 / 过期）           | 401         | `AUTH_TOKEN_EXPIRED`           |
| `PERMISSION_*`（登录了但无权限）                 | 403         | `PERMISSION_DENIED_RESOURCE`   |
| `*_NOT_FOUND`                                    | 404         | `ORDER_NOT_FOUND`              |
| `*_INVALID_STATE` / `*_CONFLICT` / `*_DUPLICATE` | 409         | `ORDER_INVALID_STATE`          |
| `IDEMPOTENCY_KEY_CONFLICT`                       | 409         | 相同 idempotency-key 不同 body |
| `*_RATE_LIMIT` / `*_QUOTA_EXCEEDED`              | 429         | `EXPORT_RATE_LIMIT`            |
| 其他（未归类 / 未捕获）                          | 500         | `SYSTEM_INTERNAL_ERROR`        |

AI 抛错按 code 语义归档，**不手传** HTTP status；`BusinessException` 按上表自动出 status。code 若不匹配任一 pattern → CI 失败，强制归类。

---

## 4.4 代码规范契约（AI 写代码前必读）

**SoT 是工具链配置，不是本文档**。ESLint / Prettier / tsconfig / husky / CI 强制执行；本章是 AI 写代码时的**快速索引**。AI 写完代码**必须**跑自检协议（见末尾），违规先修再报告。

### 基线

- TypeScript：[Google TypeScript Style Guide](https://zh-google-styleguide.readthedocs.io/en/latest/google-typescript-styleguide/contents.html)（以下称 **G-TS**）+ TS strict
- HTML / CSS：[Google HTML/CSS Style Guide](https://zh-google-styleguide.readthedocs.io/en/latest/google-html-css-styleguide/contents.html)（**G-HC**）
- 基线默认生效。下方 Tripod 覆写 / 补充优先。

### Tripod 共用覆写

| 规则         | 做法                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 导出         | **只用 named export**。例外：Next `page.tsx` / `layout.tsx` / `loading.tsx` / `error.tsx` / `not-found.tsx` / `route.ts` 必须 default export |
| 文件名       | `kebab-case.ts` / `kebab-case.tsx`                                                                                                           |
| 函数声明     | 顶层用 `const foo = () => {}`（class / Nest decorator 场景除外）                                                                             |
| 类型建模     | `interface` 用于可扩展对象；`type` 用于联合 / 交叉 / 字面量；**禁 `any`**，用 `unknown` + 类型守卫                                           |
| 不变性       | 数组 / 对象默认 `readonly`；mutation 需显式                                                                                                  |
| 错误处理     | 业务错误必 `BusinessException(errorCode, params)`；禁 `throw new Error('字符串')`                                                            |
| Barrel files | **禁** `src/index.ts` 聚合 re-export（bundler 慢 + tree-shake 失败）；包入口可保留但只导出 public API                                        |
| 导入顺序     | node 内置 → 第三方 → `@tripod-stack/*` → 相对路径；ESLint `import/order` 自动排                                                              |
| 相等判断     | 禁 `== / !=`，只用 `=== / !==`；判 null 用 `x != null`，判 boolean 用 `Boolean(x)`                                                           |
| 未使用       | 禁未使用 import / var / param（`_` 前缀例外）                                                                                                |
| `console`    | 禁 `console.log`（用 `logger.info/debug`）；测试文件除外                                                                                     |

### 命名

| 种类                           | 规则                                         |
| ------------------------------ | -------------------------------------------- |
| 变量 / 参数 / 函数 / 方法      | `camelCase`                                  |
| 类 / 接口 / type / enum / 组件 | `PascalCase`                                 |
| 字面量常量 / enum 值           | `SCREAMING_SNAKE_CASE`                       |
| 私有字段                       | 前缀 `_`（TS 类用 `private` + `_` 双保险）   |
| React hook                     | `useXxx`                                     |
| 文件                           | `kebab-case`（除 Next 特殊文件）             |
| 测试                           | `<name>.spec.ts` / `<name>.test.ts`          |
| Prisma model                   | `PascalCase` 单数                            |
| 数据库字段                     | `snake_case`（Prisma `@map` 映射 camelCase） |

### React 19 硬规则

- 函数组件 + Hooks only，禁 class 组件
- Hooks 顶层调用，禁条件 / 循环 / 嵌套函数
- `useMemo` / `useCallback` **不预优化** — 有 profiler 证据才加
- `useEffect` 尽量少 — 先问是否可用派生状态 / 事件处理替代（React 文档 "You Might Not Need an Effect"）
- 列表 `key` 用稳定 id，**禁** array index（除非列表完全只读且无重排）
- 禁 state / props 直接 mutation（即便是嵌套对象）
- Error boundary 包路由层 + 大组件
- Context 只用于"跨层共享状态"，不是 props drill 的廉价替代

### Next.js 15 App Router 硬规则

- 必用 `app/`，禁 `pages/`
- Server components 默认；`'use client'` **显式在文件顶行** + 推到树叶
- `metadata` 静态 / `generateMetadata` 动态，每页必有
- 每 route 段按需 `loading.tsx` / `error.tsx` / `not-found.tsx`
- Route handler `route.ts` + 命名 HTTP 方法（`export const GET = ...`）
- `cookies()` / `headers()` / `params` / `searchParams` 在 15 里是 async，必 `await`
- 缓存显式：`fetch(url, { next: { revalidate: N } })` / `cache: 'force-cache' | 'no-store'`
- 不在 root layout 加 `'use client'`（污染整棵树）

### NestJS 硬规则

- 每业务 feature 一个 Module；`AppModule` 薄，只 import
- Controller **薄**（路由 + DTO + 装饰器）/ Service **厚**（业务逻辑） / Repository 只被 Service 访问
- DTO 用 `class-validator` + `class-transformer`，`ValidationPipe` 全局开启 + `whitelist: true` + `forbidNonWhitelisted: true`
- 所有 service / guard / interceptor / pipe / filter 必 `@Injectable()`
- DI 只用**构造器注入**，禁属性注入
- Controller **禁**直接 `import { PrismaClient }` — 走 `PrismaService`
- 路由 handler 必有 `@RequirePermission` 或显式 `@Public()`
- 写操作 controller 必有 `@Idempotent()`（支付 / 发货 / 通知 等关键操作 CI 强制）

### React Native（Expo）/ HTML·CSS·Tailwind 硬规则

M2 不涉及（Mobile 走 M5），详见 plan-full §各框架延伸细则。核心约束：

- RN：函数组件 + Hooks + NativeWind（禁 `StyleSheet.create`）+ `expo-image` + `expo-secure-store`
- HTML：语义标签优先 `div`；Mobile-first；禁 `!important`；禁硬编码 `#fff` / `20px`（走 Tailwind theme token）

### 工具链强制（AI 不能绕过）

| 工具                | 包 / 配置                                                | 作用                                                                 |
| ------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| ESLint              | `@tripod-stack/eslint-config` 五个子配置                 | 语法 + 风格 + Tripod 自定义规则                                      |
| Prettier            | `@tripod-stack/prettier-config`                          | 格式化（printWidth 100 / singleQuote / trailingComma all）           |
| TypeScript          | `@tripod-stack/tsconfig` 四个 base                       | `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` |
| husky + lint-staged | pre-commit                                               | prettier + eslint --fix                                              |
| husky pre-push      | `pnpm typecheck` + `pnpm test --filter=...[origin/main]` | 推前挡                                                               |
| CI                  | `pnpm lint` / `typecheck` / `test` / `build`             | 阻断合并                                                             |

**Tripod 自定义 ESLint 规则**（husky pre-push 必过）：

- `tripod/no-direct-prisma-client` — 禁 `new PrismaClient()`（除 PrismaService 内部）
- `tripod/no-default-export` — 禁 default export（Next 特殊文件 allowlist 例外）
- `tripod/no-barrel-import` — 禁从 `src/index.ts` 聚合入口导入
- `tripod/error-code-required` — `BusinessException` 必传 errorCode 常量
- `tripod/require-permission-decorator` — controller 写操作 handler 必有 `@RequirePermission` 或 `@Public()`
- `tripod/no-raw-date` — 业务禁 `new Date()` / `Date.now()`（logger / audit / test allowlist）
- `tripod/no-number-for-money` — 字段名 `price/amount/cost/fee/total/quantity/qty/stock/rate/ratio/balance` 禁 `number`，走 `string`（Decimal 传输）
- `tripod/no-parsefloat-on-money` — 业务禁 `parseFloat` / `Number(string)`（例外同行注释）
- `tripod/require-idempotent-decorator` — **M2 默认 `off`**，M3 出现 payment / shipping 业务时显式开 `error`

详细 ESLint rule 代码 / 各框架展开细则：见 plan-full §代码规范详细设计。

### AI 自检协议（每次写完代码）

固定六步，不可跳：

```
[1] 回看 diff，对照 core §4.1（多租户）/ §4.2（correlationId）/ §4.3（错误码）/ §4.4（本章）共同契约
[2] pnpm turbo run lint --filter=<改过的 package>
[3] pnpm turbo run typecheck --filter=<改过的 package>
[4] 有 lint / type 报错：先修，**禁 --fix 批量**（可能改坏语义），逐条看
[5] 再次跑 [2]-[3] 直到全绿
[6] 报告：改了哪些文件 + lint/tc 通过 + 列出刻意保留的 warning 及理由
```

**严格禁令**：

- 写完**不跑 lint** 就报"完成"
- 用 `// eslint-disable` / `// @ts-ignore` / `// @ts-expect-error` 绕过**除非**明确原因 + 同行注释说明 + 用户知情
- 用 `as any` / `as unknown as X` 双重断言强制转型（例外：测试文件 + 类型桥接场景同行说明）
- 删已有测试让它过
- 关闭 ESLint rule 让它过

---

## 4.5 健康检查 + 优雅关停契约

- `/health/live` — 进程活着（不查 DB / Redis），用于 liveness probe；**任何**依赖故障都不返 503（liveness 失败 = 容器重启，依赖抖动重启救不回来）
- `/health/ready` — readiness probe，检查：DB 连通性（`SELECT 1`） + Redis `PING` + DI 容器 `onApplicationBootstrap` 全跑完；任一失败返 503 并从 LB 摘流量
- `/health/startup` — startup probe，检查 Prisma 已 apply 最新 migration + seed 完成；启动阶段专用，通过后 ready 接管（K8s `startupProbe` 语义）
- **SIGTERM 处理顺序**（`shared-security` 的 `GracefulShutdownModule` 自动接管，AI 不写）：
  1. readiness endpoint 立刻转 unhealthy（LB 摘流量）
  2. 停止接新 HTTP 请求（NestJS `app.close()` 的 `beforeShutdown` 钩子）
  3. 等 in-flight HTTP 请求跑完，上限 **30s**
  4. BullMQ worker 停接新 job，等 in-flight job 跑完，上限 **60s**，超时 `worker.close(force=true)` 硬杀
  5. 关 Prisma pool / Redis client
  6. `process.exit(0)`
- **AI 禁止**：
  - controller / service 里自起 HTTP server / 自注册 SIGTERM / SIGINT handler
  - 在 readiness 里检查**外部第三方服务**（S3 / 邮件 SMTP / 支付网关）— 外部抖动不该让本服务被摘流量
  - liveness 里查 DB / Redis — 会因连接池短暂耗尽而导致容器重启风暴

---

## 4.6 日志级别 + 敏感字段 redaction 契约

**级别语义**（AI 选错级别是最常见违规）：

| 级别    | 用法                                                           | prod 是否输出               |
| ------- | -------------------------------------------------------------- | --------------------------- |
| `trace` | 开发调试临时加，PR 前必删；CI 扫到 `logger.trace` 警告         | 否                          |
| `debug` | 详细步骤                                                       | 否（`LOG_LEVEL=info` 过滤） |
| `info`  | 关键业务事件（订单提交 / 用户登录 / job 完成 / 外部 API 调用） | 是                          |
| `warn`  | 可恢复异常（重试后成功 / 降级到备用链路 / 非致命数据异常）     | 是                          |
| `error` | 未捕获异常 / 业务致命失败；**自动上报 GlitchTip**              | 是 + 上报                   |
| `fatal` | 进程即将退出的严重错误（SIGTERM 以外原因）                     | 是 + 上报                   |

**Pino redaction 默认清单**（`shared-logger` 预配置，启动即生效）：

```
password, pwd, token, accessToken, refreshToken, authorization, cookie,
secret, apiKey, apiSecret, privateKey, sessionId,
*.creditCard, *.cvv, *.ssn, *.idCard, *.bankAccount,
req.headers.authorization, req.headers.cookie, req.headers['x-api-key']
```

- AI 加新字段名若可能含敏感信息（`*_secret` / `*_token` / `*_password` / `*_key`）→ 必在 `packages/shared-logger/src/redaction.ts` 登记；CI `tripod/redaction-required` lint 扫 DTO 字段名提示
- 手机号 / 邮箱默认**不** redact（业务 log 常需要脱敏后半段，看 tenant 合规要求），需要时在该 tenant 的 config 加

**request log 固定字段**（`LoggerInterceptor` 自动注入，AI 不手打）：

```
method, path, status, ms (latency), tenantId, userId, correlationId,
userAgent, ip (X-Forwarded-For 取第一段), requestSize, responseSize
```

AI 写业务 `logger.info({...}, msg)` 时**不重复**上述字段（会被自动合并）。

---

## 4.7 软删除查询 / 恢复语义

- **Prisma middleware 默认过滤**：业务表查询自动加 `where: { deletedAt: null }`，AI 写 service 查询**不手加**
- **显式跨越软删除**：`prisma.$withDeleted(() => prisma.order.findMany({...}))`，审计日志强制记录；AI 仅在超管 / 数据修复脚本使用
- **资源是否支持软删除**：`<r>.manifest.ts` 加 `softDelete: true`；`gen:crud` 自动产 `deletedAt` 字段 + `restore` 方法 + `<r>:restore` 权限点 + `audits: ['restored', 'hard-deleted']`
- **恢复 API**：`POST /<r>/:id/restore`，装饰器 `@RequirePermission('<r>:restore')` + `@Idempotent()`
- **索引策略**：用 Postgres **部分索引**
  ```sql
  CREATE INDEX order_tenant_active_idx ON "order" (tenant_id, created_at)
    WHERE deleted_at IS NULL;
  ```
  活跃行索引体积 ≈ 全表索引的 40-60%（删率越高差距越大）；Prisma 走 migration 手写 `WHERE`
- **硬删除**（`prisma.$hardDelete()` 辅助方法）：唯一合法场景是**用户销户 + 法规要求**（GDPR / 《个人信息保护法》erasure）；必 `@RequirePermission('system:gdpr-erase')` + 审计高亮标红
- **AI 禁止**：
  - 手写 `where: { deletedAt: null }` — middleware 重复且遗漏风险高
  - 用 `prisma.$executeRaw('DELETE FROM ...')` 绕过软删除 middleware
  - 在 list 查询里默认返回已删数据（只有专门的"回收站" API 才返回）

---

## 4.8 分页默认值 + 上限

`shared-contract` 的 `PaginationQuery` DTO 硬约束（`ValidationPipe` 自动拒绝超限，返 400 + 错误码）：

| 参数                           | 默认 | 上限      | 超限行为                                          |
| ------------------------------ | ---- | --------- | ------------------------------------------------- |
| `pageSize`                     | 20   | 100       | 400 `VALIDATION_PAGE_SIZE_TOO_LARGE`              |
| `page`                         | 1    | —         | `page < 1` → 400 `VALIDATION_PAGE_INVALID`        |
| `offset` = `(page-1)*pageSize` | —    | **10000** | 400 `VALIDATION_OFFSET_TOO_DEEP`，提示改用 cursor |

- **cursor 分页**：资源在 `<r>.manifest.ts` 加 `pagination: 'cursor'`；`gen:crud` 自动产 `cursor` query + `nextCursor` response；深分页 / 时序列表（订单、消息）默认 cursor
- **offset 分页保护的理由**：大 offset 的 Postgres 实际行为是"扫前 N 行再丢弃"，offset=100000 扫 10 万行；10000 是实践中管理后台够用 + DB 可承受的平衡点
- **导出上限**：`defineExport` 的 `MAX_ROWS=500k` 独立（走 XLSX 流式，**不经** Pagination DTO）
- AI 加列表查询**禁**自写 `take: query.pageSize` / `skip: (query.page - 1) * query.pageSize`，统一走 `shared-contract` 的 `paginate(prisma.order, query, { where })` helper

---

## 4.9 时区处理契约

- **DB 存储**：所有时间字段用 `timestamptz`（存 UTC 但保留时区信息），Prisma model 声明 `DateTime @db.Timestamptz(6)`；`tripod/no-naive-timestamp` lint 拦截 `@db.Timestamp`
- **展示时区**：按 **tenant.timezone**（tenant 级配置，默认 `Asia/Shanghai`）**不是**用户个人偏好 — 同一订单所有员工看到相同创建日期，避免"排班 / 对账"因时区错乱
- **自然日边界**（日报 / `createdAt` date filter / 每日统计）：按 tenant 时区算，不是 server 时区也不是 UTC
- **helper**：`shared-utils` 导出
  ```ts
  startOfTenantDay(instant: Date, tenantTz: string): Date  // UTC instant for tenant-local 00:00
  formatTenantDate(instant: Date, tenantTz: string, locale): string
  dayOf(instant: Date, tenantTz: string): string  // 'YYYY-MM-DD' in tenant local
  ```
  所有业务代码**只**用这些 helper 做时间运算/展示，**不**直接用 `dayjs()` / `dayjs(x).startOf('day')`
- **跨时区多租户**（总部 + 海外分公司场景）：每个 tenant 独立配 timezone；platform 超管看跨租户数据时按各 tenant 自己的时区展示
- **AI 禁止**：
  - DB 字段用 `timestamp`（无时区）— 节省 4 字节但引入永久时区 bug 风险
  - 业务代码 `dayjs().startOf('day')` 不带 tz 参数 — 按 server 时区算；Docker 默认 UTC，和业务预期的 `Asia/Shanghai` 差 8 小时
  - 前端 `new Date(iso).toLocaleString()` — 按浏览器时区展示，破坏"同 tenant 同日期"规则；统一走 `formatTenantDate`

---

## 4.10 API 版本化契约

- **URL 路径版本**：所有业务 controller 路径必须匹配 `^/api/v\d+/...`（`@Public()` 健康检查 / 认证端点例外）；`tripod/api-version-required` lint 强制
- **版本号语义**：只有**破坏性变更**才升 major（`/v1` → `/v2`）；不用 minor / patch 版本
- **非破坏性演进**（可加到现版本）：加字段（response 里 / `@ApiProperty({ required: false })`）/ 加可选 query / 加新 endpoint / 修 bug / 放宽 validation
- **破坏性变更**（必升版本）：删/改字段语义 / 删 endpoint / 加必填字段 / 收紧 validation / 改 HTTP status 语义 / 改 error code 语义
- **Deprecation 流程**：老版本 `@ApiOperation({ deprecated: true })` + response header `Deprecation: true` + `Sunset: <ISO>` + `Link: <new url>; rel="successor-version"`；**最少 6 个月**宽限期后才能真删
- **Controller 目录约定**：`<resource>/v1/` + `<resource>/v2/` 并存；service / manifest 共享，DTO 按版本独立
- **AI 禁止**：controller 路径不带 `/v{N}/` 段（`/api/orders` 是错，必须 `/api/v1/orders`）；改现版 DTO 字段语义（要改走 v2）；无 `Sunset` 日期的 deprecation

---

## 4.11 埋点契约（shared-analytics）

- **业务代码 day 1 就埋**：`analytics.track('<resource>.<verb>', {...})`；M2 默认 `analytics-null` 0 开销；后期切 PostHog 零业务改动
- **命名格式**：`<resource>.<verb>`（过去式，如 `order.submitted`）/ `ui.<area>.<action>`（`ui.nav.menu-clicked`）/ `system.<area>.<verb>`；`tripod/analytics-event-naming` lint 拦截空格 / camelCase / 中文
- **标准 properties 自动注入**：`tenantId / userId / userRole / route / sessionId / platform / appVersion / locale / correlationId`（`AnalyticsContext` 读 auth/i18n/router context），业务只传领域字段
- **`<resource>.manifest.ts` 登记**：新增事件先在 `analytics: ['<resource>.<verb>', ...]` 登记，`tripod doctor` 校验
- **gen:crud 自动埋**：resource created / state-changed / deleted / restored / exported + list-viewed / detail-viewed
- **AI 禁止**：`track('xxx')` 不在 manifest 登记；`track` 传 `number` 以外的金额（Decimal → string 序列化后再传）；在埋点 properties 里塞敏感字段（会被 AnalyticsProvider 转发第三方）

---

## 4.12 Feature Flag 契约（shared-feature-flag）

- **所有 flag 在 `tripod.config.yaml` 登记**（`featureFlags.<name>.{ default, description, createdAt, expectedRemoveAt, owner, status }`）；代码里 `isEnabled('xxx')` 引用未登记 flag → `tripod doctor` error
- **强制生命周期**：每个 flag 必须有 `expectedRemoveAt`；超期且 `status ≠ stable` → `tripod doctor` error（必须删代码 or 更新日期）；`status: stable` → warn 提示"让它成为常态"
- **判断优先级**：`tenant.featureFlags[name]`（每 tenant 覆盖）→ 配置默认值 → `false`
- **Flag 不是权限**：Flag 控制功能**是否存在**（灰度），权限控制功能**是否可用**（授权）；常见组合 `<Flag><Gate perm="..."><Button /></Gate></Flag>`
- **Kill-switch**：platform 管理后台有显式按钮；`shared-cache` 60s TTL 失效，紧急关功能生效时间 ≤ 1 分钟
- **AI 使用**：
  - 加新 flag：先在 `tripod.config.yaml` 登记 + 填 `expectedRemoveAt`（默认 6 个月）→ 再代码用 `isEnabled`
  - 删旧 flag：先确认 `status: stable` 或 `deprecated` → 删代码的 `isEnabled` 分支 → 删 config.yaml 项 → 写 patch changeset

---

## 5. 语义动作 → CLI 命令映射表

| 用户说                                                   | AI 执行                                                                                                                                                                               | 备注                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| "用 tripod 新建项目"                                     | 先问 recipe → `pnpm create tripod <name> --recipe=<r>`                                                                                                                                | 见 `tripod recipe list`                                                                                   |
| "加个门户"                                               | `tripod add-app portal`                                                                                                                                                               |                                                                                                           |
| "加个商城"                                               | `tripod add-app mall-web` + 可选 `mall-mobile`                                                                                                                                        |                                                                                                           |
| "加现场扫码移动端"                                       | `tripod add-app admin-mobile`                                                                                                                                                         |                                                                                                           |
| "加超管 / 总部 / SaaS 控制台"                            | `tripod add-app platform` + `tripod platform:seed`                                                                                                                                    |                                                                                                           |
| "不要审批流"                                             | `tripod remove workflow`                                                                                                                                                              | feature 保守 disable                                                                                      |
| "换 S3 / OSS / COS 存储"                                 | `tripod add-adapter storage.backend=s3` + 提示补 env                                                                                                                                  |                                                                                                           |
| "加微信 / OAuth / SMS 登录"                              | 新建 `adapters/auth-<provider>/` 包 + `tripod add-adapter auth.credential=<name>`                                                                                                     | 新建，非装已有                                                                                            |
| "开 MFA"                                                 | `tripod add-adapter mfa.totp=mfa-totp`（新建包）+ `tripod platform:enroll-mfa`                                                                                                        |                                                                                                           |
| "加 changeset"                                           | 读 `docs/release-rules.md` + `tripod changeset-context` + 写 `.changeset/<two-words>.md` + 告诉用户级别理由 + 等确认                                                                  | 不 commit                                                                                                 |
| "发版 / 上线"                                            | **不代跑**，提醒用户手动跑 `infra/deploy/build.sh <version>`                                                                                                                          |                                                                                                           |
| "新增订单模块 / 做个 XX 模块"                            | **按 §6 完整流程**：`/spec-driven-testing <name>` 写 spec → `generate <name>` 出测试计划 → `pnpm tripod gen:crud <name>` 脚手架 → `implement <name>` 补三层测试跑绿 → `tripod doctor` | **禁止跳 spec + test**；例外见 §6 末尾                                                                    |
| "权限不对"                                               | `tripod doctor` + 读 JWT claims + grep `*.permissions.ts`                                                                                                                             |                                                                                                           |
| "env 缺"                                                 | `tripod env:validate secrets/.env.prod` + `tripod env:doctor`                                                                                                                         |                                                                                                           |
| "起项目 / dev 环境 / 本地跑不起来"                       | `pnpm tripod dev`（自动 docker compose + migration + seed + turbo dev，**排除 mobile**，自动 tee log 到 `.tripod/logs/dev.latest.log`）；排查走 `.claude/skills/dev-startup`          | M2 一条命令起全栈；HTTP + 端口直连，无 HTTPS/反代                                                         |
| "起 HTTPS / localhost 证书 / OAuth 回调"                 | **tripod 不管 HTTPS / 反代**。提示用户自己装 mkcert + 配反代；生产证书由运维层（LB / CDN）负责                                                                                        | —                                                                                                         |
| "端口冲突 / EADDRINUSE"                                  | `pnpm tripod port:check <port>`（跨平台抹平 lsof / netstat），告诉用户进程信息，**AI 不主动 kill**                                                                                    | M2 跨平台基线 CLI                                                                                         |
| "起 mobile / Expo / EAS 发版"                            | 跳 `dev-startup` skill 的 Mobile 速查段，给命令 + 文档链接（启动：`pnpm --filter <app> start` / 发版三路线 EAS / prebuild / fastlane 由业务自选），**AI 不代跑发版**                  | mobile 不进 `tripod dev` profile，由用户手动管理                                                          |
| "重置 demo 数据"                                         | `pnpm tripod demo:reset`                                                                                                                                                              | 只重 demo，不碰 schema                                                                                    |
| "升级 tripod / 升级 shared-auth 等 @tripod-stack 包"     | `pnpm tripod upgrade`（lockstep 一起升）；不要 `pnpm up @tripod-stack/<单个>`                                                                                                         | tripod 是 lockstep 版本，所有 @tripod-stack/\* 同版本号                                                   |
| "tripod 版本漂移 / doctor 说版本不一致"                  | `pnpm tripod upgrade` 同步到最新 lockstep 版本                                                                                                                                        | —                                                                                                         |
| "发 tripod 版本 / 出新版本"（维护者）                    | `pnpm tripod release`（自动跑 smoke-test + changeset version + publish + push），**不代跑**，提示维护者本地执行                                                                       | 需 npm login + OTP；见 §部署 + 发版                                                                       |
| "smoke test / 新项目能跑吗 / 改完模板要验证"             | `pnpm tripod smoke-test [--recipe=<name>] [--from-npm] [--parallel]`                                                                                                                  | 3 recipe 跑 create + install + build + test                                                               |
| "模板 package.json 怎么写依赖"                           | `"@tripod-stack/*": "workspace:*"`，pnpm publish 自动替换为 `^<version>`                                                                                                              | 硬编码版本号触发 lint                                                                                     |
| "换 UI 库 / admin-web 换成 shadcn / mobile 换成 Tamagui" | 跑 `/swap-ui-library` skill → AI 按 mapping 文件自动替换 + smoke-test                                                                                                                 | 无需手写封装层                                                                                            |
| "改登录页样式 / 加自定义登录页"                          | 轻改（tailwind 色板）/ 中改（换子组件）/ 重改（整体替换 LoginPage，保留 `useAuth()` hook）                                                                                            | 见 `docs/templates/<app>/customization.md`                                                                |
| "加登录方式 / 开邮箱验证码 / 开微信登录"                 | 改 `tripod.config.yaml` 的 `auth.credential` 数组 + 需要 adapter 包时 `tripod add-adapter auth.credential=<name>`                                                                     | M2 默认 5 种 adapter（email-password / username-password / email-otp / magic-link / recovery-email-link） |
| "新项目需要 mall 功能 / C 端商城"                        | `pnpm create tripod <name> --recipe=erp-commerce`；自带 mall-web + mall-mobile + 支付 mock / 物流 mock                                                                                | Tier 2 接真实支付走 `tripod add-adapter payment=stripe`                                                   |
| "加新状态"                                               | 改 `<resource>.manifest.ts` + service 方法 + migration                                                                                                                                | manifest 先改                                                                                             |
| "加导出 / 加报表 / 审计要出清单"                         | 改 `<resource>.manifest.ts` 的 `exports/permissions/audits` → 建 `<resource>.export.ts`（`defineExport`）→ controller 加 `@Get('export')` → `tripod doctor`                           | **不**写自定义 SQL / PDF / 报表 DSL                                                                       |
| "建员工模块 / 加员工业务字段"                            | 走 §6 新增业务模块完整流程建 `employee` 资源；实现 `EmployeeOnboardingHook implements MembershipLifecycleHook` 接 Membership 生命周期                                                 | **不**改 `User` / `TenantMembership` 表                                                                   |
| "发邀请 / 批量邀请员工"                                  | Tenant admin 走 `POST /tenants/:tid/invitations` API；UI 随 admin-web 到 M3                                                                                                           | —                                                                                                         |
| "加定时任务"                                             | 用 `@Scheduled` 装饰器                                                                                                                                                                |                                                                                                           |
| "加灰度 / feature flag"                                  | 先在 `tripod.config.yaml` 登记 flag + 填 `expectedRemoveAt` → 代码 `isEnabled('xxx')` → `tripod doctor` 校验                                                                          | §4.12 契约                                                                                                |
| "删老 flag"                                              | 确认 `status: stable` 或 `deprecated` → 删代码 `isEnabled` 分支 → config.yaml 删项 → patch changeset                                                                                  |                                                                                                           |
| "紧急关某功能 kill-switch"                               | Platform 后台紧急按钮（shared-cache 60s TTL 生效）；不用发版                                                                                                                          |                                                                                                           |
| "加埋点 / 新业务事件"                                    | `<resource>.manifest.ts` 的 `analytics[]` 登记 → `track('<resource>.<verb>', {...})`                                                                                                  | §4.11 契约                                                                                                |
| "看埋点数据"                                             | M2 是 `analytics-null` 无数据；M3+ 接 PostHog                                                                                                                                         | Tier 2                                                                                                    |
| "给 Tenant 开功能 / 开卡 / 升配额"                       | Platform 后台或 `PATCH /platform/tenants/:id/feature-flags` / `/quotas`                                                                                                               | 需 platform admin JWT                                                                                     |
| "开新 tenant / 新公司"                                   | `POST /platform/tenants`（platform admin 身份）；自动发 tenant-admin 邀请邮件                                                                                                         |                                                                                                           |
| "API 要改字段 / 删字段 / 改语义"                         | **不改** v1，走 `tripod api-version bump <resource>` 开 v2 并存 + 老版本标 `Sunset` ≥ 6 个月                                                                                          | §4.10 契约                                                                                                |
| "加告警 / 错误要通知"                                    | 加错误码进 GlitchTip alert rule + webhook 到 shared-notification；不主动起 Alertmanager                                                                                               | M2 走 GlitchTip                                                                                           |
| "接观察栈 / Grafana / Loki"                              | 不主动做，指向 M6 升级路径                                                                                                                                                            |                                                                                                           |
| "推送通知"                                               | NotificationType `channels: ['push']`；M2 是 channel-push-null，M5 接 FCM/APNs                                                                                                        |                                                                                                           |
| "深链 / 邮件点链接打开 App"                              | `deepLinkResolver.build({type, params})` 塞邮件模板；M5 前接口 M2 已定                                                                                                                |                                                                                                           |
| "帮我写 XX / 改 XX 代码"                                 | **先读 §4.4 代码规范契约**，按协议写，写完跑 AI 自检协议 6 步                                                                                                                         | 任何代码改动都走                                                                                          |
| "修这个 lint 错 / ts 错"                                 | 逐条读错再改，禁 `--fix` 批量 / 禁 `eslint-disable` / `@ts-ignore` 绕过                                                                                                               |                                                                                                           |

未列的诉求：先跑 `tripod snapshot --json`，再问用户对齐意图。

---

## 6. 新增业务模块完整流程（Spec → 脚手架 → 测试，强制顺序）

用户说"新增 `<resource>` 资源"时，**按 Step 0 → 4 顺序执行**，不得跳步。中间不要"先写一半代码再补 spec"。

### Step 0：写 Spec（skill：spec-driven-testing）

- 触发：`/spec-driven-testing <resource>`
- 产出：`docs/specs/<resource>.md`（功能 / 角色 / 业务规则 / 状态 / 界面 / edge cases / 跨功能关联）
- 交互：skill 逐步问，AI **不代填**，等用户答；edge cases ≥ 5 个
- 若 `docs/specs/` 已有 ≥ 1 份其他 spec：跑 `/spec-driven-testing review` 跨 spec 一致性审查

### Step 1：生成测试计划

- 触发：`/spec-driven-testing generate <resource>`
- 产出：`docs/specs/<resource>.test-plan.md`
- 三轨：Track A（用户 edge case）+ Track B（`/graph-code-analysis` 代码扫描 — greenfield 自动跳过）+ Track C（spec 推导 ~40 用例）
- 合并去重后得 TC-<PREFIX>-01..NN，每个 TC 标注 `Tier: Unit | API | UI`

### Step 2：脚手架 + 8 项清单

**首选** `pnpm tripod gen:crud <resource>`（一条命令全产出）。手写必须完成：

```
[ ] 1. prisma model：<resource> 表带 tenantId / deletedAt / createdBy / createdAt / updatedAt
       + 复合索引 [tenantId, createdAt] + RLS policy
[ ] 2. <resource>.manifest.ts（§8）：states / transitions / permissions / audits / notifications
[ ] 3. <resource>.permissions.ts：PAGE / ACTION / DATA_SCOPE 节点
[ ] 4. <resource>.service.ts：state 转换方法 + 显式 audit.log() + dto 脱敏
[ ] 5. <resource>.controller.ts：@RequirePermission / @Idempotent（写操作）
[ ] 6. 若涉通知：<resource>.notification-types.ts + 模板 key
[ ] 7. 若有业务错误：shared-types/error-codes.ts 枚举 + shared-i18n/locales/*/errors.json 翻译
[ ] 8. 若有状态机：prisma 加 {Entity}StateHistory 表 + state 字段 + stateVersion 列
[ ] 9. 若涉导出：<resource>.export.ts（defineExport）+ controller `@Get('export')` + manifest.exports[] + permissions 加 `<r>:export`（ACTION）+ audits 加 `<r>.exported`
```

Spec 里的 `BR-NNN`（业务规则）与 `F-NNN`（功能清单）→ 必落到 `<resource>.manifest.ts` 的 `states / transitions / permissions / audits`。AI 做完 gen:crud 后**反查**：每条 BR 对应代码里哪一行，缺漏当场补。

### Step 3：生成测试代码 + 跑绿（skill：spec-driven-testing）

- 触发：`/spec-driven-testing implement <resource>`（默认三层都出；也可 `implement <name> unit|api|ui` 按需）
- 产出：
  - Unit：Vitest（tripod 默认）— 路径 `apps/server/src/<resource>/*.spec.ts` 或 pattern 文件约定处
  - API E2E：Playwright — 路径 `tests/api/<resource>.spec.ts`
  - UI E2E：Playwright — 路径 `tests/ui/<resource>.spec.ts`
- **强制闭环**：`pnpm test` 必须全绿。失败 TC **禁止**删除或 `.skip`；只改实现让它过，不改测试让它让路
- 多租户测试走 `shared-test` 的 `createTestTenant` fixture（见 plan-full §shared-test）

### Step 4：一致性自检

- `tripod doctor` 全绿（manifest ↔ 代码 ↔ migration ↔ env 四方一致）
- `pnpm lint` / `typecheck` 全绿（AI 自检协议 §4.4 的六步）
- `git status` 自查：spec / test-plan / migration / 业务代码 / 测试五类文件都在，缺一不完成

### 跳步条件（仅这三种，其他必走全流程）

- 纯内部脚本 / 一次性 migration 修复 / 纯文档 PR — 不算"业务模块"，不生成长期测试
- 用户明确说"这一版不写测试 / 先跳过测试"— 必须在 commit message + PR description 记录，下一版补回
- 改动只改已有模块**样式 / 文案 / 本地化**，不改行为 — 可跳 Step 0-1，直接走已有测试回归

**新增字段清单**：见 plan-full §CLAUDE.md 完整内容规范 §4
**新增 env 清单**：见 plan-full §CLAUDE.md 完整内容规范 §5
**skill 渐进式加载细节**：见 `.claude/skills/spec-driven-testing/SKILL.md`

---

## 6.1 何时问用户 vs 直接做

AI 容易两头偏（要么事事问打断节奏，要么默默做越界）。固定判断规则：

### 直接做（不问）

- 查代码 / 读文件 / grep / 跑 `tripod snapshot` 等**只读操作**
- 补缺的 `<resource>.manifest.ts`（根据 service 反向生成）
- 修复 `unaligned[].severity === 'error'` 的不一致（snapshot 已指明）
- 改单个文件里的**类型错误 / 字面量 typo / import 缺失**
- 按 §6 八项清单执行 `gen:crud <resource>`（用户已说要新建模块）
- 按 §4.3 流程补错误码 + 翻译（用户已说要抛这个错）
- 失败剧本 §9 里可自动诊断并修复的项
- **写完代码跑 AI 自检协议 6 步**（lint + typecheck），发现违规自己修

### 先问（等用户拍板）

- 任何涉及 Anti-patterns 的能力补充（即便你觉得"应该有"）
- Recipe 选择（`minimal` / `erp-standard` / `erp-commerce`）—— 问业务形态再决定
- 加新的 app type（portal / mall / mobile / platform）—— 确认是否真要加
- 加新 adapter（尤其是 Tier 2 外的 adapter 包 = 需要新建包）
- 删除 / disable feature / app —— 即便用户说"不要 X"也要确认范围（全删？保留代码？保留表？）
- 多 membership 用户的业务默认 tenant 选择
- 涉及真实钱 / 库存 / 发货 / 支付的状态转换逻辑
- 发版级别（patch / minor / major）—— changeset 起草后给用户看
- 破坏性 DB 迁移（删列 / 改类型 / rename 表）
- 改 Anti-patterns 章节本身 —— 永远先问
- 任何 `git push` / `docker compose up` / 部署命令

### 提醒用户手动做（不代跑）

- `infra/deploy/build.sh <version>` 发版
- `git push` 所有推送
- `prisma migrate deploy` 生产迁移
- `tripod platform:seed` 创建超管（要用户提供 email + 密码）
- `docker compose up -d` 起开发环境（用户自己决定节奏）

### 做之前声明

AI 在执行**多文件改动**（≥3 个文件）前，**先**用一句话声明要做什么：

> "我要执行 8 项清单的前 4 项：prisma model + manifest.ts + permissions.ts + service。完成后一次性给你 diff。"

然后做。中途不过问，除非遇到"先问"类的决策点。

---

## 7. Hot-spot 文件规则

CLI 唯一会自动写的 TS 文件：

| 文件                                           | 标记                                       |
| ---------------------------------------------- | ------------------------------------------ |
| `apps/server/src/app.module.ts`                | `tripod:imports` + `tripod:module-imports` |
| `prisma/seed.ts`                               | `tripod:seed-calls`                        |
| `packages/shared-config/src/env.schema.ts`     | `tripod:env-fields`                        |
| `packages/shared-auth/src/strategies/index.ts` | `tripod:credential-providers`              |

- AI 改代码**不得删** `tripod:*-start` / `tripod:*-end` 标记
- 标记**之间**：CLI 自动写入区
- 标记**之外**：用户手写代码区
- 标记丢失：`tripod repair <file>`，不要硬写
- 其他 TS 文件 CLI 永不自动写，AI 可正常编辑

---

## 8. 业务模块 manifest.ts 契约

每个资源 `<resource>` 在 `apps/server/src/<resource>/<resource>.manifest.ts` 配声明文件。**运行时零开销**，只是 AI 索引卡。

```ts
import { defineModuleManifest } from '@tripod-stack/shared-contract';

export const SALES_ORDER_MANIFEST = defineModuleManifest({
  resource: 'sales-order',
  displayName: '销售订单',
  states: ['draft', 'pending-approval', 'approved', 'picking', 'packed', 'shipped', 'completed'],
  transitions: [
    { from: 'draft', event: 'SUBMIT', to: 'pending-approval' },
    {
      from: 'pending-approval',
      event: 'APPROVE',
      to: 'approved',
      permission: 'sales-order:approve',
    },
  ],
  permissions: [
    { id: 'sales-order:list-page', type: 'PAGE' },
    { id: 'sales-order:read-all', type: 'ACTION' },
    { id: 'sales-order:read-own', type: 'DATA_SCOPE' },
    { id: 'sales-order:approve', type: 'ACTION' },
    { id: 'sales-order:read-cost', type: 'ACTION', sensitive: true },
  ],
  audits: ['submitted', 'approved', 'rejected', 'picked', 'shipped', 'exported'],
  notifications: ['sales-order:approved', 'sales-order:shipped'],
  exports: ['sales-order'], // 资源支持导出（defineExport 注册）
  relatedEntities: ['sku', 'customer', 'warehouse'],
  sensitiveFields: [{ field: 'costPrice', requires: 'sales-order:read-cost' }],
});
```

**AI 读模块的固定顺序**：

1. `<resource>.manifest.ts` — 建立全局认知
2. `<resource>.permissions.ts` — 详细权限节点
3. `<resource>.service.ts` — 业务方法
4. `<resource>.controller.ts` — HTTP 入口

**manifest 缺失时**：AI 第一步补 manifest（grep service 反向生成），不是直接回答用户问题。

**一致性**：`tripod doctor` 检查 manifest 与真实代码（service 里的 `state: '<x>'` 字符串 / permissions.ts / notification-types.ts）是否一致。

---

## 9. 失败剧本（CLI 报错时）

| 症状                                            | 诊断                          | 修复                                                                 |
| ----------------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `tripod add-app X` 报 hot-spot 缺失             | `tripod doctor`               | `tripod repair <file>` 或 `docs/manual-patches/<action>.md` 手工接入 |
| `tripod doctor` 报 disabled feature 还被 import | 读 `snapshot.unaligned[]`     | 找到并注释对应 import                                                |
| `tripod env:validate` 失败                      | 读 missing / invalid 列表     | 补 `secrets/.env.prod`；字段源 `shared-config/src/env.ts`            |
| `pnpm dev` 崩 "DATABASE_URL missing"            | `tripod env:validate`         | `cp infra/deploy/.env.prod.example .env.local` 填本地值              |
| prisma migrate 报 column 不存在                 | `git log` 看是否有人直接改 DB | 让用户 `prisma migrate resolve`，**不要**自己 `db push`              |
| `tripod add-adapter X=Y` 报 adapter 不存在      | 检查 `adapters/<Y>/`          | Anti-patterns 规定 Tier 2 adapter 不预登记 → AI 先新建包骨架         |

---

## 10. `tripod snapshot --json` 输出 schema（要点）

完整 schema 见 plan-full §CLI 章节。AI 使用规则：

- 每次会话**第一**个 tool call 是 `tripod snapshot --json`
- `unaligned[].severity === 'error'` 先解决再处理用户任务
- `modules[*].hasManifest === false` + 用户任务涉及该模块：先补 manifest
- 同会话内文件无改动则不重跑；有改动后刷新

关键字段：

- `config`：当前 apps / features / adapters / disabled 三态
- `env`：missing / invalid / warnings / optionalUnset（**不输出实际值**）
- `hotSpots`：4 份文件各标记的 ok 状态
- `prisma`：pendingMigrations / driftDetected / lastMigration
- `modules[]`：每个资源的 hasManifest / manifestConsistent / states / permissions 数
- `unaligned[]`：所有不一致（error 在前，warn 在后）
- `nextActions[]`：≤5 条推荐下一步

---

## 11. 技术栈决策（一张表）

### 固化（无 adapter，换 = 架构层变更，AI **不要幻想换**）

| 层                | 选型                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Backend           | NestJS + Prisma + Postgres + Redis + BullMQ                                                         |
| Web               | React 19 + Vite                                                                                     |
| Portal / Mall-Web | Next.js 15                                                                                          |
| Mobile            | Expo SDK 52+（New Architecture）+ NativeWind                                                        |
| 业务状态          | Zustand                                                                                             |
| 服务端态          | TanStack Query                                                                                      |
| 表单              | React Hook Form + Zod                                                                               |
| API 风格          | REST + OpenAPI（orval codegen）                                                                     |
| HTTP client       | axios（shared-api-client 包装）                                                                     |
| 时间 / 金额       | dayjs (utc / timezone / customParseFormat / relativeTime) / decimal.js                              |
| 鉴权              | Access JWT 15min + Refresh 轮换（家族 + 重放检测）                                                  |
| 日志库            | Pino → stdout                                                                                       |
| Scheduler         | @nestjs/schedule                                                                                    |
| 部署              | Docker Compose + 本地构建 scp + SSH load（**无 CI、无 HTTPS / 反代接入**，运维层负责）              |
| Monorepo          | pnpm + Turborepo + Changesets（lockstep）                                                           |
| 合入门槛          | husky pre-commit (lint-staged + gitleaks) + pre-push (lint + typecheck + test + build)；**不做 CI** |
| APM               | OTEL 代码插桩，`OTEL_ENDPOINT` 可空                                                                 |
| 测试              | Vitest + Testing Library + Playwright                                                               |
| Mobile 密钥存储   | expo-secure-store（Keychain / Keystore）                                                            |

### 中间类：UI 库（默认 + 可换，`/swap-ui-library` skill 辅助）

| App 类型                   | 默认 UI 库          |
| -------------------------- | ------------------- |
| admin-web / platform       | **AntD 5**          |
| portal / mall-web          | **shadcn/ui**       |
| admin-mobile / mall-mobile | **Gluestack UI v2** |

业务换库：跑 `/swap-ui-library` skill（web 三栈互换 + mobile 三栈互换有完整映射文档）。

### Adapter（接口稳定，换实现 = 零业务代码改动）

| 能力            | 接口                                    | M2 ★                                                                | Tier 2 ☆                                                                                                                                                 |
| --------------- | --------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 凭证登录        | `CredentialProvider`                    | email-password / username-password / **email-otp** / **magic-link** | oauth-google / oauth-apple / oauth-line（日本）/ oauth-microsoft / oauth-github / sms（Twilio）/ sso-saml / passkey（中国次级：oauth-wechat / oauth-qq） |
| Session 策略    | `SessionPolicy`                         | MaxDevicesPolicy / SingleGlobalPolicy                               | PerAppPolicy                                                                                                                                             |
| 密码恢复        | `RecoveryProvider`                      | recovery-email-link                                                 | recovery-sms（Twilio）/ recovery-security-question                                                                                                       |
| MFA             | `MfaProvider`                           | 接口 M2 / 实现 M6                                                   | totp / webauthn                                                                                                                                          |
| 存储            | `StorageProvider`                       | storage-local                                                       | s3（AWS）/ gcs / r2（Cloudflare）/ azure-blob / minio（中国次级：oss / cos）                                                                             |
| 通知通道        | `ChannelProvider`                       | email-smtp / realtime-sse                                           | sms（Twilio / AWS SNS）/ slack / discord / microsoft-teams / line-notify / webhook（中国次级：wecom / dingtalk / feishu）                                |
| 实时通道        | `RealtimeChannel`                       | realtime-sse                                                        | websocket / mqtt                                                                                                                                         |
| 错误上报        | `ErrorReporter`                         | glitchtip                                                           | sentry-saas / rollbar / datadog                                                                                                                          |
| i18n 后端       | `I18nBackend`                           | i18n-file（4 语言 JSON：**en-US 默认** / ja-JP / zh-CN / zh-TW）    | tolgee / crowdin / lokalise / phrase                                                                                                                     |
| 审计后端        | `AuditBackend`                          | audit-postgres                                                      | clickhouse / elasticsearch                                                                                                                               |
| 缓存            | `CacheProvider`                         | cache-redis                                                         | in-memory / memcached                                                                                                                                    |
| 前端埋点        | `AnalyticsProvider`                     | analytics-null                                                      | posthog / mixpanel / amplitude / ga4 / segment                                                                                                           |
| Feature flag    | `FeatureFlagProvider`                   | flag-local（DB + config.yaml）                                      | unleash / launchdarkly / flagsmith                                                                                                                       |
| Mobile Push     | `PushProvider`（接口 M2 / 实现 M5）     | push-null（M2）                                                     | fcm / apns / expo-push / onesignal / airship（中国次级：jiguang / unified-push）                                                                         |
| Mobile DeepLink | `DeepLinkResolver`（接口 M2 / 实现 M5） | —                                                                   | universal-link / app-link / 自定义 scheme / branch.io                                                                                                    |
| 支付（mall）    | `PaymentProvider`                       | **payment-mock**                                                    | 美国：stripe / paypal / braintree / square；日本：komoju / pay.jp / line-pay / paypay / rakuten-pay（中国次级：alipay / wechat-pay）                     |
| 物流（mall）    | `ShippingProvider`                      | **shipping-mock**                                                   | 美国：shippo / easypost / usps / ups / fedex；日本：yamato / sagawa / japan-post（中国次级：sf / zto / yt）                                              |
| 搜索（mall）    | `SearchProvider`                        | pg-fulltext                                                         | meilisearch / elasticsearch / algolia / typesense                                                                                                        |
| Secrets         | `SecretsProvider`                       | local-dotenv                                                        | sops / vault / doppler / aws-secrets-manager                                                                                                             |
| K8s 部署        | —                                       | docker-compose                                                      | k8s-helm-chart                                                                                                                                           |

**判据**：固化项换 = 重写大模块或整个 app；adapter 项换 = 对应 SaaS / 云服务供应商替换，属基建层常见需求。详细论证 / Python 补位：见 plan-full §技术栈决策 §固化 vs Adapter 分界。

---

## 12. 仓库结构（最简版）

```
tripod/
├── apps/                     server（必装）/ admin-web(默认) / platform / admin-mobile / portal / mall-web / mall-mobile / cli（按需）
├── packages/                 shared-* 28 个基建包（见下：contract / config / types / api-client / notify / security / auth / permission / workflow / storage / notification / realtime / audit / cache / scheduler / logger / i18n / utils / feature-flag / analytics / deeplink / export / test / theme / web-ui / mobile-ui / payment / cart / promotion / shipping）
├── adapters/                 只登记 M2 ★（auth / storage / notification / realtime / i18n / error-reporting / audit / analytics / feature-flag 各 1-3 个）
├── infra/                    docker / compose / deploy / db-scripts / backup / mobile-selfhost(Tier 2)
├── secrets/                  ⭐ 仅本地，gitignore
├── .claude/                  ⭐ 随模板分发，`pnpm create tripod` 按 recipe 裁剪后拷到新项目
│   └── skills/                ⚠️ 扁平结构（Claude Code 不递归扫描），namespace 由 manifest.yaml 维护
│       ├── manifest.yaml      ⭐ skill 注册表 + 时间戳真相源（addedAt / lastReviewedAt / lastActivatedAt / deprecatedAt）
│       ├── skill-rules.json   ⭐ skill-activation-prompt hook 触发词表
│       ├── README.md          ⭐ namespace 推导规则 + category 分类
│       ├── spec-driven-testing/    Spec → 三轨测试计划 → 三层测试代码（TDD 官方流程）
│       ├── graph-code-analysis/    图论代码分析（spec-driven-testing 的 Track B 依赖）
│       ├── dev-startup/            一键起全栈 + 常见问题排查引导
│       ├── skill-manager/          ⭐ M2 新增：skill 生命周期管理（加 / 改 / 删 / audit / 决策树）
│       └── adapter-author/         ⭐ M2 新增：引导新建 adapter 包（18 接口 + 7 步流程 + Stripe worked example）
│       # swap-ui-library 在 M2 暂不交付（低频换库 + 8 个 mapping ROI 低），详见 plan-full §swap-ui-library skill 详细设计 头部标注
├── docs/
│   ├── specs/                ⭐ 业务需求 spec + 测试计划（spec-driven-testing 产出地）
│   ├── release-rules.md
│   └── deployment.md
├── plans/
│   ├── tripod-core.md        ⭐ AI 日常加载
│   └── mobile-react-19-x-mobile-encapsulated-quokka.md    详细设计档案
└── CLAUDE.md                 AI 行为指令（= plan-full §CLAUDE.md 完整内容规范的固化副本）
```

**`.claude/skills/` 分发规则**：

- tripod 模板仓库维护 `.claude/skills/`，版本随 `@tripod-stack/templates` 发
- `pnpm create tripod <name>` **按 recipe 裁剪 skill 子集**（按 `manifest.yaml.skills.<name>.category` 字段过滤；recipe 不含 mobile → 不拷 `category: mobile` 的 skill），把 `.claude/skills/` 拷到新项目根（与 `apps/` / `packages/` 同级），不经 patch 引擎
- 新项目 clone 后 Claude Code 自动识别 `.claude/skills/`，所有 skill 即时可用
- `tripod sync --skills-only`（Tier 2）拉最新模板 skill 回流，**只覆写 `namespace: template` 的条目**（从 `manifest.yaml` 读判定，不依赖目录名）；`vendor` / `custom` 的条目永不动

**Skill 系统三件套**（M2 交付）：

| 组件                                                         | 职责                                                                                                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.yaml`                                              | 注册表 + 4 时间戳真相源 + **namespace 唯一 source of truth** + trust（仅 vendor 必填，template/custom 硬约定推导）+ category                                                                |
| `skill-rules.json`                                           | hook 触发词表（每个 skill 一条 keywords + intentPatterns）                                                                                                                                  |
| `tripod skill:{new,install,relabel,upgrade,uninstall,audit}` | skill 生命周期 CLI：`skill:new` 建 custom / `skill:install <url>` 装 vendor / `skill:relabel` 修 orphan 身份 / `skill:audit --auto` pre-commit 自动登记孤儿（保守默认 custom+experimental） |

**namespace 推导规则**（零手工维护 + 零冗余）：

| 信息         | source of truth                                                                                                                            | 如何获取                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `namespace`  | `manifest.yaml.skills.<name>.namespace`                                                                                                    | 读 manifest（唯一真源；目录名无命名前缀约束） |
| `trust`      | template → 硬约定 `official`<br>vendor → `manifest.yaml.skills.<name>.trust` + `<dir>/source.yaml.trust`<br>custom → 硬约定 `experimental` | audit 时按 namespace 分发推导                 |
| `revision`   | `git log --oneline <dir> \| wc -l`（template/custom）<br>`source.yaml.ref`（vendor）                                                       | 不入库，audit 展示时派生                      |
| `updated-on` | `git log -1 --format=%cs <dir>`（template/custom）<br>`source.yaml.installedAt`（vendor）                                                  | 不入库，audit 展示时派生                      |

**为什么去掉目录前缀约束**：改目录名代价高（`git mv` + 引用更新），改 manifest 字段代价低（一行）；用户意外 copy 不会因"忘改前缀"误判，`skill:audit --auto` 保守登记为 custom+experimental，用户一条 `skill:relabel` 修正到 vendor+community。

**category 取值**：`global` / `server` / `web` / `nextjs` / `mobile` / `cli` / `shared` / `cross-stack` — 决定 recipe 裁剪。

**详细机制**：见 plan-full §Skill 分发机制。业务团队加 skill → 跑 `skill-manager` skill 引导。

**shared-\* 包职责（各一句）**：

| 包                    | 职责                                                                                                                                                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared-contract`     | HTTP envelope + 错误码 + 分页排序筛选 + `defineModuleManifest`                                                                                                                                                                                                          |
| `shared-config`       | Zod env schema（启动 fail-fast）                                                                                                                                                                                                                                        |
| `shared-types`        | 错误码枚举 + DTO                                                                                                                                                                                                                                                        |
| `shared-api-client`   | axios + 全局错误拦截 + 重试                                                                                                                                                                                                                                             |
| `shared-notify`       | UI 无关提示接口（各 app 注册 transport）                                                                                                                                                                                                                                |
| `shared-security`     | CORS / Helmet / body-limit                                                                                                                                                                                                                                              |
| `shared-auth`         | Credential / Session / MFA / Recovery                                                                                                                                                                                                                                   |
| `shared-permission`   | PermissionNode 3 type + Guard                                                                                                                                                                                                                                           |
| `shared-workflow`     | state history 查询（转换由业务 service 自己写）                                                                                                                                                                                                                         |
| `shared-storage`      | StorageProvider + 单次 ≤100MB 上传                                                                                                                                                                                                                                      |
| `shared-notification` | NotificationType + ChannelProvider                                                                                                                                                                                                                                      |
| `shared-realtime`     | RealtimeChannel（SSE 默认）                                                                                                                                                                                                                                             |
| `shared-audit`        | BusinessAuditLog 单表 + CorrelationContext                                                                                                                                                                                                                              |
| `shared-export`       | 业务报表导出（CSV/XLSX 流式）+ defineExport 声明                                                                                                                                                                                                                        |
| `shared-cache`        | CacheProvider + `@Cacheable`                                                                                                                                                                                                                                            |
| `shared-scheduler`    | 定时任务 + 分布式锁                                                                                                                                                                                                                                                     |
| `shared-logger`       | Pino + Sentry SDK + OTEL 插桩（endpoint 可空）                                                                                                                                                                                                                          |
| `shared-i18n`         | i18next + `formatDate(dayjs)` + `formatMoney(Decimal)` + `formatQuantity(Decimal)`                                                                                                                                                                                      |
| `shared-utils`        | **M2**：`dayjs` 统一 init（utc/timezone/customParseFormat/relativeTime 插件）+ `Decimal` 常用包装（toDecimal / zero / one）+ tenant 时区 helper（`startOfTenantDay` / `dayOf` / `formatTenantDate`）+ 通用 helper                                                       |
| `shared-test`         | Factories + MSW                                                                                                                                                                                                                                                         |
| `shared-feature-flag` | FeatureFlagProvider + LocalFlagProvider（DB + config.yaml）+ 前端 Flag 组件 + doctor 生命周期检查                                                                                                                                                                       |
| `shared-analytics`    | AnalyticsProvider + null impl + useAnalytics / usePageTracking / TrackButton + gen:crud 自动埋点                                                                                                                                                                        |
| `shared-deeplink`     | DeepLinkResolver + DeepLinkRegistry（M2 接口，M5 真实现）                                                                                                                                                                                                               |
| `shared-web-ui`       | **M2**：UI 库无关的逻辑组件 + hook（`<Gate>` / `<Flag>` / `<RouteGuard>` / `<ErrorBoundary>` + `useAuth` / `useNotifications` / `useAnalytics` / `useFeatureFlag` / `useTheme` / api-client-setup）— 不含 Login 页 / Layout 等 UI 重组件（各 app 自己用自己的 UI 库写） |
| `shared-mobile-ui`    | **M2**：同 shared-web-ui 策略，RN 逻辑组件 + hook（`useScanner` / `usePushRegistration` / `useDeepLink` / `useMobileAuth` / 等）                                                                                                                                        |
| `shared-theme`        | **M2**：theme token（light / dark + tenant 色板）+ `useTheme` hook                                                                                                                                                                                                      |
| `shared-payment`      | **M2**：PaymentProvider 接口 + `payment-mock` adapter（mall / 支付业务用）                                                                                                                                                                                              |
| `shared-cart`         | **M2**：购物车合并 helper（guest → user cart merge）+ 库存预占时效（mall 用）                                                                                                                                                                                           |
| `shared-promotion`    | **M2**：优惠券 / 折扣引擎（mall 用，Tier 2 扩展复杂规则）                                                                                                                                                                                                               |
| `shared-shipping`     | **M2**：ShippingProvider 接口 + `shipping-mock` adapter（mall 物流用）                                                                                                                                                                                                  |

**开发配置包**（不是运行时基建，每个项目必装）：

| 包                       | 职责                                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| `eslint-config-tripod`   | ESLint preset（base / react / next / nest / rn 五个子配置 + tripod 自定义规则） |
| `prettier-config-tripod` | Prettier preset                                                                 |
| `tsconfig-tripod`        | tsconfig base（`base.json` / `react.json` / `nest.json` / `rn.json`）           |

完整仓库树（含 app 模板 / Tier 2 激活路径 / k8s）见 plan-full §整体架构。

---

## 13. 里程碑（一句话版）

- **M1**：Monorepo + NestJS 骨架 + 多租户地基（Prisma middleware + RLS + Tenant/User/Membership + featureFlags JSON + quotas JSON）+ admin-web 最简 SPA + tripod CLI 基础层（create / status / snapshot / recipe / validate）+ CLAUDE.md 骨架 + Magic Comment 预置 + **`.claude/skills/` 分发**（spec-driven-testing + graph-code-analysis + dev-startup 随模板拷入）+ `docs/specs/` 目录
- **M2**：鉴权（**5 种 auth adapter**：email-password / username-password / **email-otp** / **magic-link** / recovery-email-link，业务按 `tripod.config.yaml` 组合启用；Session 双存储 cookie + header 前置 Mobile）+ 权限（3 type + own/all，前端 `<Gate>` / PAGE 菜单过滤 / DATA_SCOPE 后端过滤）+ 工作流 / 存储 / 通知（SMTP + SSE + channel-push null 占位）/ 审计 / i18n（4 语言：**en-US 默认** / ja-JP / zh-CN / zh-TW + tenant 时区）/ 观察栈（GlitchTip + OTEL + Pino + redaction + 最小 alert）/ shared-contract（错误码 + HTTP status 映射 + 分页上限 + API 版本化 /api/v1）/ security（健康检查 + 优雅关停）/ cache / scheduler / export / utils / test / feature-flag / analytics / deeplink + 软删除 + 邀请制 + Platform app（不进默认 recipe）+ Mobile 接口前置（PushProvider / DeepLinkResolver / MobileSecureStorage）+ 部署骨架（无 CI，**mobile 不进 changeset / `tripod release` 自动流程**，由业务手动跑 EAS / prebuild / fastlane）+ Changesets（lockstep）+ DB 备份 + PR 模板 + `tripod dev`（**Node tee log 跨平台 + 排除 mobile**）+ husky hook 门槛（含 `tripod skill:audit --auto` pre-commit 自动登记孤儿 skill）+ **7 种 app 模板开箱骨架**（server 13 module / admin-web 11 页 AntD 5 / platform 15 页 AntD 5 / admin-mobile 9 屏 Gluestack UI v2 / portal / mall-web / mall-mobile）+ **新增 shared 包**：`shared-web-ui` + `shared-mobile-ui`（UI 库无关逻辑 + hook，原 M3+ 提前）+ `shared-payment` + `shared-cart` + `shared-promotion` + `shared-shipping`（mall 基础）+ **新增 skill**：`skill-manager`（skill 生命周期管理）+ `dev-startup` + `adapter-author`（18 接口 + 7 步新建 adapter 流程 + Stripe worked example）（`swap-ui-library` 设计保留但 M2 不交付，详见 plan-full §swap-ui-library skill 详细设计） + **Skill 系统三件套**：`manifest.yaml`（4 时间戳 + **namespace 唯一登记点** + trust 仅 vendor / category）+ `skill-rules.json`（hook 触发词表）+ 5 个生命周期 CLI（`skill:new` / `skill:install` / `skill:relabel` / `skill:upgrade` / `skill:uninstall`）+ `skill:audit [--auto\|--fix]`（pre-commit 孤儿登记默认 custom+experimental）+ namespace 推导规则（零手工维护：template/custom→git log、vendor→source.yaml；目录名无前缀约束）+ **新增跨平台 CLI**：`tripod port:check <port>`（抹平 lsof / netstat）+ **配对文档** `docs/templates/<type>/{README, components, pages, customization, testing}.md`
- **M3**：UI 库决策 + `BasePage/List/Form` + `gen:crud` 产出 UI 代码 + storage-oss/cos + platform UI（tenant 管理 + feature flag + 健康 dashboard）+ analytics PostHog 接入
- **M4**：门户（Next.js 15 + App Router + SEO）
- **M5**：Mobile（Expo + EAS Build/Update + push-fcm/apns adapter 实现 + deeplink 真实注册 + expo-secure-store）
- **M6**：MFA 实现 / 主题系统 / 观察栈升级（Prometheus + Alertmanager）/ 冷数据归档 / K8s adapter / Secrets 外置方案 / 计费 / SSO-SAML

每个 milestone 的验收条见 plan-full §里程碑。

---

## 14. 深究 plan-full 的索引

AI 需要细节时按主题查：

- 多租户 schema / 两阶段登录 / 四入口物理分离：plan-full §多租户架构
- **Platform 模块能力 / tenant 生命周期 / 配额 / impersonate / platform-admin vs tenant-admin**：§Platform 模块能力清单
- 鉴权 Provider / Session Policy / Token 轮换 / MFA 接口 / **Session 双存储（cookie + header 对 Mobile）**：§鉴权体系详细设计
- 权限模型 / 3 type / JWT claims / ScopeBuilder 反例 / **前端 `<Gate>` + 路由守卫 + 敏感字段**：§权限体系详细设计
- Workflow state + history + 事务示例：§工作流引擎详细设计
- StorageProvider 接口 / local+s3 实现 / 验收条：§存储体系详细设计
- NotificationType / ChannelProvider / SSE 频道约定：§通知 / 推送体系详细设计
- BusinessAuditLog 单表 schema / CorrelationContext：§业务审计日志体系
- shared-contract / shared-notify / shared-security / 限流 / **健康检查三 probe + SIGTERM 6 步**：§通用基建层详细设计
- **错误码命名规范 + HTTP status 映射 + 翻译 4 语言强制**：§shared-contract §错误码命名规范
- **分页硬约束 + cursor 分页 + paginate helper**：§shared-contract §分页/排序/筛选统一 Query 语法
- **API 版本化策略（URL /v1 + Deprecation + Sunset + v1/v2 controller 并存）**：§shared-contract §API 版本化策略
- **Idempotency `@Idempotent()` 完整实现**（SETNX / Redis key / 回放 / in-flight）：§shared-contract §Idempotency 实现细节
- **日志级别语义 + redaction 默认清单 + request log 字段**：§shared-logger §结构化日志
- **时区契约 + tenant.timezone + dayjs helper**：§i18n §时区
- **软删除 opt-in + 部分索引 + 恢复 API + 回收站**：§通用基建层 §软删除约定
- **DB 备份 pg-backup.sh + RPO/RTO + 每周验证 + 恢复 runbook**：§部署 + 发版 §DB 备份策略
- **PR 模板 + Code Review Checklist + 合入门槛（husky hook，无 CI）**：§部署 + 发版 §合入门槛 / §PR 模板
- **M2 最小告警（GlitchTip alert rules + shared-notification webhook）**：§错误上报 / 观察性 §M2 最小告警
- **前端埋点 AnalyticsProvider + gen:crud 自动埋点 + 命名规范**：§前端埋点 / 用户行为分析
- **Feature Flag（Tenant.featureFlags + 生命周期 + tripod doctor 校验 + kill-switch）**：§Feature Flag / 灰度机制
- **Mobile 基建接口（PushProvider / DeepLinkResolver / MobileSecureStorage + channel-push + Session 双存储）**：§Mobile 基建接口（M2 前置，M5 实现）
- **开发体验（tripod dev 一键全栈 + demo tenant seed + HTTP 端口直连）**：§开发体验 / 本地环境启动
- **Recipe 预置业务模型（erp-standard / erp-commerce 领域清单）**：§Tripod CLI §Recipe 预置业务领域模型
- **固化 vs Adapter 分界表**：§技术栈决策 §固化 vs Adapter 分界
- **自托管边界声明（什么是 tripod 范围、什么是业务 adapter）**：§自托管边界声明
- **模板交付总原则（逻辑 adapter 完整 + UI 基础可替换 + AI 友好文档）**：§模板交付总原则
- **7 种 app 模板完整交付清单**：§7 种 App 模板完整交付清单
- **配对文档模板（docs/templates/<type>/\*.md）**：§7 种 App 模板完整交付清单 §每种 app 模板的配对文档
- **登录方式组合（5 种 M2 auth adapter + LoginPage 动态渲染）**：§鉴权体系详细设计 §Adapter 包清单 + §LoginPage 基础骨架设计
- **swap-ui-library skill**（AI 换 UI 库 web/mobile 三栈互换映射）：§Spec 驱动 TDD §Skill 分发机制 §swap-ui-library skill 详细设计
- 部署 build.sh / env:validate / Changesets / AI changeset-context / Secrets 本地维护：§部署 + 发版详细设计
- **npm 发版流程（`tripod release` / npm login + OTP / dry-run / 失败 72h unpublish）**：§部署 + 发版 §发版动作：`pnpm tripod release` 封装
- **Changesets lockstep 配置 + `tripod upgrade` 防漂移**：§部署 + 发版 §版本管理
- **模板依赖 workspace:\* + pnpm publish 自动替换 + lockfile 三层策略**：§Tripod CLI §包分发
- **模板 smoke test（`pnpm tripod smoke-test` 三 recipe 跑通）**：§部署 + 发版 §模板 smoke test
- **`create-tripod` 瘦跳板 bootstrap 实现**：§Tripod CLI §包分发
- Tripod CLI 25 条命令 / manifest.yaml schema / 三层防御 / generators:：§Tripod CLI 与项目配置体系
- `tripod snapshot --json` 完整 schema：§CLI 章节的 "tripod snapshot（AI 全景入口）" 小节
- `defineModuleManifest` 完整 schema：§shared-contract 的 "defineModuleManifest" 小节
- **代码规范完整配置** / ESLint 自定义规则源码 / 各框架展开：§代码规范详细设计
- **Spec 驱动 TDD 工作流** / skill 如何随模板分发 / docs/specs 目录契约：§Spec 驱动 TDD 工作流

---

## 15. 本文件维护规则

- 本文件与 plan-full 的关系：本文件是摘要，**不能**与 plan-full 矛盾。发现矛盾时优先信任 plan-full + 代码，并同步改本文件
- 用户改契约（加/砍功能 / 调 recipe / 换技术栈）时：AI 先改 plan-full，再同步改本文件相关章节，最后刷 `CLAUDE.md`
- 本文件行数目标 **≤1100 行**（AI 首加载成本可控）。超过时砍最细的内容挪到 plan-full
- 禁止在本文件里贴大段代码（>20 行）。示例代码放 plan-full
- **§4.x 编码契约是例外** — §4.1-§4.12 硬规则清单（多租户 / correlationId / 错误码 / 代码规范 / 健康检查 / 日志 / 软删除 / 分页 / 时区 / API 版本化 / 埋点 / Feature flag）密度高，行数占比大但必须在 core（AI 写代码前读）
