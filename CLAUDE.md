# CLAUDE.md — Tripod AI 协作主入口

> 轻量指向版（阶段 6 扩到完整版）。AI 每次新会话先读本文件，再按指向加载下一层。

## 项目定位

Tripod = 多租户 / 多平台 / adapter 化的全栈模板（Node 22 LTS + pnpm 10.33 + Turbo 2.x monorepo）。

**目标**：`pnpm create tripod` 一键起完整项目（server + admin-web + platform + admin-mobile + portal + mall-web + mall-mobile + infra）。

## AI 新会话加载顺序

| 文件                                                           | 作用                               | 必读    |
| -------------------------------------------------------------- | ---------------------------------- | ------- |
| `plans/design/tripod-core.md`                                  | 硬规则 + 快速索引（~1024 行）      | ✅ 必读 |
| `plans/execution/tasks.md`                                     | 当前阶段 + 下一步 + 进度表         | ✅ 必读 |
| `plans/execution/completion-log.md`                            | 已完成阶段的交付记录               | 按需    |
| `plans/design/mobile-react-19-x-mobile-encapsulated-quokka.md` | plan-full（~9100 行，按主题 grep） | 按需    |
| `docs/shared-layer.md`                                         | shared-\* 8 包依赖图 + 选型        | 按需    |

**契约优先级**：`tripod.manifest.yaml`（未来 CLI 产出） > `tripod-core.md` > plan-full > 人类注释。

## 快速命令

```bash
pnpm install                                  # Corepack 自动锁 pnpm 10.33
pnpm turbo run typecheck                      # 全量类型检查
pnpm turbo run test                           # 全量单元测试（当前 214 通过）
pnpm turbo run build                          # 全量构建（shared-* 走 tsup，dual CJS+ESM）
pnpm turbo run lint                           # ESLint 5 preset
pnpm -F '@tripod-stack/shared-types' build    # 单包构建
pnpm turbo run typecheck --filter='...[HEAD]' # 只跑改动包（Stop hook 用这个）
```

`pnpm dev` / `pnpm tripod <cmd>` 要等阶段 4 CLI 落地。

## 仓库结构

