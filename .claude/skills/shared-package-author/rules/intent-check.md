# Phase 1：意图闸门

判断"要不要走 shared-package-author"的 4 个抽象问题。**不查任何清单、不读 plans/、不读 tasks.md**，只按问题性质判断。

---

## Q1：是不是跨多 app 复用的基建逻辑？

| 信号                                                                      | 判定  |
| ------------------------------------------------------------------------- | ----- |
| 代码会被 `apps/server` + `apps/admin-web` + `apps/mall-*` 中多个引用      | ✅ 是 |
| 代码只在一个 app 内部用（如某个页面组件 / 某个 controller 的私有 helper） | ❌ 否 |
| 代码要被别的 shared-\* 包依赖                                             | ✅ 是 |

**否 → 停下**。属于 `apps/<app>/src/` 内部代码，不走本 skill。

---

## Q2：是不是外部 provider SDK 的封装？

| 信号                                                                  | 判定  |
| --------------------------------------------------------------------- | ----- |
| `import Stripe from 'stripe'` / `import { S3Client } from '@aws-sdk'` | ✅ 是 |
| 功能是实现某个"slot"的 provider（credential / storage / payment 等）  | ✅ 是 |
| 只定义接口 / 类型 / 工具函数，不含任何外部 SDK 调用                   | ❌ 否 |

**是 → route 到 `adapter-author` skill**。adapter 包结构和 shared-\* 完全不同（目录是 `adapters/<slot>-<provider>/`，不是 `packages/shared-*/`）。

---

## Q3：是不是一个完整业务 module（含 controller / API endpoint）？

| 信号                                                           | 判定  |
| -------------------------------------------------------------- | ----- |
| 有 `@Controller()` / `@Get()` / `@Post()` / 定义 HTTP endpoint | ✅ 是 |
| 实现某个业务流程（下单 / 发货 / 审批），直接服务用户请求       | ✅ 是 |
| 只提供工具类 / 接口 / decorator / hook / 组件给其他代码调用    | ❌ 否 |

**是 → route 到 `nest-module-author` skill**。business module 属于 `apps/server/src/modules/<name>/`，不是 `packages/shared-*/`。

---

## Q4：`packages/shared-<name>/` 已存在？

```bash
ls packages/shared-<用户给的名字> 2>/dev/null
```

| 结果            | 判定                                              |
| --------------- | ------------------------------------------------- |
| 目录存在        | ❌ 改已有包，不走本 skill；按需直接 Edit 对应文件 |
| `ls` 返回 error | ✅ 继续 Phase 2                                   |

---

## 4 闸门全过 → ✅ 本 skill 适用

进入 Phase 2，加载 `rules/package-skeleton.md`。

---

## 闸门没过时的报告模板

给用户 3 行简短汇报，让用户决策下一步：

```
命中闸门：Q<n>
原因：<一句话，用用户听得懂的话>
建议：走 <adapter-author / nest-module-author / 直接写 apps/<app>/src/>
```

**范例**：

```
命中闸门：Q2
原因：这个包是 Stripe SDK 的封装，实现 PaymentProvider 接口
建议：走 adapter-author skill，目录是 adapters/payment-stripe/ 而不是 packages/shared-stripe/
```

---

## 模糊场景的裁决优先级

同时像两类时按这个顺序裁决：

1. **Q2 优先于 Q3**：一个包如果既含 controller 又含外部 SDK 封装，应拆分 — 外部 SDK 部分放 `adapters/`，controller 部分放 `apps/server/src/modules/`
2. **Q3 优先于 Q1**：一个包如果含 controller 又声称"跨 app 复用"，其实是伪装的 module — controller 不该跨 app 复用，是 app 单一的
3. **Q1 优先于 Q4**：Q4 只是防止重复新建；如果 Q1 不过（不是跨 app 基建），即便 Q4 过了也不应新建 shared-\* 包

---

## 闸门不能靠什么做判断

| 禁用判断依据                  | 为什么                                          |
| ----------------------------- | ----------------------------------------------- |
| "这个包名在 tasks.md 里"      | tasks.md 是项目进度表，不是 skill 的决策依据    |
| "plan-full §x.y 提到过这个包" | plan 是设计文档，fork 出去可能不存在            |
| "之前团队讨论过要建这个"      | 口头约定不是 skill 闸门；要建就问 4 个抽象问题  |
| "包名以 `shared-` 开头"       | 命名不等于职责；`shared-xxx` 目录放错地方也得挡 |
