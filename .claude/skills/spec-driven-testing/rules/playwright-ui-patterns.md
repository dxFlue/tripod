# Playwright UI E2E 测试模式

本文件定义 Phase 4.3 生成 UI 端到端测试时的规则和模板。

---

## 文件位置

按项目既有约定。常见布局：

- `apps/web/e2e/{module}.spec.ts`（混合 UI + API）
- `apps/web/e2e/ui/{module}.spec.ts`（显式 UI 子目录）
- `tests/e2e/ui/{module}.spec.ts`
- `e2e/ui/{module}.spec.ts`

Phase 4 启动时已通过 `SKILL.md §0` 识别过项目的 E2E 目录；跟随既有模式。若项目没有单独的 UI 子目录，就跟同级放。

UI 测试和 API 测试**共用同一份 API helper**。Phase 4.3 不应新增 UI 专用的 helper 文件，只在必要时往既有 helper 加函数。

---

## 标准测试文件结构

```typescript
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import {
  loginAsAdminApi,
  apiCreateXxx,
  apiDeleteXxx,
  unwrapJson,
  // ... 模块相关 API helper
} from '../utils/api-client'; // 按项目实际 helper 路径调整

test.describe.configure({ mode: 'serial' });

// 共享上下文
let adminToken: string;
let adminRefreshToken: string;
let adminUser: { id: string; email: string; name: string; role: string; locale: string };

test.beforeAll(async ({ request }) => {
  const admin = await loginAsAdminApi(request);
  adminToken = admin.accessToken;
  adminRefreshToken = admin.refreshToken;
  adminUser = admin.user;
  // 可选：通过 API 准备跨 TC 共享的基础数据
});

// ----- 共享辅助函数 -----

async function injectAdminAuth(page: Page) {
  // 将 token 注入 localStorage，让页面水合时直接登录
  // 具体的 storage key 跟项目前端约定（如 Zustand persist 的 key、cookie 名等）
  await page.addInitScript(
    ({ user, accessToken, refreshToken }) => {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      // 若项目用 Zustand persist，还要写入对应的 persist key
    },
    { user: adminUser, accessToken: adminToken, refreshToken: adminRefreshToken },
  );
}

// ============ TC-PREFIX-NN: <描述> ============
test.describe('TC-PREFIX-NN: <TC 描述>', () => {
  test.beforeAll(async ({ request }) => {
    // 本 TC 的 fixture 准备 — 走 API，不走 UI
  });

  test.afterAll(async ({ request }) => {
    // 本 TC 的清理 — 走 API
  });

  test('<具体 UI 行为描述>', async ({ page }) => {
    await injectAdminAuth(page);
    await page.goto('/target-page');

    // 1. UI 交互
    // 2. UI 断言（等 UI 变化）
    // 3. 后端校验（可选但强烈推荐，调 API 确认真的持久化）
  });
});
```

---

## 核心模式

### 1. 身份注入（`injectAdminAuth`）

**不要走登录页**。通过 `loginAsAdminApi` 拿到 token，再用 `page.addInitScript` 把 `localStorage` / cookie 设好；`page.goto` 时前端的 auth store 会从 storage 水合，直接进入已登录状态。

好处：

- 跳过登录表单交互，测试快
- 登录表单的 flake 不会污染 UI 测试用例
- 多角色切换只需改传入的 `user/token`

具体的 storage key / cookie 名按项目前端实现调整（不同的 state 管理库、不同的持久化方案 key 不同）。Phase 4.3 实施时先读一次前端的 auth store 代码确认 key 名。

如果需要非 admin 角色，在 `beforeAll` 里额外调 `loginAs*Api` 拿 token，再定义 `injectEmployeeAuth` 之类的变体。

### 2. Fixture 准备走 API

**永远不要用 UI 操作来准备测试数据**。反面教材（错的）：

```typescript
// ❌ 错：用 UI 创建前置数据
await page.goto('/orders');
await page.getByRole('button', { name: 'New Order' }).click();
// ... 填表 ...
```

正确做法：

```typescript
// ✅ 对：API 创建前置数据
test.beforeAll(async ({ request }) => {
  const res = await apiCreateOrder(request, adminToken, { amount: 500, customerId });
  expect(res.status()).toBe(201);
});
```

理由：UI 造数据慢、易挂、故障定位困难；API 造数据快、稳、失败点清晰。

### 3. 断言双验证

UI 测试的断言应该 **UI 看到的 + 后端真的写入了** 都验证：

```typescript
test('TC-XXX-04: 原地编辑表单', async ({ page }) => {
  // UI 交互
  await injectAdminAuth(page);
  await page.goto('/orders');
  const row = page.getByRole('row', { name: /order-123/i });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Amount').fill('999');
  await page.getByRole('button', { name: 'Save' }).click();

  // UI 断言：新金额显示
  await expect(row.getByText('999', { exact: false })).toBeVisible({ timeout: 5000 });

  // 后端校验：持久化确实发生
  const res = await apiGetOrder(page.request, adminToken, 'order-123');
  const data = await unwrapJson<{ amount: number }>(res);
  expect(data.amount).toBe(999);
});
```