| 目录               | 状态       | 内容                                                                                                                                                        |
| ------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/`        | ✅ 1/2     | 配置包 ×4（tsconfig / prettier / eslint / eslint-plugin）+ shared-\* 基础层 ×8（types / utils / config / contract / cache / logger / security / scheduler） |
| `adapters/`        | ⏸ 空       | 可替换实现（阶段 2+）                                                                                                                                       |
| `apps/`            | ⏸ 空       | 7 种 app（阶段 3）                                                                                                                                          |
| `infra/compose/`   | ✅         | `docker-compose.yml`（pg17 / redis8 / mailhog / minio / glitchtip，minimal + full 双 profile）                                                              |
| `infra/docker/`等  | ⏸          | prod Dockerfile / deploy / backup（阶段 7）                                                                                                                 |
| `plans/design/`    | ✅         | 权威设计文档（core.md + plan-full）                                                                                                                         |
| `plans/execution/` | ✅         | 任务进度 + 完成日志                                                                                                                                         |
| `docs/`            | 🚧         | `dev-setup.md` + `shared-layer.md`；配对文档（每种 app 一组）在阶段 6                                                                                       |
| `secrets/`         | git-ignore | 本地 secret（README 有占位说明）                                                                                                                            |
| `.claude/`         | ✅         | skills（11 个）+ hooks（skill 激活 / stop typecheck）+ settings.json                                                                                        |

## Skill 自动激活（.claude/hooks/skill-activation.mjs）

每条 prompt 走 UserPromptSubmit hook 匹配 `.claude/skills/skill-rules.json`。命中后 Claude 被提示优先用 Skill 工具调用。

| skill                    | 主要触发场景                                                              | namespace | category    |
| ------------------------ | ------------------------------------------------------------------------- | --------- | ----------- |
| `adapter-author`         | 加 Google/Apple/Stripe/S3/FCM/Sentry 等 provider                          | template  | cross-stack |
| `spec-driven-testing`    | 写 spec / 三轨 TDD / 测试用例设计                                         | template  | global      |
| `graph-code-analysis`    | 代码分析 / 审查 / 依赖图 / 数据流图                                       | template  | global      |
| `dev-startup`            | 起本地环境 / 端口冲突 / DB/Redis 连不上 / mobile 启动                     | template  | global      |
| `skill-manager`          | 加 / 改 / 删 / review / 装第三方 skill                                    | template  | global      |
| `shared-package-author`  | 新建 `packages/shared-*` 业务基建包（骨架 / README / 单测 / 验证）        | template  | shared      |
| `validation-runner`      | 跑 typecheck + test + lint + build 全链 + 错误分类诊断                    | template  | global      |
| `prisma-tenancy-author`  | 加 Prisma 表（tenantId + RLS + middleware + 跨租户隔离测试）              | template  | server      |
| `commit-and-release`     | commit 规范 / changeset 粒度 / lockstep fixed group / 发版 smoke-test     | template  | global      |
| `nest-module-author`     | 新建 NestJS module（controller / service / manifest / Idempotent / 测试） | template  | server      |
| `react-component-author` | 新建 React 组件（函数组件 / 逻辑 UI 分离 / Gate / Flag / i18n / a11y）    | template  | web         |

规则源：`.claude/skills/skill-rules.json`；注册表：`.claude/skills/manifest.yaml`。

## Stop hook（.claude/hooks/typecheck-on-stop.mjs）

Claude 每轮响应结束时：若 `git diff` 含 `.ts/.tsx/.mts/.cts` 改动 → 跑 `pnpm turbo run typecheck --filter='...[HEAD]'`。失败通过 `decision: "block"` 把错误尾段回给 Claude 自行修复。无 TS 改动时**静默**，避免烧 token。

## 硬规则（一句话版，详见 plan-full）

- 日志必走 `@tripod-stack/shared-logger`（ESLint 全禁 `console.*`）
- React **严禁** class component（ESLint 双保险）
- 比较必 `===`（ESLint `eqeqeq: 'always'`，禁 `== null` hack）
- Barrel import 严格（ESLint `tripod/no-barrel-import strictFolderPattern=true`）
- TypeScript：strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes + verbatimModuleSyntax
- 错误结构化：`ok` / `err` / `BusinessException` + `ErrorCode` 40 码 11 域
- 测试：Vitest 2.x（`globals: false`，显式 import）
- 构建：tsup 8（dual CJS + ESM + `.d.ts` + `.d.cts`）
- 时间用 **dayjs**（禁 `Date` 直用），金额用 **Decimal**（禁 `number`）
- 多租户：service 必须经 `CorrelationContext` ALS + tenant middleware（阶段 2 交付）
- 装饰器（`@Idempotent` / `@WithCorrelation` / `@Cacheable` / `@SchedulerJob`）仅 NestJS 语境用

## 任务流（每次改动后）

1. 调整契约 → 改 `plans/design/*`（plan-full 优先，再同步 core）
2. 子 task 完成 → 在 `plans/execution/tasks.md` 把 ⏸ 改 ✅ + 加 commit 短哈希
3. 阶段完成 → 追加 `plans/execution/completion-log.md` 一节（按模板）
4. 写代码同时写 AI 友好文档（表格 / 签名 / 例子 / 反模式，不写散文）
5. Stop hook 自动跑 typecheck；失败会反馈回来

## 硬禁止（基于用户 memory）

- **不主动做过度设计分析**。问"合不合理"时优先补缺而非裁剪（多租户 / 多平台 / adapter 地基 + M2 预填充都是故意的）
- **不跳阶段 / 不偷懒**。每阶段启动前先做"知识点对齐"；执行中遇非平凡阻塞立即停下报告
- **不写散文文档**。每包 README + JSDoc 走结构化格式

## 常见陷阱

- `pnpm.onlyBuiltDependencies` 当前白名单 `esbuild / @swc/core / unrs-resolver`，新增含 postinstall 的 dep 要扩
- gitleaks 走 Homebrew 安装（非 npm）；缺失时 husky shim 给 warning 不阻断
- `shared-logger` 三 subpath：`./server`（Pino+ALS）/ `./client`（ErrorBoundary）/ `./shared`（redact）——别进错入口
- `@tripod-stack/*` 和 `eslint-plugin-tripod` 走 changesets 一个 **fixed group**，lockstep 发版
