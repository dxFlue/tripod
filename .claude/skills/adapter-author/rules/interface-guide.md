# Phase 3：接口实现指南

18 个稳定接口的**签名路径 / 方法契约 / 错误码 / 参考样例**。实现前先 `Read packages/shared-<能力>/src/<X>Provider.ts` 核对真实签名（本文件只给定位索引）。

---

## 通用铁律（所有接口共通）

| 规则                   | 说明                                                                      |
| ---------------------- | ------------------------------------------------------------------------- |
| 接口不得改             | 18 个接口的签名是架构决策，**不能擅自改**                                 |
| env 走 zod             | 在 `tripod.adapter.yaml` 声明，CLI 自动加到 `shared-config/env.schema.ts` |
| 错误走 shared-contract | `throw new TripodError(ErrorCode.X, msg, { cause })`，不自定义字符串      |
| 外部 SDK 注入          | 构造函数第二参数，便于 mock                                               |
| 幂等性                 | 涉及副作用的方法必须标注是否幂等；非幂等的要说明                          |
| 不反向依赖             | 不得 import `apps/server` / 业务代码                                      |
| JSDoc 结构化           | 每方法：签名 / 例子 / 反模式（feedback_ai_friendly_docs 铁律）            |

---

## 18 接口索引

> 以下表格是**索引 + 定位 + 参考**。实现前必须 `Read` 对应的 shared-\* 接口文件核对最新签名。
> `参考样例` = M2 ★ 已装的实现，adapter-author 新建时可对照风格。

### 鉴权 / 会话 / 恢复 / MFA

| 接口                 | 签名路径                                         | 核心方法                                                       | M2 ★ 参考                                                    | Tier 2 候选                                                                                                                                                                       |
| -------------------- | ------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CredentialProvider` | `packages/shared-auth/src/CredentialProvider.ts` | `authenticate(input)` / `getDisplayName()` / `getKey()`        | `auth-email-password` / `auth-email-otp` / `auth-magic-link` | oauth-google / oauth-apple / oauth-line / oauth-microsoft / oauth-github / oauth-facebook / sms（Twilio）/ sso-saml / sso-oidc / passkey（**中国次级**：oauth-wechat / oauth-qq） |
| `SessionPolicy`      | `packages/shared-auth/src/SessionPolicy.ts`      | `onNewSession(session, existingSessions)`                      | `MaxDevicesPolicy` / `SingleGlobalPolicy`                    | PerAppPolicy                                                                                                                                                                      |
| `RecoveryProvider`   | `packages/shared-auth/src/RecoveryProvider.ts`   | `sendRecovery(identifier)` / `verifyRecovery(token)`           | `recovery-email-link`                                        | recovery-sms（Twilio）/ recovery-security-question                                                                                                                                |
| `MfaProvider`        | `packages/shared-auth/src/MfaProvider.ts`        | `setup(userId)` / `challenge(userId)` / `verify(userId, code)` | 接口 M2 / 实现 M6                                            | totp / webauthn                                                                                                                                                                   |

**错误码**（`shared-contract` 定义）：`AUTH_INVALID_CREDENTIALS` / `AUTH_OTP_INVALID` / `AUTH_OTP_EXPIRED` / `AUTH_OTP_RATE_LIMITED` / `AUTH_MAGIC_INVALID` / `AUTH_MAGIC_EXPIRED` / `AUTH_MAGIC_USED` / `MFA_INVALID_CODE` / `MFA_NOT_ENROLLED`。

### 存储

| 接口              | 签名路径                                         | 核心方法                                                                                        | M2 ★ 参考       | Tier 2 候选                                                                                                  |
| ----------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| `StorageProvider` | `packages/shared-storage/src/StorageProvider.ts` | `put(key, stream, meta)` / `get(key)` / `delete(key)` / `getSignedUrl(key, opts)` / `head(key)` | `storage-local` | s3（AWS）/ gcs（Google Cloud）/ r2（Cloudflare）/ azure-blob / minio / per-tenant（**中国次级**：oss / cos） |

**注意**：**M2 只做单次上传 ≤100MB**（plan line 2392），不包含 `startMultipart / uploadPart / completeMultipart / abortMultipart`。S3 adapter 内部用 `@aws-sdk/lib-storage Upload` 类自动分片（SDK 黑盒），不暴露到接口。

**错误码**：`STORAGE_NOT_FOUND` / `STORAGE_UPLOAD_FAILED` / `STORAGE_QUOTA_EXCEEDED`。

### 通知 / 实时

| 接口              | 签名路径                                              | 核心方法                                              | M2 ★ 参考      | Tier 2 候选                                                                                                                   |
| ----------------- | ----------------------------------------------------- | ----------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ChannelProvider` | `packages/shared-notification/src/ChannelProvider.ts` | `send(notification)` / `supportsType(type)`           | `email-smtp`   | sms（Twilio / AWS SNS）/ slack / discord / microsoft-teams / line-notify / webhook（**中国次级**：wecom / dingtalk / feishu） |
| `RealtimeChannel` | `packages/shared-realtime/src/RealtimeChannel.ts`     | `publish(topic, event)` / `subscribe(topic, handler)` | `realtime-sse` | websocket / mqtt / socket.io                                                                                                  |

