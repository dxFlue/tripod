# Tripod 阶段完成日志

append-only 日志。每阶段完成时追加一节：commit SHA / 交付产物 / 验收结果 / 关键决策 / 已知问题。

---

## Stage 0 — 仓库骨架 + 开发配置包 + dev 环境 {#stage-0}

**完成时间**：2026-04-22
**Commit**：`d3e16e5 chore: bootstrap tripod monorepo skeleton (stage 0)`
**变更统计**：60 文件 new；`package.json` / `pnpm-lock.yaml` / `turbo.json` / `.gitignore` / `.gitleaks.toml` / `.eslintignore` 等全量新建

### 交付产物

| 类型         | 内容                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 仓库骨架     | git 初始化（main 分支）+ pnpm workspace 3 子目录（`apps/` / `packages/` / `adapters/`）+ 顶层 `infra/` / `docs/` / `secrets/` / `plans/` / `.claude/`              |
| 配置包（4）  | `@tripod-stack/tsconfig`（base/react/next/nest/rn）/ `@tripod-stack/prettier-config` / `@tripod-stack/eslint-config`（5 preset）/ `eslint-plugin-tripod`（6 规则） |
| Git 质量门槛 | husky `pre-commit`（gitleaks + lint-staged）/ `pre-push`（turbo lint+typecheck+test+build with `...[origin/main]` filter）                                         |
| 密钥防护     | `.gitleaks.toml`（继承默认 + allowlist 文档/env example）                                                                                                          |
| Build 编排   | `turbo.json`（lint / typecheck / test / build / dev / clean pipeline）                                                                                             |
| 版本管理     | Changesets（`@tripod-stack/*` + `eslint-plugin-tripod` 一个 fixed group 严格 lockstep）                                                                            |
| Dev 栈       | `infra/compose/docker-compose.yml`（postgres 17 / redis 8 / mailhog / minio / glitchtip，minimal + full 双 profile）                                               |
| AI 资产      | `.claude/skills/`（`spec-driven-testing` / `graph-code-analysis` / `swap-ui-library` 骨架）+ `plans/design/`（2 份大设计文档）                                     |

### 关键决策（按 2026-04-22 讨论）

| 决策       | 选择                                                                  | 理由                                     |
| ---------- | --------------------------------------------------------------------- | ---------------------------------------- |
| Node 版本  | **22 LTS**                                                            | 2026 业界主流                            |
| pnpm 版本  | **10.33**（`packageManager` 字段锁 Corepack）                         | dual-package exports 支持完整            |
| TypeScript | **5.7.x**                                                             | strict 模式 + bundler moduleResolution   |
| ESLint     | **v8 flat config 前的 `.eslintrc` 风格**                              | v8 生态最稳；v9 flat config 重写成本过大 |
| npm scope  | **`@tripod-stack/*`**（按 plan） + `eslint-plugin-tripod`（unscoped） | plugin 短名约束；scope 供正式包用        |
| 仓库远端   | GitHub public `dxFlue/tripod`                                         | 方便 npm publish + 公开 changelog        |
| gitleaks   | Homebrew 安装，缺失时 husky shim 给 warning 不阻断                    | 非 npm 工具                              |

### 验收

- `pnpm install` 成功（416 包，husky prepare 触发）
- 5 workspace projects 识别正常
- Prettier check 全量绿
- `require('eslint-plugin-tripod')` 6 条规则全合法（meta + create）
- `require('@tripod-stack/eslint-config/base')` 加载成功（3 plugins + 22 rules + 3 overrides）
- `npx prettier --find-config-path` 找到 `@tripod-stack/prettier-config`

### 已知事项 / 技术债

- Docker 未在开发机安装；compose 语法运行时校验等用户首次 `pnpm dev` 时验
- `pnpm.onlyBuiltDependencies` 白名单了 `esbuild / @swc/core / unrs-resolver`，未来新增需要 postinstall 的 dep 要再加
- plan-full §4858 的 eslint-config-tripod 目录图没包含 `eslint-plugin-tripod` 拆包（实际落地和图有出入，后续 doc 阶段统一更新）

