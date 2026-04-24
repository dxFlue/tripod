# Worked Example：加 Stripe 支付

端到端 7 步走查——替换 M2 默认 `payment-mock` 为真实 `payment-stripe`。

---

## 起点

- 用户说："接 Stripe 支付"
- 项目 recipe 是 `erp-commerce`，M2 已装 `payment-mock`
- tripod.config.yaml 当前：`payment.provider: payment-mock`

---

## Step 1：意图识别（Phase 1 闸门）

- 闸门 1：`payment-stripe` 在 M2 ★ 列表吗？→ 否（M2 只有 `payment-mock`）→ 通过
- 闸门 2：映射到 18 接口？→ `PaymentProvider` ✅
- 闸门 3：在 Tier 2 ☆ 白名单？→ `stripe` 在 `PaymentProvider` 的 Tier 2 候选里 ✅

给用户确认：

```
识别结果：
- 能力：接 Stripe 支付
- 映射接口：PaymentProvider
- 拟建 adapter 包：adapters/payment-stripe/
- 将替换 M2 默认的 payment-mock
确认继续？
```

用户确认。

---

## Step 2：读接口契约

```bash
Read packages/shared-payment/src/PaymentProvider.ts
Read adapters/payment-mock/src/payment-mock.provider.ts  # 参考风格
```

识别 4 个方法：`createIntent` / `confirm` / `refund` / `verifyWebhook`

---

## Step 3：生成包骨架

展示给用户：

```
即将创建：adapters/payment-stripe/

- package.json
    deps: @tripod-stack/shared-payment + shared-contract + shared-config + stripe@^14
- tripod.adapter.yaml
    slot: payment.provider
    providerClass: StripePaymentProvider
    provides: PaymentProvider
    envVars:
      - STRIPE_SECRET_KEY (required, sensitive)
      - STRIPE_WEBHOOK_SECRET (required, sensitive)
      - STRIPE_PUBLISHABLE_KEY (required)   # 前端需要
- src/index.ts
- src/payment-stripe.provider.ts     (4 方法骨架)
- __tests__/payment-stripe.provider.test.ts  (空文件)
- README.md

确认创建？
```

用户确认 → 写入。

---

## Step 4：实现 Provider

```ts
// adapters/payment-stripe/src/payment-stripe.provider.ts
import Stripe from 'stripe';
import type {
  PaymentProvider,
  PaymentIntent,
  PaymentOrder,
  RefundResult,
  WebhookEvent,
} from '@tripod-stack/shared-payment';
import { TripodError, ErrorCode } from '@tripod-stack/shared-contract';
import Decimal from 'decimal.js';

/**
 * Stripe 支付 provider
 *
 * slot: payment.provider
 * envVars: STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PUBLISHABLE_KEY
 * 接入: pnpm tripod add-adapter payment.provider=payment-stripe
 */
export class StripePaymentProvider implements PaymentProvider {
  constructor(
    private readonly config: {
      secretKey: string;
      webhookSecret: string;
      publishableKey: string;
    },
    private readonly stripe: Stripe = new Stripe(config.secretKey, {
      apiVersion: '2024-06-20',
    }),
  ) {}

  /**
   * 创建支付意图
   * @param order 订单信息（金额用 Decimal 避免浮点误差）
   * @returns Stripe PaymentIntent（含 clientSecret 传给前端）
   * @throws {TripodError} PAYMENT_INVALID_AMOUNT / PAYMENT_PROVIDER_ERROR
   * @example
   *   await provider.createIntent({ amount: new Decimal('99.50'), currency: 'USD', orderId: 'ord_123' })
   */
  async createIntent(order: PaymentOrder): Promise<PaymentIntent> {
    if (new Decimal(order.amount).lte(0)) {
      throw new TripodError(ErrorCode.PAYMENT_INVALID_AMOUNT, 'amount must be > 0');
    }
    try {
      const intent = await this.stripe.paymentIntents.create({
        amount: new Decimal(order.amount).mul(100).toNumber(), // Stripe 用最小单位
        currency: order.currency.toLowerCase(),
        metadata: { orderId: order.orderId },
      });
      return {
        id: intent.id,
        clientSecret: intent.client_secret!,
        status: intent.status,
      };
    } catch (err) {
      throw new TripodError(ErrorCode.PAYMENT_PROVIDER_ERROR, 'stripe create failed', {
        cause: err,
      });
    }
  }

  /**
   * 确认支付（一般由 Stripe webhook 触发后调）
   * @throws {TripodError} PAYMENT_NOT_FOUND / PAYMENT_ALREADY_CONFIRMED
   */
  async confirm(intentId: string): Promise<PaymentIntent> {
    // ...
  }

  /**
   * 退款
   * @param amount 退款金额（可部分退；省略则全额退）
   * @throws {TripodError} PAYMENT_NOT_FOUND / PAYMENT_REFUND_FAILED
   */
  async refund(intentId: string, amount?: Decimal): Promise<RefundResult> {
    // ...
  }

  /**
   * 校验 Stripe webhook 签名
   * @param rawBody 必须是 raw body（Buffer 或 string），未 parse JSON
   * @param signature req.headers['stripe-signature']
   * @throws {TripodError} PAYMENT_WEBHOOK_INVALID_SIGNATURE
   * @example
   *   // NestJS: 用 @Req() 拿 raw body（Body parser 要配 raw）
   *   provider.verifyWebhook(rawBody, req.headers['stripe-signature'])
   * @example 反模式
   *   // ❌ 错误：用 JSON.stringify(req.body)（body 已被 parse，签名会失败）
   */
  verifyWebhook(rawBody: string | Buffer, signature: string): WebhookEvent {
    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.webhookSecret,
      );
      return { id: event.id, type: event.type, data: event.data.object };
    } catch (err) {
      throw new TripodError(ErrorCode.PAYMENT_WEBHOOK_INVALID_SIGNATURE, 'invalid signature', {
        cause: err,
      });
    }
  }
}
```

