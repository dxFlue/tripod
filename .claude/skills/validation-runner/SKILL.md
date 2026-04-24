---
name: validation-runner
description: |
  引导 AI 在 tripod 项目里跑一整套代码验证（typecheck / test / lint / build），读错误分类，决定自修还是停下报告。
  固化执行顺序（typecheck → test → lint → build）、范围选择（单包 / 改动影响包 / 全量）、错误模式速查表、自修 vs 停报判定。
  本 skill **不依赖 plans/ 或 tasks.md**——验证只基于仓库实际代码状态。
when_to_use: 用户说"跑一遍验证 / 全绿一下 / 发版前检查 / 验证一下 / turbo 跑一下 / typecheck + test + lint + build / 所有包都过一下"，或 Claude 写完一批代码要自验，或 Stop hook 报 typecheck 失败需要深入诊断。
priority: high
allowed-tools: Read Bash Grep
---

# 验证引导

tripod monorepo 的验证 = **4 任务（typecheck / test / lint / build）× 3 范围（单包 / 改动影响包 / 全量）**。本 skill 固化执行顺序、命令速查、错误分类、自修策略。

## 0. 入口路由（触发时先做 2 步）

| 扫描 | 命令                                                                    | 用途                                                          |
| ---- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1    | `git diff --name-only HEAD && git ls-files --others --exclude-standard` | 看改动范围 → 决定跑单包 / `...[HEAD]` / 全量                  |
| 2    | `cat turbo.json`                                                        | 确认 pipeline 还是原 4 task（避免 turbo.json 被改后命令失效） |

---

## 1. 验证矩阵

### 任务 × 范围速查

| 范围       | typecheck                                       | test                                       | lint                                       | build                                       |
| ---------- | ----------------------------------------------- | ------------------------------------------ | ------------------------------------------ | ------------------------------------------- |
| 单包       | `pnpm -F '@tripod-stack/<pkg>' typecheck`       | `pnpm -F '@tripod-stack/<pkg>' test`       | `pnpm -F '@tripod-stack/<pkg>' lint`       | `pnpm -F '@tripod-stack/<pkg>' build`       |
| 改动影响包 | `pnpm turbo run typecheck --filter='...[HEAD]'` | `pnpm turbo run test --filter='...[HEAD]'` | `pnpm turbo run lint --filter='...[HEAD]'` | `pnpm turbo run build --filter='...[HEAD]'` |
| 全量       | `pnpm turbo run typecheck`                      | `pnpm turbo run test`                      | `pnpm turbo run lint`                      | `pnpm turbo run build`                      |

### 范围选择规则

| 场景                                            | 范围                                                  |
| ----------------------------------------------- | ----------------------------------------------------- |
| 写完 / 改完**一个包**的代码                     | 先跑单包（快），绿了再跑改动影响包                    |
| 改了基础层（shared-types / shared-contract 等） | **必须**跑改动影响包，否则波及面看不到                |
| 首次 clone / 切 branch 后                       | 跑全量（热缓存）                                      |
| 写 changeset / 发版前                           | 跑全量 + 看 turbo summary（0 failed / 0 cached 混比） |
| Stop hook 报过错                                | 跑改动影响包全 4 task                                 |

---

## 2. 执行顺序（硬约束）

**永远按这个顺序**：

```
1. typecheck   (tsc --noEmit，最快，先挡类型错)
2. test        (vitest，次快，挡运行时逻辑错)
3. lint        (eslint，规则错)
4. build       (tsup，最慢，生成 dist/)
```

理由：

- `typecheck` 失败 → 代码根本编译不过，`test` / `build` 也会挂，先修类型
- `test` 失败 → 代码行为不对，`build` 产物也是错的，先修代码
- `lint` 失败 → 代码能跑但不符合规范，不阻塞产物生成，但要修
- `build` 失败 → 前三步都过但打包时失败（通常是 tsup 配置 / external 声明问题）

**禁用**：

- 并行跑 4 任务（turbo 内部会并行依赖包，但任务间是串行）
- 先跑 `build` 再看其他（`build` 失败时错误信息不如 typecheck 精确）
- 跳过 `lint`（lint 规则是硬规则的最后一道防线，如"禁 console / 禁 class 组件"）

---

## 3. 错误分类决策树