---

## Stage 1 — shared-\* 基础层 8 包 {#stage-1}

**完成时间**：2026-04-22
**Commit**：`ad4d65d feat: shared-* foundation layer — 8 packages (stage 1)`
**变更统计**：118 文件 new；`packages/shared-*/**` × 8 包 + `docs/shared-layer.md`

### 交付产物

| 包                               | 测试数 | 核心出口                                                                                                                                                                                                                                                      |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@tripod-stack/shared-types`     | 17     | `ErrorCode` 40 码 11 域 / `ApiResult<T>` / `PaginationDto` / `FilterDto` / `TenantId` / `UserId` / `CorrelationId` branded                                                                                                                                    |
| `@tripod-stack/shared-utils`     | 41     | `initDayjs` + `startOfTenantDay` / `formatTenantDate` / `Decimal` / `sum` / `roundHalfUp` / `retry` / `chunk` / `groupBy`                                                                                                                                     |
| `@tripod-stack/shared-config`    | 11     | `baseEnvSchema` / `loadEnv`（framework-agnostic） / `mergeSchemas` / `EnvValidationError`                                                                                                                                                                     |
| `@tripod-stack/shared-contract`  | 59     | `ok` / `err` / `BusinessException` / `getHttpStatus` / `paginate` / `parseSortString` / `@Idempotent` / `runWithIdempotency` / `@WithCorrelation` / ALS `withCorrelationContext` + `getCorrelationContext` / `defineModuleManifest` / `getDeprecationHeaders` |
| `@tripod-stack/shared-cache`     | 18     | `CacheProvider` 接口 + `InMemoryCacheProvider` + `@Cacheable` + `CACHE_PROVIDER` DI token                                                                                                                                                                     |
| `@tripod-stack/shared-security`  | 12     | `applySecurity` + `HealthController`（liveness/readiness/startup 三 probe）+ `registerGracefulShutdown`（SIGTERM 六步）                                                                                                                                       |
| `@tripod-stack/shared-logger`    | 16     | subpath：`./server`（Pino + ALS mixin）/ `./client`（`ErrorBoundary`（react-error-boundary 底层）+ `useReportError` + `ErrorReporterProvider` + `noopReporter`）/ `./shared`（`DEFAULT_REDACT_PATHS` + `redactObject`）                                       |
| `@tripod-stack/shared-scheduler` | 20     | `@SchedulerJob` + `DistributedLock`（走 CacheProvider，in-memory 警告）+ `JobRegistry` + `isValidCron`                                                                                                                                                        |
| `docs/shared-layer.md`           | —      | 8 包依赖图 + 职责 + 选型 + 扩展规则 + 组合示例                                                                                                                                                                                                                |

### 验收

- **214 单元测试全部通过**（17+41+11+59+18+12+16+20）
- `pnpm turbo run lint typecheck test build --filter='./packages/shared-*'` **32/32 任务绿**（8 包 × 4 task）
- 每包产物：`dist/` 下 `index.cjs` + `index.js` + `index.d.ts` + `index.d.cts` + sourcemaps；`shared-logger` 额外 `dist/{server,client,shared}/` 三 subpath
- Prettier check 全绿
- `InMemoryCacheProvider` 结构兼容 `IdempotencyStore`（专门写了 `idempotency-compat.test.ts` 验证）

### 关键决策（按 2026-04-22 讨论）

| 决策           | 选择                                                                                      | 理由                                                         |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Build 工具     | **tsup 8**（esbuild 内核）                                                                | dual CJS/ESM 零配置                                          |
| 测试框架       | **Vitest 2.x**                                                                            | ESM 原生；vitest globals: false（显式 import）               |
| 产物格式       | **dual CJS + ESM + .d.ts + .d.cts**                                                       | Nest CJS + Vite/Next ESM 都要                                |
| TS 模式        | **strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes + verbatimModuleSyntax** | 最严模式一次到位                                             |
| Zod 版本       | 3.25.x（非 v4）                                                                           | v4 `core` 命名空间 API 未稳定                                |
| Logger backend | **Pino 9** + ALS mixin                                                                    | 结构化 + redaction 快；mixin 机制自动注入 CorrelationContext |
| Cache 生产策略 | InMemory 默认 + Redis adapter（阶段 2 交付）                                              | 多实例部署**必须**切 Redis，否则分布式锁退化                 |
| ErrorBoundary  | 用 `react-error-boundary` 库（非自写 class）                                              | 严守"React 不允许 class component"规则                       |
| 错误上报       | noop reporter 默认 + adapter 接入（stage 2+）                                             | 生产接 GlitchTip / Sentry 走 adapter，不固定死               |

### ESLint 严格性收尾（阶段 1 同 commit）

stage 0 初版 preset 在写 shared-\* 代码时暴露了一批"松绑过度"的问题。用户审视后全部收严：

| 规则                             | 原配置                                      | 新配置                                                                                             | 影响                                                                  |
| -------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `eqeqeq`                         | `{ null: 'never' }`（允许 `== null`）       | `'always'`（全 `===`）                                                                             | 禁止 `== null` 的 JS 惯用法 hack                                      |
| `no-console`                     | `{ allow: ['warn', 'error'] }`              | `'error'`（全禁）                                                                                  | 紧急 debug 必走 logger；library 默认 logger 走 `process.stderr.write` |
| `variable const + global` format | `['camelCase', 'UPPER_CASE', 'PascalCase']` | base：去 PascalCase；react preset：加回（React 组件）                                              | PascalCase 严格框在 React 场景                                        |
| `function` format                | 全部 camelCase                              | base：camelCase；nest preset：加 PascalCase（装饰器工厂）                                          | 装饰器严格框在 NestJS 场景                                            |
| `react/no-class-component`       | `'off'`                                     | `react/prefer-stateless-function: 'error'` + `no-restricted-syntax` 禁 `class X extends Component` | 双保险禁 class component                                              |
| `tripod/no-barrel-import`        | 只匹配显式 folder                           | 默认 `strictFolderPattern=true`                                                                    | `from './folder'`（扩展名缺失）也算 barrel                            |

### 已知事项 / 技术债

- `shared-config/src/load-env.ts` 有一处 `eslint-disable-next-line @typescript-eslint/no-unsafe-return`（zod v3 泛型推断把 `schema.parse()` 回值当 any，运行时已由 schema 保证合法；记于 `plan-full §shared-contract` 或升 zod v4 后可去掉）
- 业务装饰器（`@Idempotent` / `@WithCorrelation` / `@Cacheable` / `@SchedulerJob`）仅 NestJS 语境启用；ESLint 和 tsconfig 都按此约束
- `shared-logger` Sentry / OTEL 集成留给 adapter 层（`adapters/error-reporting-glitchtip/`，阶段 2 交付）；当前只提供接口 + noop reporter

### 变更的 plan-full 内容

- 目录图里 `packages/eslint-config-tripod/rules/` 实际拆到了独立的 `packages/eslint-plugin-tripod/`（plan-full §4858 还保留旧图，阶段 6 文档阶段统一刷新）
- plan-full §4920 原写 `eqeqeq: ['error', 'always', { null: 'never' }]`，已用收严决策覆盖

---

## 模板 — 后续阶段的记录格式

每阶段完成后追加一节，模板：

```markdown
## Stage N — <标题> {#stage-n}

**完成时间**：YYYY-MM-DD
**Commit**：`<short-sha> <commit message>`
**变更统计**：<files changed + insertions/deletions>

### 交付产物

<表格：文件 / 包 / 测试数 / 核心出口>

### 验收

<bullet：哪些测试通过 / 哪些构建通过 / 产物结构验证>

### 关键决策

<表格：决策 / 选择 / 理由>

### 已知事项 / 技术债

<bullet>

### 变更的 plan-full 内容

<如果有>
```