**错误码**：`NOTIFICATION_CHANNEL_UNSUPPORTED` / `NOTIFICATION_SEND_FAILED` / `REALTIME_CONNECTION_LOST`。

### 观察栈

| 接口                | 签名路径                                             | 核心方法                                                                      | M2 ★ 参考        | Tier 2 候选                                            |
| ------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------ |
| `ErrorReporter`     | `packages/shared-logger/src/ErrorReporter.ts`        | `captureException(err, ctx)` / `captureMessage(msg, level)` / `setUser(user)` | `glitchtip`      | sentry-saas / rollbar / bugsnag / datadog              |
| `AuditBackend`      | `packages/shared-audit/src/AuditBackend.ts`          | `write(entry)` / `query(filter)`                                              | `audit-postgres` | clickhouse / elasticsearch                             |
| `AnalyticsProvider` | `packages/shared-analytics/src/AnalyticsProvider.ts` | `track(event, props)` / `identify(userId, traits)` / `pageView(url)`          | `analytics-null` | posthog / mixpanel / amplitude / ga4 / segment / umami |

**注意**：`AnalyticsProvider` 的 M2 默认是 `analytics-null`（no-op，0 开销；plan line 3387），业务代码 day-1 就埋点。

### 缓存 / 开关 / 翻译

| 接口                  | 签名路径                                                  | 核心方法                                                             | M2 ★ 参考                        | Tier 2 候选                                  |
| --------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------- | -------------------------------------------- |
| `CacheProvider`       | `packages/shared-cache/src/CacheProvider.ts`              | `get(key)` / `set(key, val, ttl)` / `delete(key)` / `increment(key)` | `cache-redis`                    | in-memory / memcached / dragonfly            |
| `FeatureFlagProvider` | `packages/shared-feature-flag/src/FeatureFlagProvider.ts` | `isEnabled(flag, ctx)` / `getVariant(flag, ctx)`                     | `flag-local`（DB + config.yaml） | unleash / launchdarkly / flagsmith / posthog |
| `I18nBackend`         | `packages/shared-i18n/src/I18nBackend.ts`                 | `loadNamespace(locale, ns)` / `hasKey(locale, key)`                  | `i18n-file`（4 语言 JSON）       | tolgee / crowdin / lokalise / phrase         |

### Mobile 专用

| 接口               | 签名路径                                           | 核心方法                                                        | M2 ★ 参考                  | Tier 2 候选                                                                                  |
| ------------------ | -------------------------------------------------- | --------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------- |
| `PushProvider`     | `packages/shared-notification/src/PushProvider.ts` | `send(deviceToken, payload)` / `sendMulticast(tokens, payload)` | `push-null`（M2）/ 实现 M5 | fcm / apns / expo-push / onesignal / airship（**中国次级**：jiguang / getui / unified-push） |
| `DeepLinkResolver` | `packages/shared-deeplink/src/DeepLinkResolver.ts` | `build({type, params})` / `parse(url)`                          | 接口 M2 / 实现 M5          | universal-link / app-link / custom-scheme / branch.io                                        |