---

## Step 5：单元测试

```ts
// adapters/payment-stripe/__tests__/payment-stripe.provider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { StripePaymentProvider } from '../src/payment-stripe.provider';
import { TripodError, ErrorCode } from '@tripod-stack/shared-contract';

describe('StripePaymentProvider', () => {
  let mockStripe: any;
  let provider: StripePaymentProvider;

  beforeEach(() => {
    mockStripe = {
      paymentIntents: {
        create: vi.fn(),
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
    };
    provider = new StripePaymentProvider(
      {
        secretKey: 'sk_test_fake',
        webhookSecret: 'whsec_fake',
        publishableKey: 'pk_test_fake',
      },
      mockStripe,
    );
  });

  describe('createIntent', () => {
    it('正常：金额 99.50 USD → 转 9950 cents 调 Stripe', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_abc',
        client_secret: 'pi_abc_secret',
        status: 'requires_payment_method',
      });

      const intent = await provider.createIntent({
        amount: new Decimal('99.50'),
        currency: 'USD',
        orderId: 'ord_123',
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 9950,
        currency: 'usd',
        metadata: { orderId: 'ord_123' },
      });
      expect(intent.id).toBe('pi_abc');
      expect(intent.clientSecret).toBe('pi_abc_secret');
    });

    it('错误：金额 ≤ 0 → PAYMENT_INVALID_AMOUNT', async () => {
      await expect(
        provider.createIntent({ amount: new Decimal('0'), currency: 'USD', orderId: 'x' }),
      ).rejects.toMatchObject({ code: ErrorCode.PAYMENT_INVALID_AMOUNT });
    });

    it('错误：Stripe SDK 抛错 → PAYMENT_PROVIDER_ERROR', async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(new Error('stripe down'));
      await expect(
        provider.createIntent({ amount: new Decimal('10'), currency: 'USD', orderId: 'x' }),
      ).rejects.toMatchObject({ code: ErrorCode.PAYMENT_PROVIDER_ERROR });
    });
  });

  describe('verifyWebhook', () => {
    it('签名无效 → PAYMENT_WEBHOOK_INVALID_SIGNATURE', () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('bad sig');
      });
      expect(() => provider.verifyWebhook('raw', 'bad-sig')).toThrow(TripodError);
    });
  });
});
```

跑测试：

```bash
pnpm --filter @tripod-stack/adapter-payment-stripe test
# ✅ 全绿
```

---

## Step 6：注册

```bash
pnpm tripod add-adapter payment.provider=payment-stripe
```

CLI 自动做：

- `tripod.config.yaml` → `payment.provider: payment-stripe`（替换 payment-mock）
- `packages/shared-config/env.schema.ts` → 追加 `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PUBLISHABLE_KEY` zod 定义
- `apps/server/package.json` → 加 `"@tripod-stack/adapter-payment-stripe": "workspace:*"`

提示用户填 `.env`：

```
.env 需要补：
  STRIPE_SECRET_KEY=sk_live_xxx（从 Stripe Dashboard 复制）
  STRIPE_WEBHOOK_SECRET=whsec_xxx（配 webhook endpoint 后取）
  STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

---

## Step 7：doctor 验证

```bash
pnpm tripod doctor
```

期望：

```
✅ adapters/payment-stripe/tripod.adapter.yaml 合法
✅ provides: PaymentProvider 在白名单
✅ .env 所有 required envVars 已填
✅ tripod.config.yaml: payment.provider=payment-stripe
✅ 单元测试全绿
```

---

## 完成交付

告知用户：

```
Stripe 支付接入完成。后续业务侧要做的：
1. 在 Stripe Dashboard 配 webhook endpoint：POST https://<你的域名>/api/v1/webhooks/stripe
   （apps/server 的 payment 模块已内置 webhook 路由，调 verifyWebhook）
2. 本地联调：pnpm dev → 用 Stripe 测试卡 4242 4242 4242 4242 走一遍下单流程
3. （可选）补 Playwright API E2E（走 /spec-driven-testing 而非本 skill）
```

本 skill 任务完成。**不自动**写 E2E / 部署 / 调用 Stripe 真实 API。
