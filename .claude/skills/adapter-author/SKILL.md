---
name: adapter-author
description: |
  引导 AI 在 tripod 项目里新建 adapter 包（实现 18 个稳定接口之一）。
  7 步流程：意图识别 → 接口匹配 → 包骨架生成 → 实现 Provider → 单元测试 → tripod add-adapter 注册 → tripod doctor 验证。
  触发时机：用户要加的能力在 plan §11 的 Tier 2 ☆ 列表里（M2 ★ 已装的改 config.yaml 即可，不走本 skill）。
  Tier 2 候选以美日市场主流为主（Google / Apple / LINE / Stripe / PayPal / Komoju / Yamato / Shippo / FCM / APNs 等），中国 provider（WeChat / Alipay / 顺丰等）作次级仅在业务明确要求时加。
when_to_use: 用户说"加 Google/Apple/LINE/Microsoft/GitHub OAuth 登录 / 加 SSO/SAML/passkey/MFA / 接 S3/GCS/R2/Azure Blob 存储 / 接 Stripe/PayPal/Square/Komoju/Pay.jp/LINE Pay/PayPay/Rakuten Pay 支付 / 接 Twilio/AWS SNS SMS / 接 Slack/Discord/LINE Notify 通道 / 接 Shippo/EasyPost/USPS/UPS/FedEx/Yamato/Sagawa/Japan Post 物流 / 接 FCM/APNs/Expo Push/OneSignal 推送 / 接 Sentry/Rollbar/Datadog / 接 Tolgee/Crowdin i18n / 接 Meilisearch/Algolia / 接 PostHog/Amplitude / 接 Vault/SOPS/Doppler"等新建 adapter 场景
priority: high
allowed-tools: Read Grep Glob Bash Edit Write
argument-hint: [slot-provider]
---

# Adapter 开发引导

tripod 的核心扩展机制是 **18 个稳定 adapter 接口**。M2 每个接口 1-3 个默认实现；其他（Tier 2 ☆）业务真要用时**新建 adapter 包**。本 skill 引导 AI 走完 7 步。

## 渐进式加载

| 阶段                        | 加载（相对本文件目录）           |
| --------------------------- | -------------------------------- |
| Phase 1：意图识别           | `rules/intent-check.md`          |
| Phase 2：包骨架             | `rules/package-skeleton.md`      |
| Phase 3：接口实现           | `rules/interface-guide.md`       |
| Phase 4：测试 + 注册 + 验证 | `rules/register-and-test.md`     |
| 参考样例                    | `rules/worked-example-stripe.md` |

只加载当前阶段需要的文件。worked example 在用户明确要"看一个完整案例"或 AI 判断需要对照参考时再加载。

---

## 0. 入口路由

触发时先做 3 步扫描：

1. 读 `tripod-core.md` §11 adapter 表（line 820-842 左右）了解 18 个接口 + M2 ★ 列表 + Tier 2 ☆ 列表
2. `ls adapters/` 看项目当前已装 adapter
3. 读 `tripod.config.yaml` 看哪些 slot 已启用

然后按参数 / 对话判断进入阶段：

| 场景                            | 进入阶段            |
| ------------------------------- | ------------------- |
| 用户首次提起 / 没明确是哪个接口 | Phase 1（意图识别） |
| Phase 1 通过，接口确定          | Phase 2（骨架）     |
| 骨架已生成，开始实现            | Phase 3（接口实现） |
| 实现完，跑测试 / 注册           | Phase 4             |

---

## 1. Phase 1：意图识别

**加载 `rules/intent-check.md`，按其中 3 个校验闸门判断是否真走 adapter-author。**

核心判断：

| 判断                                                                                | 处理                                                       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 能力已有 M2 ★ 实现（如 email-password / storage-local / payment-mock）              | ❌ **不走 adapter-author**。改 `tripod.config.yaml` 即可   |
| 能力在 plan §11 的 Tier 2 ☆ 白名单（如 oauth-google / storage-s3 / payment-stripe） | ✅ 走标准流程                                              |
| 能力不在 18 个接口任何一个覆盖范围内                                                | ❌ **停下报告**。新增第 19 个接口 = 架构决策，必须人类评审 |

---

## 2. Phase 2：包骨架生成

