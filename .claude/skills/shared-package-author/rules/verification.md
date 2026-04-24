# Phase 4：验证 + 交付判定

6 步验证序列。**任一失败 → 停下报告，不绕过**。

---

## 6 步序列

| #   | 命令                                              | 通过条件                                            | 失败处理                                                         |
| --- | ------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | `pnpm install`                                    | 无 error，workspace 识别新包                        | 看 `pnpm-workspace.yaml` / `pnpm.onlyBuiltDependencies` 是否需扩 |
| 2   | `pnpm -F '@tripod-stack/shared-<NAME>' typecheck` | `tsc --noEmit` exit 0                               | 看错误——基础层改动波及？骨架错？**不要 `@ts-ignore` 糊**         |
| 3   | `pnpm -F '@tripod-stack/shared-<NAME>' test`      | Vitest exit 0 **且测试数 ≥ 1**                      | 测试不过停报；测试数 0 = skill 硬门槛不满足，补测试              |
| 4   | `pnpm -F '@tripod-stack/shared-<NAME>' build`     | tsup exit 0 + 生成 dist/                            | 看 tsup entry 是否写对                                           |
| 5   | `ls packages/shared-<NAME>/dist/` 人工核产物      | 见下表的产物清单全齐                                | 对不上 → 查 tsup / package.json exports                          |
| 6   | `pnpm -F '@tripod-stack/shared-<NAME>' lint`      | ESLint exit 0，**零 warning**（`--max-warnings=0`） | 改代码，不降级规则                                               |

跨包全绿（`turbo run ... --filter='...[HEAD]'`）属于 `validation-runner` skill 职责；本 skill 只管单包绿。

---

## 产物清单（dist/ 人工核）

### 单入口包

```
dist/
├── index.cjs
├── index.cjs.map
├── index.js
├── index.js.map
├── index.d.ts
└── index.d.cts
```

6 个文件全齐。缺任何一个 = 失败。

### 多入口（subpath）包

```
dist/
├── server/
│   ├── index.cjs
│   ├── index.cjs.map
│   ├── index.js
│   ├── index.js.map
│   ├── index.d.ts
│   └── index.d.cts
├── client/
│   └── ...（同 server，6 个）
└── shared/
    └── ...（同 server，6 个）
```

每个 subpath 下 6 个文件。任一 subpath 不全 = 失败。

---

## 单元测试硬门槛（再强调一次）

本 skill 的**交付判定硬约束**：

| 门槛         | 最低要求                                                        | 检查命令                                                                                     |
| ------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 测试文件存在 | 至少 1 个 `.test.ts` 在 `src/**/` 或 `test/**/`                 | `find packages/shared-<NAME>/src packages/shared-<NAME>/test -name '*.test.ts' \| wc -l` ≥ 1 |
| 测试数       | ≥ public export 数 × 2（每个 export 至少 happy + edge）         | 看 vitest 输出                                                                               |
| 全绿         | 0 failed / 0 skipped（有 `it.skip` / `describe.skip` 也不通过） | `pnpm test` exit 0                                                                           |
| 覆盖率       | **不强制** 具体百分比                                           | N/A                                                                                          |

**测试用例怎么设计**（happy / edge / error / boundary / idempotency / concurrency）→ 参考 `spec-driven-testing` skill，不在本 skill 范围。

---

## 失败处理原则

| 场景           | ✅ 正确处理                                      | ❌ 禁用                                    |
| -------------- | ------------------------------------------------ | ------------------------------------------ |
| typecheck 报错 | 修代码 / 修类型                                  | `@ts-ignore` / `any`                       |
| 测试失败       | 修代码或修测试（不是同一件事，要想清楚哪个错了） | `it.skip` / `it.only` / 注释掉             |
| 测试数 0       | 补测试到 ≥ 1                                     | 跳过本步                                   |
| ESLint warning | 改代码                                           | 单独 `eslint-disable-next-line` 无注释原因 |
| build 报错     | 修 tsup / package.json                           | 降 tsup 版本 / 删 dts: true                |

---

## 交付判定（6 步全绿 + 测试门槛通过）

达标后 skill 的职责结束。接下来归用户：

- commit / changeset → 走 `commit-and-release` skill（不在本 skill 范围）
- tasks.md / completion-log.md 更新 → 用户的阶段管理职责，skill 不主动改

---

## 简化执行脚本（一次跑 6 步）

```bash
set -e
NAME=<包名>

pnpm install
pnpm -F "@tripod-stack/shared-${NAME}" typecheck
pnpm -F "@tripod-stack/shared-${NAME}" test
pnpm -F "@tripod-stack/shared-${NAME}" build
ls "packages/shared-${NAME}/dist/"
pnpm -F "@tripod-stack/shared-${NAME}" lint

echo "✅ shared-${NAME} 6 步全绿"
```

任一步 exit 非 0 → `set -e` 立刻停。
