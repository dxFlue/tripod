# Tripod 执行任务清单

> **SoT 说明**：本文件是 AI 新会话加载的任务进度主档。当前状态以此为准，harness 内部 TaskList 是会话级缓存。

**最后更新**：2026-04-22（阶段 1 完成 / 阶段 2 未启动）

## 进度快照

| #   | 阶段                                        | 状态         | 提交 / 测试          |
| --- | ------------------------------------------- | ------------ | -------------------- |
| 0   | 仓库 + 开发配置包 + dev 环境                | ✅ completed | `d3e16e5`            |
| 1   | shared-\* 基础层（8 包）                    | ✅ completed | `ad4d65d` / 214 测试 |
| 2   | shared-\* 业务基建层（18 包）               | ⏸ pending    | —                    |
| 3   | 7 种 app 实现                               | ⏸ pending    | 依赖 #2              |
| 4   | tripod-cli + create-tripod bootstrap        | ⏸ pending    | 依赖 #3              |
| 5   | .claude/skills/ 4 个 skill                  | ⏸ pending    | 依赖 #4              |
| 6   | 文档（配对 + 根 + CLAUDE.md）               | ⏸ pending    | 依赖 #3              |
| 7   | infra（docker / compose / deploy / backup） | ⏸ pending    | 依赖 #3              |
| 8   | 首次发版 0.1.0                              | ⏸ pending    | 依赖 #4/5/6/7        |
| 9   | 回归测试（最终验收）                        | ⏸ pending    | 依赖 #8              |

**下一步**：用户本地 `git push -u origin main` → 完善其他部分 → 回来决定启动阶段 2 或其他方向。

**依赖图**：`0 → 1 → 2 → 3 → {4 ‖ 5 ‖ 6 ‖ 7} → 8 → 9`（5 依赖 4 的 CLI skill 对应；4/6/7 可并行）。

---

## ✅ 阶段 0：仓库 + 开发配置包 + dev 环境

