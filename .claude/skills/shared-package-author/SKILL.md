---
name: shared-package-author
description: |
  引导 AI 在 tripod 项目里新建 `packages/shared-<name>/` 业务基建包。
  固化统一骨架：package.json / tsup / vitest / tsconfig / README 六节 / 单元测试硬要求 / 验证 6 步，
  让新包和仓库里已有的 shared-* 包结构零差异。
  本 skill **不依赖 plans/ 或 tasks.md**——判断靠抽象规则，模板靠 ls 仓库里实际已存在的 shared-* 包。
when_to_use: 用户要在 `packages/` 下新建一个 `shared-<name>/` 目录时。常见措辞："新建 shared-* 包 / 加 shared-auth / shared-permission / 加业务基建包 / 加 shared 基建层"。
priority: high
allowed-tools: Read Grep Glob Bash Edit Write
---

# shared-\* 包开发引导

tripod 在 `packages/` 下放两类代码：**配置包**（tsconfig / eslint / prettier / eslint-plugin）和 **shared-\* 基建包**。本 skill 只管后者的新建流程，让每个新 shared-\* 包的骨架 / 文档 / 验证流程完全一致。

## 渐进式加载

| 阶段                                   | 加载文件                    |
| -------------------------------------- | --------------------------- |
| Phase 1：意图闸门（要不要走本 skill）  | `rules/intent-check.md`     |
| Phase 2：骨架（含单入口 / 多入口决策） | `rules/package-skeleton.md` |
| Phase 3：README + 文档同步             | `rules/readme-and-docs.md`  |
| Phase 4：验证 + 交付判定               | `rules/verification.md`     |

只加载当前阶段；rules/ 可按需重入。

---

## 0. 入口路由（触发后先做 2 步扫描）

| 扫描 | 命令                                               | 用途                                              |
| ---- | -------------------------------------------------- | ------------------------------------------------- |
| 1    | `ls packages/ \| grep '^shared-'`                  | 看已存在哪些 shared-\* 包（作为骨架模板的样本库） |
| 2    | `ls packages/shared-<用户想建的名字>/ 2>/dev/null` | 若已存在 → 不走本 skill（改已有包，不新建）       |

---

## 1. Phase 1：意图闸门（4 个抽象维度判断）

**加载 `rules/intent-check.md`。**

不查任何清单，只按 4 个抽象问题判断：

```
Q1：这个包的代码是跨多个 app 复用的基建逻辑吗？
    ├── 否 → 属于 apps/<app>/src/ 的 app 内部代码，不走本 skill
    └── 是 → Q2

Q2：这个包是不是实现某个外部 provider SDK（Stripe / Google / S3 等）的封装？
    ├── 是 → 走 adapter-author skill
    └── 否 → Q3

Q3：这个包是不是一个含 controller / API endpoint 的完整业务 module？
    ├── 是 → 走 nest-module-author skill
    └── 否 → Q4

Q4：packages/shared-<name>/ 是否已存在？
    ├── 是 → 改已有包，不走本 skill
    └── 否 → ✅ 本 skill 适用
```

4 条都不需要读 plans/、tasks.md 或任何项目状态文件。

---

## 2. Phase 2：骨架生成（含单入口 / 多入口决策）

**加载 `rules/package-skeleton.md`。**

先按 2 维决策表决定入口形态：

| 维度     | 单入口（一个 `.` 出口）            | 多入口（`./server` / `./client` / `./shared` subpath） |
| -------- | ---------------------------------- | ------------------------------------------------------ |
| 运行环境 | 只跑 Node 或只跑 Browser / 只跑 RN | 同时要给 server 和 client 用                           |
| 依赖异构 | 内部依赖一致                       | server 需 Node API / client 需 React 等异构依赖        |
| 仓库样例 | 参考 `packages/shared-types/`      | 参考 `packages/shared-logger/`                         |

决定后照样本包抄 5 件套：

```
packages/shared-<name>/
├── package.json          # 照 shared-types（单入口）或 shared-logger（多入口）
├── tsup.config.ts        # entry 单 / 多 + 其他字段逐字相同
├── vitest.config.ts      # globals: false + include src/**/*.test.ts + test/**/*.test.ts
├── tsconfig.json         # extends '@tripod-stack/tsconfig/base.json'
├── src/
│   ├── index.ts          # 或 src/{server,client,shared}/index.ts
│   └── <module>.ts       # 实际实现
└── src/ 或 test/
    └── <module>.test.ts  # 必建（见 Phase 4 硬门槛）
```

**展示骨架内容给用户审查后再写入**。

---

## 3. Phase 3：接口实现 + README + 文档同步

**加载 `rules/readme-and-docs.md`。**

