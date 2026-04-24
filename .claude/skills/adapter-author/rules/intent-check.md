# Phase 1：意图识别（3 个校验闸门）

用户提出需求时，按顺序过 3 个闸门。任一闸门 FAIL → 停下报告或改走其他路径，**不继续 Phase 2**。

---

## 闸门 1：能力是否已有 M2 ★ 实现？

M2 ★ 已装 adapter 列表（不走本 skill，改 `tripod.config.yaml` 即可）：

| 接口                  | M2 ★ 已装实现                                                                           |
| --------------------- | --------------------------------------------------------------------------------------- |
| `CredentialProvider`  | `auth-email-password` / `auth-username-password` / `auth-email-otp` / `auth-magic-link` |
| `SessionPolicy`       | `MaxDevicesPolicy` / `SingleGlobalPolicy`                                               |
| `RecoveryProvider`    | `recovery-email-link`                                                                   |
| `StorageProvider`     | `storage-local`                                                                         |
| `ChannelProvider`     | `email-smtp` / `realtime-sse`                                                           |
| `RealtimeChannel`     | `realtime-sse`                                                                          |
| `ErrorReporter`       | `glitchtip`                                                                             |
| `I18nBackend`         | `i18n-file`（4 语言 JSON）                                                              |
| `AuditBackend`        | `audit-postgres`                                                                        |
| `CacheProvider`       | `cache-redis`                                                                           |
| `AnalyticsProvider`   | `analytics-null`                                                                        |
| `FeatureFlagProvider` | `flag-local`                                                                            |
| `PushProvider`        | `push-null`                                                                             |
| `PaymentProvider`     | `payment-mock`                                                                          |
| `ShippingProvider`    | `shipping-mock`                                                                         |
| `SearchProvider`      | `pg-fulltext`                                                                           |
| `SecretsProvider`     | `local-dotenv`                                                                          |
| `MfaProvider`         | 接口 M2 / **实现 M6**（不走本 skill 的接口优先路径）                                    |
| `DeepLinkResolver`    | 接口 M2 / **实现 M5**                                                                   |

**判断流程**：

```
用户说："加 email OTP 登录" / "开邮箱验证码"
  ↓
AI 识别：CredentialProvider + email-otp
  ↓
查上表：auth-email-otp 已是 M2 ★
  ↓
❌ 不走 adapter-author
✅ 改 tripod.config.yaml 的 auth.credential 数组 + 加 "email-otp"
```

```
用户说："接 Stripe 支付"
  ↓
AI 识别：PaymentProvider + stripe
  ↓
查上表：M2 只有 payment-mock，stripe 不在 ★
  ↓
✅ 进入闸门 2
```

**边界 case**：用户想**用真实 SMTP** 发邮件而不是 mailhog。这属于"配 `SMTP_HOST` env"层面改动，email-smtp adapter 已装 → **不走本 skill**。

---

## 闸门 2：能力是否映射到 18 个接口之一？

**18 个稳定接口白名单**（plan §11 的 Adapter 表）：

```
CredentialProvider    SessionPolicy        RecoveryProvider    MfaProvider
StorageProvider       ChannelProvider      RealtimeChannel
ErrorReporter         I18nBackend          AuditBackend        CacheProvider
AnalyticsProvider     FeatureFlagProvider
PushProvider          DeepLinkResolver
PaymentProvider       ShippingProvider     SearchProvider
SecretsProvider
```

**匹配规则**（美日主场 provider 为主；中国 provider 作次级）：

| 用户说                                                                                                        | 映射接口                             |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 登录方式（OAuth Google / Apple / LINE / Microsoft / GitHub / Facebook / SMS / SSO-SAML / SSO-OIDC / passkey） | `CredentialProvider`                 |
| MFA / 二步验证 / TOTP / WebAuthn                                                                              | `MfaProvider`                        |
| 存储（S3 / GCS / R2 / Azure Blob / MinIO / per-tenant / virus-scan）                                          | `StorageProvider`                    |
| 通知渠道（Twilio SMS / AWS SNS / Slack / Discord / Microsoft Teams / LINE Notify / webhook）                  | `ChannelProvider`                    |
| 实时（websocket / mqtt / socket.io）                                                                          | `RealtimeChannel`                    |
| 错误上报（Sentry saas / Rollbar / Bugsnag / Datadog）                                                         | `ErrorReporter`                      |
| 翻译后端（Tolgee / Crowdin / Lokalise / Phrase）                                                              | `I18nBackend`                        |
| 审计存储（ClickHouse / ElasticSearch / Splunk）                                                               | `AuditBackend`                       |
| 缓存（memcached / in-memory / dragonfly）                                                                     | `CacheProvider`                      |
| 埋点（PostHog / Mixpanel / Amplitude / GA4 / Segment / Umami）                                                | `AnalyticsProvider`                  |
| Feature flag（Unleash / LaunchDarkly / Flagsmith / PostHog）                                                  | `FeatureFlagProvider`                |
| 移动推送（FCM / APNs / Expo Push / OneSignal / Airship）                                                      | `PushProvider`                       |
| 深链（Universal Link / App Link / 自定义 scheme / Branch.io）                                                 | `DeepLinkResolver`                   |
| 支付 美国（Stripe / PayPal / Braintree / Square / Authorize.net）                                             | `PaymentProvider`                    |
| 支付 日本（Komoju / Pay.jp / LINE Pay / PayPay / Rakuten Pay / GMO Payment）                                  | `PaymentProvider`                    |
| 物流 美国（Shippo / EasyPost / USPS / UPS / FedEx）                                                           | `ShippingProvider`                   |
| 物流 日本（Yamato / Sagawa / Japan Post / Seino）                                                             | `ShippingProvider`                   |
| 搜索（Meilisearch / ElasticSearch / Algolia / Typesense）                                                     | `SearchProvider`                     |
| Secrets（SOPS / Vault / Doppler / AWS Secrets Manager）                                                       | `SecretsProvider`                    |
| 中国次级（WeChat / Alipay / 顺丰 / 中通 / 极光 / 企微 / 钉钉 / 飞书 / OSS / COS）                             | 仅在业务明确要求时加；否则走美日主流 |