### TypeScript（typecheck / tsc）

| 错误码 / 症状                                    | 原因                            | 自修策略                                | 停报条件                                 |
| ------------------------------------------------ | ------------------------------- | --------------------------------------- | ---------------------------------------- |
| `TS2322 Type 'X' is not assignable to 'Y'`       | 值类型不匹配目标                | 修类型签名或修传入值                    | 涉及基础层接口改动，需确认升级还是回退   |
| `TS2339 Property 'x' does not exist on 'T'`      | 被依赖包改了 API                | 看包 CHANGELOG / README；Read 对应 src  | API 破坏性变更，停报让用户决定           |
| `TS2345 Argument type mismatch`                  | 函数调用传参类型错              | 修调用点                                | 涉及跨包契约，停报                       |
| `TS7006 Parameter 'x' implicitly has 'any' type` | 缺类型注解                      | 补类型（禁 `any`）                      | N/A                                      |
| `TS18048 'x' is possibly undefined`              | `noUncheckedIndexedAccess` 保护 | 加类型守卫 / `!` 断言（仅当真保证非空） | N/A                                      |
| `TS2304 Cannot find name 'X'`                    | 漏 import 或包名写错            | 加 import                               | 若 import 路径指向不存在的 subpath，停报 |

### Vitest（test）

| 症状                                               | 原因                     | 自修策略                                                             | 停报条件              |
| -------------------------------------------------- | ------------------------ | -------------------------------------------------------------------- | --------------------- |
| `expected X to equal Y` 单个 test 失败             | 代码行为变 或 期望值过时 | 读代码判断谁对——代码逻辑对但测试期望旧 → 改测试；代码逻辑错 → 改代码 | 无法判断哪个对 → 停报 |
| `Test timed out`                                   | 死循环 / await 挂起      | 加日志定位 / 看 Promise 链                                           | 并发死锁 → 停报       |
| 大量同类 test 一起挂                               | 共享状态污染 / mock 未清 | 加 `beforeEach` 清状态                                               | N/A                   |
| 新增 test 0 个 → `pnpm test` exit 1（vitest 默认） | 漏写 test 文件           | 按 shared-package-author skill 的硬门槛补测试                        | N/A                   |

### ESLint（lint）

| 规则                                                       | 症状               | 自修策略                                                               |
| ---------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| `no-console`                                               | `console.log(...)` | 改 `@tripod-stack/shared-logger/server` 或 `/client`                   |
| `@typescript-eslint/no-unused-vars`                        | 未用变量           | 删掉；真要保留 → 加 `_` 前缀                                           |
| `react/prefer-stateless-function` / `no-restricted-syntax` | class 组件         | 改函数组件 + hook                                                      |
| `eqeqeq`                                                   | `==` / `!=`        | 改 `===` / `!==`（即使 `null` 比较也不例外）                           |
| `tripod/no-barrel-import`                                  | `from './folder'`  | 加扩展名或改具体文件                                                   |
| `@typescript-eslint/no-explicit-any`                       | `any` 类型         | 改 `unknown` + 类型守卫；真必要 → 加 `eslint-disable-next-line` 附说明 |

### tsup（build）

| 症状                            | 原因                              | 自修策略                                               |
| ------------------------------- | --------------------------------- | ------------------------------------------------------ |
| `Could not resolve 'X'`         | 依赖未声明                        | 加到 package.json `dependencies` 或 `peerDependencies` |
| 产物带进 React / Node-only 模块 | peer dep 没加 `external`          | tsup.config.ts `external: ['react', 'pino', ...]`      |
| `dist/` 缺某个 subpath 的文件   | tsup entry 写错                   | 参考 shared-logger `entry: { 'server/index': ... }`    |
| `.d.cts` 没生成                 | `dts: true` 漏写 或 tsup 版本太低 | 确认 tsup ≥ 8.3                                        |

---

## 4. 自修 vs 停报判定

### ✅ 应该自修

- 类型错误是"小尺度"局部问题（加 `!` / 补 import / 修 typo）
- ESLint 格式化 / `no-unused-vars` / `no-console` 这类机械规则
- 测试期望值明显过时（代码逻辑有意改动导致）

### ⚠️ 必须停报