```
1. 写 src/ 代码的同时写对应的 .test.ts（TDD 节奏，不要代码完再补测试）
2. 外部依赖走构造函数注入（便于单测 mock）
3. 每个公开 export 写结构化 JSDoc（签名 / 例子 / 反模式；禁散文）
4. 同步写 README.md（6 节骨架：依赖位置 / 公共 API / 安装 / 使用示例 / 反模式 / 相关）
5. 若 docs/shared-layer.md 存在 → 同步依赖图 / 职责速查表 / 接口扩展规则三处
```

测试用例的**方法论**（happy / edge / error / boundary / idempotency）参考 `spec-driven-testing` skill。

---

## 4. Phase 4：验证 + 交付判定

**加载 `rules/verification.md`。**

6 步序列（任一失败 → 停下报告，不绕过）：

```
1. pnpm install
2. pnpm -F '@tripod-stack/shared-<name>' typecheck
3. pnpm -F '@tripod-stack/shared-<name>' test      ← 硬门槛：≥ 1 test 且全绿
4. pnpm -F '@tripod-stack/shared-<name>' build
5. ls packages/shared-<name>/dist/ 人工核产物
6. pnpm -F '@tripod-stack/shared-<name>' lint       ← 零 warning
```

跨包全绿可选走 `validation-runner` skill（`turbo run ... --filter='...[HEAD]'`）。commit / changeset 走 `commit-and-release` skill。

---

## 5. AI 铁律

| 场景                       | 必须做                                                                      | 必须不做                                                                 |
| -------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| skill 适用性               | 靠 4 闸门抽象判断                                                           | ❌ 查 tasks.md / plans/ 白名单；❌ 用本 skill 写 adapter / module / 页面 |
| 入口形态                   | 单入口 或 三 subpath（server / client / shared）                            | ❌ 造新 subpath 名字（`./native` / `./rn` / `./node` 等）                |
| package.json               | 逐字复用 `shared-types` 或 `shared-logger` 的 exports / scripts / devDeps   | ❌ 自定义 build script / 改字段 / 漏 files 字段                          |
| tsconfig                   | `extends '@tripod-stack/tsconfig/base.json'`                                | ❌ 单包覆盖 strict 级规则                                                |
| vitest                     | `globals: false` + include 两路径                                           | ❌ 开 globals；❌ 改 include pattern                                     |
| 依赖层                     | 只依赖基础层 shared-\*（仓库现有的那些）和第三方                            | ❌ 反向引用 apps/ / adapters/ / 业务上层 shared-\*                       |
| 日志 / 时间 / 金额 / React | logger / dayjs / Decimal / 函数组件                                         | ❌ `console.*` / `new Date()` / `number` 做金额 / class 组件             |
| 错误                       | `ok` / `err` / `BusinessException` + `ErrorCode`                            | ❌ throw 原生 Error / 返回 string 错误                                   |
| **单元测试**               | 每个公开 export ≥ 1 happy + 1 edge；`pnpm -F ... test` 必须 ≥ 1 test 且全绿 | ❌ "按需补"；❌ 只写 smoke 糊差事；❌ `it.skip` / `it.only` 进 commit    |
| 文档                       | README 6 节 + 结构化 JSDoc                                                  | ❌ 散文风                                                                |
| 文档同步                   | 若 `docs/shared-layer.md` 存在 → 同步三处                                   | ❌ 只改 README 就算完                                                    |
| 验证                       | turbo / pnpm 命令全绿 + `ls dist/` 人工核产物                               | ❌ typecheck 过就当完工                                                  |
| 失败                       | 立刻停下报告                                                                | ❌ `@ts-ignore` 糊 / `it.skip` 糊                                        |

---

## 6. 参考仓库里的样本（动态 ls，不硬编码）

| 用途                               | 参考包                                      | 看什么                                                            |
| ---------------------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| 最简单入口包骨架                   | `packages/shared-types/`                    | package.json / tsup / vitest / tsconfig 4 件套                    |
| 多入口（server/client/shared）骨架 | `packages/shared-logger/`                   | tsup 多 entry + exports 三 subpath + peerDependencies             |
| 内部依赖其他 shared-\* 的写法      | `packages/shared-contract/`                 | `"@tripod-stack/shared-types": "workspace:*"` 引法                |
| README 6 节样板                    | `packages/shared-types/README.md`           | 依赖位置 / 公共 API / 安装 / 使用示例 / 反模式 / 相关             |
| 单测粒度基准（happy + edge）       | `packages/shared-contract/src/**/*.test.ts` | 59 个测试覆盖 ok/err/paginate/Idempotent/ALS/defineModuleManifest |

**触发本 skill 后先 `ls packages/`** 确认这些样本包都还在；不在 → 用 Grep 找结构类似的 shared-\* 包替代，不要凭记忆写模板。