**不匹配 = FAIL**：

```
用户说："加个计费模块" / "加 AI 问答" / "加视频直播"
  ↓
AI 识别：不在 18 个接口任何一个覆盖范围
  ↓
❌ 停下报告：
    "这不是 adapter 能覆盖的能力（18 个接口白名单见 plan §11）。
     [计费/AI/直播] 是新业务模块，应走 /spec-driven-testing 建资源，
     或按需讨论是否引入第 19 个 adapter 接口（= 架构决策，需人类评审）。"
```

**AI 铁律**：不得新增第 19 个接口。接口定义在 `packages/shared-<能力>/src/<X>Provider.ts`，擅自加 = 破坏 tripod 基建。

---

## 闸门 3：是否 Tier 2 ☆ 白名单 / 业务明确要求？

plan §11 的 Tier 2 ☆ 列表（业务按需新建包；**美日主场优先**，中国 provider 仅在业务明确要求时使用）：

| 接口                  | Tier 2 ☆ 候选（美日主流）                                                                                                                                             | 中国次级（仅明确要求时用）     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `CredentialProvider`  | oauth-google / oauth-apple / **oauth-line**（日本主流）/ oauth-microsoft / oauth-github / oauth-facebook / sms（Twilio）/ sso-saml / sso-oidc / passkey               | oauth-wechat / oauth-qq        |
| `SessionPolicy`       | PerAppPolicy                                                                                                                                                          | —                              |
| `RecoveryProvider`    | recovery-sms（Twilio）/ recovery-security-question                                                                                                                    | —                              |
| `MfaProvider`         | totp / webauthn                                                                                                                                                       | —                              |
| `StorageProvider`     | s3（AWS）/ gcs（Google Cloud）/ r2（Cloudflare）/ azure-blob / minio / per-tenant / virus-scan                                                                        | oss / cos                      |
| `ChannelProvider`     | sms（Twilio / AWS SNS）/ slack / discord / microsoft-teams / **line-notify**（日本）/ webhook                                                                         | wecom / dingtalk / feishu      |
| `RealtimeChannel`     | websocket / mqtt                                                                                                                                                      | —                              |
| `ErrorReporter`       | sentry-saas / rollbar / bugsnag / datadog                                                                                                                             | —                              |
| `I18nBackend`         | tolgee / crowdin / lokalise / phrase                                                                                                                                  | —                              |
| `AuditBackend`        | clickhouse / elasticsearch                                                                                                                                            | —                              |
| `CacheProvider`       | in-memory / memcached / dragonfly                                                                                                                                     | —                              |
| `AnalyticsProvider`   | posthog / mixpanel / amplitude / ga4 / segment / umami                                                                                                                | —                              |
| `FeatureFlagProvider` | unleash / launchdarkly / flagsmith                                                                                                                                    | —                              |
| `PushProvider`        | fcm（Android / 跨平台）/ apns（iOS 原生）/ expo-push（Expo 工作流）/ onesignal / airship                                                                              | jiguang / getui / unified-push |
| `DeepLinkResolver`    | universal-link（iOS）/ app-link（Android）/ custom-scheme / branch.io                                                                                                 | —                              |
| `PaymentProvider`     | **美国**：stripe / paypal / braintree / square / authorize.net<br>**日本**：komoju / pay.jp / line-pay / paypay / rakuten-pay / gmo-payment                           | alipay / wechat-pay            |
| `ShippingProvider`    | **美国**：shippo（聚合）/ easypost（聚合）/ usps / ups / fedex<br>**日本**：yamato-unyu（ヤマト運輸）/ sagawa（佐川急便）/ japan-post（日本郵便 / ゆうパック）/ seino | sf / zto / yt                  |
| `SearchProvider`      | meilisearch / elasticsearch / algolia / typesense                                                                                                                     | —                              |
| `SecretsProvider`     | sops / vault / doppler / aws-secrets-manager                                                                                                                          | —                              |

**判断**：

| 情况                                                                           | 处理                                                                                                                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 用户要的在 Tier 2 ☆ 表里                                                       | ✅ 标准流程 → Phase 2                                                                                                                                        |
| 用户要的不在 Tier 2 ☆ 表里但映射到 18 个接口（如接 X.com 的某个冷门 provider） | ✅ 允许，但先确认：<br>"这不在 plan 的 Tier 2 预见列表，但能映射到 [接口名]。<br>你确定要接入这个 provider 而不是用 Tier 2 候选里的替代？"<br>确认 → Phase 2 |
| 用户说得很模糊（"加个第三方服务"）                                             | 反问具体是什么 provider                                                                                                                                      |

**Anti-pattern**（plan line 372）：**AI 不主动新建 Tier 2 adapter 包**。用户不明确要求 → 不建。

---

## 通过 3 个闸门后

输出给用户：

```
识别结果：
- 能力：[用户说的原文]
- 映射接口：[接口名] （见 packages/shared-<能力>/src/<X>Provider.ts）
- Tier：Tier 2 ☆
- 拟建 adapter 包：adapters/<slot>-<provider>/
- 将走 7 步流程：骨架 → 实现 → 测试 → 注册 → doctor

确认继续？[y/n]
```

用户确认后进入 **Phase 2：rules/package-skeleton.md**。