**加载 `rules/package-skeleton.md`。**

生成目录 + 必要文件：

```
adapters/<slot>-<provider>/
├── package.json              # @tripod-stack/adapter-<slot>-<provider>
├── tripod.adapter.yaml       # slot / providerClass / provides / envVars / dockerDeps
├── src/
│   ├── index.ts             # export Provider class
│   └── <name>.provider.ts   # implements <X>Provider
├── __tests__/
│   └── <name>.provider.test.ts
└── README.md                # AI 友好文档（表格 / 签名 / 例子 / 反模式）
```

**展示给用户审查骨架内容后再写入**。

---

## 3. Phase 3：接口实现

**加载 `rules/interface-guide.md`**（包含 18 个接口的签名路径 + 契约 + 错误码 + 参考样例索引）。

实现 Provider 类：

1. 读 `packages/shared-<能力>/src/<X>Provider.ts` 理解接口签名
2. 逐方法实现，错误映射到 `shared-contract` 错误码，env 走 `shared-config` 的 zod schema
3. 外部 SDK 通过构造函数注入（便于 mock）
4. 每方法写 JSDoc（按 `feedback_ai_friendly_docs.md` 结构化：签名 / 例子 / 反模式）

---

## 4. Phase 4：测试 + 注册 + 验证

**加载 `rules/register-and-test.md`。**

三步：

1. **单元测试**：vitest + mock 外部 SDK（不跑真实 HTTP；adapter 无 API E2E / UI E2E）
2. **注册**：`pnpm tripod add-adapter <slot>=<provider-name>` → CLI 自动改 `tripod.config.yaml` + `env.schema.ts` + auth adapter 时改 `strategies/index.ts`
3. **验证**：`pnpm tripod doctor` 全绿

---

## 5. AI 铁律

| 场景                          | 必须做                                                                                                                   | 必须不做                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 判断"要不要走 adapter-author" | 读 plan §11 M2 ★ 列表；已有 → 改 config                                                                                  | ❌ 不对已有实现重复造 adapter 包                              |
| 接口匹配                      | 映射到 18 个接口之一                                                                                                     | ❌ 不新增第 19 个接口（架构变更需人类评审）                   |
| 主动新建 Tier 2 adapter       | 用户明确要求才建                                                                                                         | ❌ 不主动建（plan Anti-patterns 规定：Tier 2 不预登记）       |
| 实现接口前                    | 先 Read `packages/shared-<能力>/src/*Provider.ts` 对照契约                                                               | ❌ 不凭记忆实现                                               |
| env 配置                      | 在 `tripod.adapter.yaml` 的 `envVars` 声明 → `tripod add-adapter` 自动加到 `env.schema.ts` 的 `tripod:env-fields` 标记   | ❌ 不手改 `env.schema.ts` 其他位置（Magic Comment 外禁改）    |
| auth adapter 注册             | 走 `tripod add-adapter auth.credential=<name>`（CLI 自动写 `strategies/index.ts` 的 `tripod:credential-providers` 标记） | ❌ 不手改 `packages/shared-auth/src/strategies/index.ts`      |
| 错误码                        | 映射到 `shared-contract` 的 error-code 常量                                                                              | ❌ 不自定义错误字符串                                         |
| 外部 SDK                      | 构造函数注入 + 单元测试 mock                                                                                             | ❌ 不在业务代码里 `new Stripe(...)`                           |
| 分层                          | adapter 包只依赖 `@tripod-stack/shared-<能力>` 的接口定义                                                                | ❌ 不反向引用 `apps/server` / 业务代码                        |
| 注册流程                      | 走 `tripod add-adapter <slot>=<name>`                                                                                    | ❌ 不手改 `tripod.config.yaml` 的 providers 数组              |
| 文档                          | `README.md` 按结构化格式（表格 / 签名 / 例子 / 反模式）                                                                  | ❌ 不写散文风文档                                             |
| 测试                          | vitest + mock 外部 SDK                                                                                                   | ❌ 不跑真实外部 HTTP；不把 adapter 推到 API E2E / UI E2E 阶段 |

---

→ 参考完整样例见 [rules/worked-example-stripe.md](./rules/worked-example-stripe.md)（加 Stripe 支付的 7 步走查）