**状态**：2026-04-22 完成，commit `d3e16e5`。详见 [`completion-log.md#stage-0`](./completion-log.md#stage-0)。

| 子 task | 产出                                                                                                          | 状态 |
| ------- | ------------------------------------------------------------------------------------------------------------- | ---- |
| 0.1     | 仓库骨架（git init + `.gitignore` + `package.json` + `pnpm-workspace.yaml` + 顶层目录 + `secrets/README.md`） | ✅   |
| 0.2     | `packages/tsconfig-tripod`（base/react/next/nest/rn 5 份）                                                    | ✅   |
| 0.3     | `packages/prettier-config-tripod`                                                                             | ✅   |
| 0.4     | `packages/eslint-config-tripod`（5 preset：base/react/next/nest/react-native）                                | ✅   |
| 0.5     | `packages/eslint-plugin-tripod`（6 条自定义规则）                                                             | ✅   |
| 0.6     | husky + lint-staged（pre-commit / pre-push）                                                                  | ✅   |
| 0.7     | `.gitleaks.toml` + `docs/dev-setup.md`                                                                        | ✅   |
| 0.8     | `turbo.json` + 根 scripts                                                                                     | ✅   |
| 0.9     | Changesets 配置（lockstep + `@tripod-stack/*` + `eslint-plugin-tripod` 一个 fixed group）                     | ✅   |
| 0.10    | `infra/compose/docker-compose.yml` dev 栈（pg/redis/mailhog/minio/glitchtip，minimal+full 双 profile）        | ✅   |

**关键决策**：

- Node 22 LTS / pnpm 10.33 / ESLint 8（锁 v8 避免 flat config 迁移）/ Turbo 2.x
- `eslint-plugin-tripod` 拆独立 unscoped 包（ESLint 短名约束）
- gitleaks 走 Homebrew 手动装（非 npm 包）；缺失时 husky shim 给 warning 不阻断

---

## ✅ 阶段 1：shared-\* 基础层（8 包）

**状态**：2026-04-22 完成，commit `ad4d65d`。详见 [`completion-log.md#stage-1`](./completion-log.md#stage-1)。

| 子 task | 包                                                                                                            | 测试        | 状态 |
| ------- | ------------------------------------------------------------------------------------------------------------- | ----------- | ---- |
| 1.1     | `shared-types`（ErrorCode / ApiResult / PaginationDto / branded ID）                                          | 17          | ✅   |
| 1.2     | `shared-contract`（ok/err / BusinessException / @Idempotent / @WithCorrelation / ALS / defineModuleManifest） | 59          | ✅   |
| 1.3     | `shared-config`（baseEnvSchema / loadEnv 纯函数）                                                             | 11          | ✅   |
| 1.4     | `shared-utils`（dayjs init / tenant 时区 / Decimal / retry）                                                  | 41          | ✅   |
| 1.5     | `shared-logger`（subpath: server/client/shared；Pino + ALS mixin + react-error-boundary）                     | 16          | ✅   |
| 1.6     | `shared-security`（applySecurity / HealthController 3 probe / registerGracefulShutdown 6 步）                 | 12          | ✅   |
| 1.7     | `shared-cache`（CacheProvider / InMemoryCacheProvider / @Cacheable）                                          | 18          | ✅   |
| 1.8     | `shared-scheduler`（@SchedulerJob / DistributedLock / JobRegistry）                                           | 20          | ✅   |
| 1.9     | 统一约定 + `docs/shared-layer.md`                                                                             | —           | ✅   |
| 1.10    | turbo typecheck+test+build+lint 全绿                                                                          | 32/32 tasks | ✅   |

**ESLint 严格性收尾调整**（阶段 1 末，同 commit）：

- `eqeqeq: 'always'`（禁 `== null` 特例）
- `no-console: 'error'`（全禁，必走 logger）
- global const PascalCase 仅在 React preset；function PascalCase 仅在 Nest preset
- `react/prefer-stateless-function` + `no-restricted-syntax` 双保险禁 class component
- `tripod/no-barrel-import: strictFolderPattern=true`（默认严格）

---

## ⏸ 阶段 2：shared-\* 业务基建层（18 包）

**依赖**：阶段 1 完成 ✓。**可启动**。

### 范围（per plan-full M2 & core §12）

| 包                                                     | 职责（一句话）                                                                                                                                                                  | 依赖基础层                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `shared-auth`                                          | Credential / Session（cookie + header） / MFA 接口 / Recovery；5 种 adapter：email-password / username-password / email-otp / magic-link / recovery-email-link                  | contract + cache + types        |
| `shared-permission`                                    | 3 type 权限（PAGE / DATA_SCOPE / MENU）+ own/all + 前端 `<Gate>` + Guard                                                                                                        | contract + types                |
| `shared-workflow`                                      | state history 查询（转换由业务 service 写）                                                                                                                                     | contract + types                |
| `shared-storage`                                       | StorageProvider + 单次 ≤100MB 上传                                                                                                                                              | contract + types                |
| `shared-notification`                                  | NotificationType + ChannelProvider（SMTP + SSE + channel-push null）                                                                                                            | contract + types                |
| `shared-realtime`                                      | RealtimeChannel（SSE 默认）                                                                                                                                                     | contract + types                |
| `shared-audit`                                         | BusinessAuditLog 单表 + CorrelationContext                                                                                                                                      | contract + logger + types       |
| `shared-i18n`                                          | i18next + formatDate(dayjs) + formatMoney(Decimal) + formatQuantity + 4 语言                                                                                                    | utils + types                   |
| `shared-export`                                        | 业务报表导出（CSV/XLSX 流式）+ defineExport 声明                                                                                                                                | contract + types                |
| `shared-feature-flag`                                  | FeatureFlagProvider + LocalFlagProvider + `<Flag>` + doctor 生命周期检查                                                                                                        | cache + types                   |
| `shared-analytics`                                     | AnalyticsProvider + null impl + useAnalytics / usePageTracking / TrackButton + gen:crud 自动埋点                                                                                | types                           |
| `shared-deeplink`                                      | DeepLinkResolver + DeepLinkRegistry（M2 接口，M5 真实现）                                                                                                                       | types                           |
| `shared-test`                                          | Factories + MSW + createTestTenant fixture                                                                                                                                      | contract + config               |
| `shared-web-ui`                                        | UI 库无关逻辑组件 + hook（`<Gate>` / `<Flag>` / `<RouteGuard>` / `<ErrorBoundary>` + useAuth / useNotifications / useAnalytics / useFeatureFlag / useTheme / api-client-setup） | contract + logger/client + auth |
| `shared-mobile-ui`                                     | RN 逻辑组件 + hook（useScanner / usePushRegistration / useDeepLink / useMobileAuth）                                                                                            | contract + logger/client + auth |
| `shared-theme`                                         | theme token（light/dark + tenant 色板）+ useTheme                                                                                                                               | types                           |
| `shared-payment`                                       | PaymentProvider 接口 + payment-mock adapter（mall 用）                                                                                                                          | contract + types                |
| `shared-cart` / `shared-promotion` / `shared-shipping` | mall 业务基础                                                                                                                                                                   | contract + types                |

### 启动前要对齐的决策点（占位，进阶段 2 时展开）

- Prisma schema 多租户约束（Prisma middleware + RLS）位置
- auth 的 5 种 credential adapter 全部 M2 实现还是预留骨架
- shared-web-ui 方案 C（UI 库无关的逻辑层）具体哪些组件 / hook
- notification 的 channel-push null 占位怎么做
- audit 单表 schema 字段
- i18n 4 语言文件放哪（`adapters/i18n-file/messages/*.json`）
- feature-flag 的 config.yaml 格式

> 用户回"启动阶段 2"后，AI 按 execution discipline 先做"阶段 2 知识点对齐"——列决策点 + 风险 + 子 task 编号 + 让用户确认 —— 再动手。

---

## ⏸ 阶段 3：7 种 app 实现

**依赖**：阶段 2 完成。

### 范围（per core §12 + plan-full §7 种 app 模板交付清单）

| app                 | 技术栈                                           | 核心内容                                                                                       |
| ------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `apps/server`       | NestJS 11 + Prisma 5 + Postgres + Redis + BullMQ | 13 module（auth/permission/workflow/storage/notification/realtime/audit/i18n/user/tenant/...） |
| `apps/admin-web`    | Vite + React 19 + AntD 5                         | 11 页（login / dashboard / users / tenants / permissions / features / audit / ...）            |
| `apps/platform`     | Vite + React 19 + AntD 5                         | 15 页（platform-admin 专用：tenant 生命周期 / 配额 / impersonate / 健康 dashboard）            |
| `apps/admin-mobile` | Expo + RN + NativeWind + Gluestack UI v2         | 9 屏（扫码 / 巡检 / 推送接收 / 审批）                                                          |
| `apps/portal`       | Next.js 15（App Router）                         | 官网 / 文档 / blog，SEO                                                                        |
| `apps/mall-web`     | Next.js 15 + shadcn/ui                           | 商城前端                                                                                       |
| `apps/mall-mobile`  | Expo + Gluestack                                 | 商城 mobile                                                                                    |

每个 app 的 manifest + recipe.yaml + 启动脚本等由阶段 4 CLI 统一生成。

---

## ⏸ 阶段 4：tripod-cli + create-tripod bootstrap

**依赖**：阶段 3（至少 server + admin-web 骨架落地）。

25 条命令全量（core §5 语义映射表）。核心：

- create / status / snapshot / recipe / validate
- add-app / add-adapter / remove / sync
- release / changeset-context / env:validate / env:gen-example / env:doctor
- dev / smoke-test / gen:crud / doctor / repair / upgrade / ...

---

## ⏸ 阶段 5：.claude/skills/ 4 个 skill

**依赖**：阶段 4（CLI 部分 skill 要调 CLI 命令）。

- `spec-driven-testing`（已在 stage 0 交付骨架，本阶段补完）
- `graph-code-analysis`（已在 stage 0 交付骨架，本阶段补完）
- `dev-startup`（新增，M2）
- `swap-ui-library`（新增，M2）

---

## ⏸ 阶段 6：文档（配对 + 根 + CLAUDE.md）

**依赖**：阶段 3。

- `docs/templates/<app-type>/{README, components, pages, customization, testing}.md` 配对文档（每种 app 一组）
- `CLAUDE.md` 根文档（AI 行为指令，= plan-full §CLAUDE.md 完整内容规范的固化副本）
- `docs/release-rules.md` / `docs/deployment.md` / `docs/secrets-management.md`

---

## ⏸ 阶段 7：infra（docker / compose / deploy / backup）

**依赖**：阶段 3。

- `infra/docker/server.Dockerfile` / `admin.Dockerfile` / `platform.Dockerfile`
- `infra/compose/docker-compose.prod.yml` + `observability.yml`
- `infra/deploy/build.sh` / `deploy.sh` / `rollback.sh` / `snapshot-db.sh` / `smoke-test.sh`
- `infra/backup/pg-backup.sh` / `pg-restore.sh` / `verify-backup.sh`
- `infra/db-scripts/`（RLS policy 模板 + tenant 表 generator）

---

## ⏸ 阶段 8：首次发版 0.1.0

**依赖**：#4 / #5 / #6 / #7 全完成。

- `pnpm tripod release` 跑通（交互式 changeset + smoke-test + publish + push + GitHub release 草案）
- 所有 `@tripod-stack/*` + `eslint-plugin-tripod` 首次推 npm
- 发布后 `npm install @tripod-stack/shared-types` 能装上并用

---

## ⏸ 阶段 9：回归测试（最终验收）

**依赖**：阶段 8 发版完成。

- pnpm create tripod 拉取模板能起一个全新项目
- 新项目 `pnpm dev` 成功（pg+redis+server+admin-web 全起）
- 多租户隔离用例通过（`createTestTenant` 交叉读写）
- 性能基线跑一次（列表接口 p99 < 200ms @ 10k 数据）
- 真实项目 dogfooding：用 tripod 建仓储管理业务雏形

---

## 历史：plan 编辑任务（#37–#45）

阶段 0 前的 plan-full / core 文档编辑工作，全部 2026-04-22 前完成：

| #   | 内容                                                                                  |
| --- | ------------------------------------------------------------------------------------- |
| #37 | plan-full 新增总原则章节：逻辑 adapter 完整 + UI 基础可替换 + AI 友好文档             |
| #38 | M2 auth adapter 扩展（5 种）+ LoginPage 骨架设计                                      |
| #39 | shared-\* 包清单调整：shared-web-ui 方案 C / shared-mobile-ui 前置 / 4 个 mall 包新增 |
| #40 | 新增 `.claude/skills/swap-ui-library/` skill 定义                                     |
| #41 | 新增大章节：7 种 app 模板交付清单                                                     |
| #42 | `docs/templates/<app-type>/*.md` 配对文档约定                                         |
| #43 | 技术栈决策调整：3 UI 库进前端核心栈 + 固化 vs adapter 表补 UI 库归类                  |
| #44 | M2/M3 里程碑大幅调整 + Recipe yaml 更新                                               |
| #45 | core §5 / §11 / §12 / §13 / §14 / §15 同步收尾                                        |

---

## 维护约定

- **AI 每个子 task 完成时**：在对应阶段表格里把 ⏸ 改 ✅，加 commit 短哈希
- **AI 每个阶段完成时**：在本文件阶段表头更新"完成时间 / commit / 测试数"；在 `completion-log.md` 追加一节详细记录
- **用户调整 pending 阶段范围时**：AI 改相应阶段的"范围"表
- **不在 tasks.md 记录**：具体代码、API 文档、命令 —— 这些属于 `design/` 或各包 README