`page.request` 共享浏览器的 storage / cookie，所以 API 调用的鉴权和 UI 一致。

### 4. 选择器优先级

按优先级由高到低：

1. **`getByRole`（最稳）**：`page.getByRole('button', { name: 'Save' })`
2. **`getByLabel`（表单字段）**：`page.getByLabel('Amount')`
3. **`getByText`（语义清晰）**：`page.getByText('October 2026', { exact: true })`
4. **组合定位容器**：`page.locator('tr', { has: page.getByText('order-123') })`
5. **`data-testid`**（项目有约定时使用）：`page.getByTestId('order-row-123')`
6. **CSS 属性选择器**（兜底）：`page.locator('input[type="number"][placeholder*="金额"]')`

不同项目对 `data-testid` 的态度不同——若项目既有测试大量使用则跟随；若项目没有埋点约定则走 role/label/text。

### 5. 组件库专用选择器（视项目实际情况）

不同 UI 库有各自的 DOM 结构，做 Playwright 选择时可以参考：

| 库             | 常见选择器                                                               |
| -------------- | ------------------------------------------------------------------------ |
| Ant Design     | `.ant-message-error`, `.ant-modal`, `.ant-table-row`, `.ant-select-item` |
| MUI            | `[role="dialog"]`, `.MuiDataGrid-row`, `.MuiMenuItem-root`               |
| shadcn / Radix | `[role="dialog"]`, `[data-state="open"]`, `[role="menuitem"]`            |
| Element Plus   | `.el-message--error`, `.el-dialog`, `.el-table__row`                     |

优先用语义选择器（`getByRole` 等），这些库级选择器作为兜底。

### 6. 等待策略

- 用 `expect(locator).toBeVisible({ timeout: 10000 })`，**不要** `page.waitForTimeout`
- 弹窗消失：`expect(dialog).toBeHidden({ timeout: 5000 })`
- 加载态：`expect(loader).toBeHidden()` 或等待目标内容出现
- 路由跳转后：`await page.waitForURL(/pattern/)` 再做后续断言

---

## 清理模式

每个 `test.describe` 自带 `beforeAll` 清理 + 准备，`afterAll` 清理，**不依赖测试之间的状态继承**（`serial` 模式不代表可以依赖）：

```typescript
async function cleanupOrders(request: APIRequestContext) {
  const res = await apiListOrders(request, adminToken, { tag: testPrefix });
  if (res.status() === 200) {
    const list = await unwrapJson<Array<{ id: string }>>(res);
    for (const o of list) {
      await apiDeleteOrder(request, adminToken, o.id).catch(() => {});
    }
  }
}

test.beforeAll(async ({ request }) => {
  await cleanupOrders(request); // 清上次可能残留
  // 再造本次需要的 fixture
});

test.afterAll(async ({ request }) => {
  await cleanupOrders(request); // 清本次造的
});
```

清理用 `.catch(() => {})` 吞错，避免清理失败级联阻塞后续测试。

---

## 每个 TC 独立 `beforeAll/afterAll`

UI 测试建议每个 `test.describe` 自带 `beforeAll` 和 `afterAll`，让用例可以独立调试（`--grep TC-XXX-04` 单跑也能过）。

---

## 并发与隔离

- 顶层 `test.describe.configure({ mode: 'serial' })`：防止同一模块多个 TC 并发修改相同数据
- 不同模块之间可以并发（Playwright 默认并行多文件）
- 如果多个测试用户，`loginAs*Api` 拿不同 token；fixture 数据用唯一后缀（`Date.now()`）隔离

---

## 生成流程

Phase 4.3 的执行步骤：

1. **读取测试计划** — `docs/specs/[module-name].test-plan.md`，筛出 `Tier=UI` 的 TC
2. **参考既有样板** — 读项目中已有的 UI E2E spec（如有）作为风格参考；特别注意项目既有的 auth 注入方式
3. **检查已有 API helper** — 列出需要新增的 API helper（因为 UI 测试的 fixture 也走 API）
4. **确认新增 helper** — 告知用户需要添加哪些 helper，等待确认后补齐
5. **生成 UI 测试文件** — 按标准结构写 spec
6. **展示审查** — 把生成的代码展示给用户，确认后写入

**提醒用户**：

- `npx playwright test --grep "TC-XXX"` 按 TC 名筛跑
- `npx playwright test --headed` 可见浏览器调试；CI 用默认的 headless
- 若项目有 `pnpm e2e` / `pnpm test:e2e` 等封装脚本，跟项目命令走