- 涉及基础层（shared-types / shared-contract 等）的 API 变更（改这个会连锁影响其他包）
- 单个包 ≥ 5 个错误（大概率是骨架错 / 依赖链断 / 版本不兼容）
- 测试逻辑错但无法判断是"代码错还是期望值错"
- 错误信息看不懂 / 不熟悉（凭猜修 = 埋坑）
- 3 次连续尝试修复后仍失败（可能修的方向错）
- Build 产物结构不符合规范（缺 `.d.cts` / subpath 错等，属骨架级错误）

### 🚫 禁用的"修复"

- `@ts-ignore` / `@ts-expect-error`（除非配合代码里的详细理由注释）
- `it.skip` / `describe.skip` / `it.only`（进不了 commit）
- `eslint-disable-next-line` 不附说明
- 把失败测试删掉

---

## 5. 和 Stop hook 的分工

| 机制                                                   | 何时                     | 跑什么                                                      | 失败处理                                           |
| ------------------------------------------------------ | ------------------------ | ----------------------------------------------------------- | -------------------------------------------------- |
| **Stop hook**（`.claude/hooks/typecheck-on-stop.mjs`） | Claude 每轮响应结束 自动 | **只** `turbo run typecheck --filter='...[HEAD]'`           | `decision: block` 把错误回给 Claude，Claude 继续修 |
| **validation-runner skill**                            | Claude 主动调 / 用户触发 | 4 任务全链（typecheck / test / lint / build）+ 错误分类诊断 | 按第 4 节"自修 vs 停报"                            |

**协同用法**：

- Stop hook 报 typecheck 失败 → Claude 调 validation-runner 做深入诊断（同时看 test / lint 是否连锁失败）
- Claude 写完一批代码主动 validation-runner → 预期 Stop hook 应该也是绿的
- 用户说"跑一遍" → 直接 validation-runner

---

## 6. AI 铁律

| 场景         | 必须做                                                         | 必须不做                                                   |
| ------------ | -------------------------------------------------------------- | ---------------------------------------------------------- |
| 范围选择     | 先单包快验 → 改动影响包 → 必要时全量                           | ❌ 一上来全量（慢 + 错误混在一起难定位）                   |
| 执行顺序     | typecheck → test → lint → build                                | ❌ 先跑 build；❌ 跳 lint                                  |
| 错误阅读     | 读**第一条**错误，修了再跑，不批量读                           | ❌ 10 条错误一起看，修一个可能牵连其他                     |
| 自修边界     | 按第 4 节判定表                                                | ❌ "不懂的错误也试试修"（会埋坑）                          |
| 停报触发     | 见第 4 节"必须停报"                                            | ❌ 为了显示进度强行修                                      |
| 绕过手段     | 禁用 `@ts-ignore` / `it.skip` / 无注释 `eslint-disable` 等     | ❌ 用绕过代替定位                                          |
| 和 Stop hook | 协同，不互斥                                                   | ❌ 因为 Stop hook 已跑就跳过 validation-runner（范围不同） |
| 报告格式     | 结束时用 **结构化摘要**：通过数 / 失败数 / 失败定位 / 建议动作 | ❌ 贴整段 turbo 输出                                       |

---

## 7. 结束报告模板

验证完成后给用户 **5 行摘要**：

```
✅ 验证结果：typecheck ✓ / test ✓ / lint ✓ / build ✓
范围：<单包 / 改动影响包（N 个） / 全量>
耗时：<秒>
失败：<0 或具体包:任务 清单>
建议动作：<无 / 修 X / 停报等待用户>
```

**范例（全绿）**：

```
✅ 验证结果：typecheck ✓ / test ✓ / lint ✓ / build ✓
范围：改动影响包（3 个：shared-auth / shared-permission / shared-audit）
耗时：47s
失败：0
建议动作：可以 commit
```

**范例（部分失败）**：

```
❌ 验证结果：typecheck ✓ / test ✗ / lint ✓ / build ⏭
范围：单包 shared-auth
耗时：8s
失败：shared-auth:test（2 个 test fail，看起来是 mock 过时）
建议动作：自修（改 mock 返回值）
```

禁用：

- 贴原始 turbo 输出（除非失败且错误信息不能被摘要覆盖）
- 单纯 "跑完了"
- 缺失失败定位或建议动作