### 电商 / 搜索 / Secrets

| 接口               | 签名路径                                           | 核心方法                                                                                        | M2 ★ 参考       | Tier 2 候选                                                                                                                                        |
| ------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PaymentProvider`  | `packages/shared-payment/src/PaymentProvider.ts`   | `createIntent(order)` / `confirm(intentId)` / `refund(intentId, amount)` / `verifyWebhook(req)` | `payment-mock`  | **美国**：stripe / paypal / braintree / square<br>**日本**：komoju / pay.jp / line-pay / paypay / rakuten-pay（**中国次级**：alipay / wechat-pay） |
| `ShippingProvider` | `packages/shared-shipping/src/ShippingProvider.ts` | `createLabel(order)` / `track(trackingId)` / `cancel(shipmentId)`                               | `shipping-mock` | **美国**：shippo / easypost / usps / ups / fedex<br>**日本**：yamato / sagawa / japan-post / seino（**中国次级**：sf / zto / yt）                  |
| `SearchProvider`   | `packages/shared-search/src/SearchProvider.ts`     | `index(doc)` / `search(query, filters)` / `delete(id)`                                          | `pg-fulltext`   | meilisearch / elasticsearch / algolia / typesense                                                                                                  |
| `SecretsProvider`  | `packages/shared-config/src/SecretsProvider.ts`    | `get(key)` / `rotate(key)`                                                                      | `local-dotenv`  | sops / vault / doppler / aws-secrets-manager                                                                                                       |

**支付专用铁律**：

- `verifyWebhook` 必须校验签名（`stripe.webhooks.constructEvent` 类），用 raw body
- **不**在 AI 生成代码时自动 parse JSON 到 req.body 前 verify
- 订单金额**用 Decimal.js**，不用 float（plan §11 固化：`decimal.js`）

---

## 实现工作流（每个接口通用）

```
1. Read packages/shared-<能力>/src/<X>Provider.ts         ← 拿最新签名
2. Read 对应 M2 ★ 参考 adapter 的 .provider.ts         ← 看实现风格
3. 逐方法实现：
   a. 参数校验（必要时用 zod）
   b. 调外部 SDK（通过构造函数注入的 client）
   c. 错误 catch → throw TripodError(ErrorCode.X, msg, { cause })
   d. 返回接口约定结构
4. 每方法写 JSDoc：
   - 一句话定位
   - @param / @returns / @throws
   - @example 正面例子
   - @example 反模式（"不要这样用：..."）
5. 外部 HTTP / SDK 调用不在构造函数里跑，放到方法内（便于测试 mock）
```

---

## 常见错误（AI 实现时容易犯）

| ❌ 错误                                                       | ✅ 正确                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 直接 `throw new Error('xxx')`                                 | `throw new TripodError(ErrorCode.X, 'xxx', { cause })`                           |
| 在 adapter 里 `import { UserService } from 'apps/server/...'` | 反向依赖；通过接口抽象或让调用方传入                                             |
| 在构造函数里初始化 HTTP 连接                                  | 放到方法内，或通过注入的 client（DI）                                            |
| `new Stripe(process.env.STRIPE_KEY)`                          | 走 `shared-config` 的 zod-validated env                                          |
| 返回 `any` / 自定义 shape                                     | 严格按接口返回类型                                                               |
| 为了省事跳过某方法实现                                        | 18 个接口的所有方法必须全部实现（`throw new Error('not implemented')` 也是违规） |
| 改 adapter 接口签名让实现"更方便"                             | ❌ 接口不准动。真觉得接口有问题停下来和用户讨论                                  |

---

## 实现完成后

进入 **Phase 4：rules/register-and-test.md**（测试 + 注册 + doctor）。
