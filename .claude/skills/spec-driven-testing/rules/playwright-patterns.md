# Playwright API E2E 测试模式

本文件定义了将测试计划转化为 Playwright API E2E 测试代码时应遵循的模式。与 UI E2E 的区别：本文只测后端接口，不操作浏览器 UI——请求直接通过 Playwright 的 `request` fixture 发。

---

## 文件位置

按项目既有约定。常见布局：

- `apps/web/e2e/{module}.spec.ts`
- `tests/e2e/api/{module}.spec.ts`
- `e2e/api/{module}.spec.ts`

Phase 4 启动时已通过 `SKILL.md §0` 识别过项目的 E2E 目录；按那个位置放。如果项目既有文件按 `api/` 和 `ui/` 子目录拆分，就跟着拆；如果混放在一起，就混放。

API helper 通常集中在一个 utility 文件里（如 `utils/api-client.ts` 或 `helpers/api.ts`），跟着项目既有约定。

---

## 标准测试文件结构

```typescript
import { test, expect } from '@playwright/test';
import {
  loginAsAdminApi,
  unwrapJson,
  // ... 本模块用到的 API helper
} from '../utils/api-client'; // 按项目实际 helper 路径调整

test.describe.configure({ mode: 'serial' });

test.describe('[ModuleName] API Tests', () => {
  let adminToken: string;
  let adminUserId: string;
  let employeeToken: string;
  let employeeUserId: string;

  // 跟踪创建的资源，afterAll 统一清理
  const createdIds: string[] = [];
  const RANDOM_SUFF = Date.now().toString();

  test.beforeAll(async ({ request }) => {
    // 1. 以各角色登录，拿 token
    const adminRes = await loginAsAdminApi(request);
    adminToken = adminRes.accessToken;
    adminUserId = adminRes.user.id;

    // 2. 准备前置 fixture（部门、用户、类别等）通过 API 创建
    // 3. 登录其它角色账号
  });

  test.afterAll(async ({ request }) => {
    // 逆序清理创建的资源，用 .catch(() => {}) 吞错避免级联
    for (const id of createdIds.reverse()) {
      await apiDeleteXxx(request, adminToken, id).catch(() => {});
    }
  });

  test('TC-PREFIX-01: F-001/BR-001 - Create with valid input', async ({ request }) => {
    // Arrange
    const dto = { name: `E2E-${RANDOM_SUFF}`, amount: 100 };

    // Act
    const res = await apiCreateXxx(request, adminToken, dto);

    // Assert
    expect(res.status()).toBe(201);
    const data = await unwrapJson<{ id: string; status: string }>(res);
    expect(data.status).toBe('PENDING');
    createdIds.push(data.id);
  });
});
```

---

## TC 命名规范

```
TC-[PREFIX]-[NN]: [REQ-IDS] - [Description]
```

- PREFIX：模块大写缩写（2-6 字母，按项目命名风格）
- NN：两位数编号
- REQ-IDS：引用的需求编号（F-001, BR-002, EC-003 等），多个用 `/` 分隔
- Description：简洁英文描述

示例：

```
TC-ORD-01: F-001/BR-001 - Create order with valid inventory
TC-ORD-15: EC-001 - Submit order with zero stock should fail
TC-ORD-28: BR-003 - Discount overlap should be excluded
```

---

## API Helper 模式

每个模块的 API 操作封装为独立函数，集中放在 helper 文件里。签名统一：

```typescript
export async function apiCreateXxx(
  request: APIRequestContext,
  token: string,
  dto: Record<string, any>,
) {
  return request.post(`${API_BASE}/xxx`, {
    headers: { Authorization: `Bearer ${token}` },
    data: dto,
  });
}

export async function apiDeleteXxx(request: APIRequestContext, token: string, id: string) {
  return request.delete(`${API_BASE}/xxx/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

关键点：

- `API_BASE` 是**后端直连地址**（例如 `http://localhost:8000/api/v1`、`http://localhost:4000`——按项目实际），不要经过前端 dev server 代理
- 所有 helper 签名统一：`(request, token, ...args)`
- 用 `unwrapJson<T>(response)` 解包项目约定的响应壳（常见形如 `{ success: true, data: T }` 或 `{ code, data, message }`）
- `loginAsAdminApi` / `loginAsEmployeeApi` 等登录 helper 一次性拿 token，业务 TC 复用

如果 helper 文件不存在或缺某些函数，Phase 4.2 启动时列出清单询问用户后再补。

---

## 测试数据模式

```typescript
// 唯一后缀避免并发/串跑冲突
const RANDOM_SUFF = Date.now().toString();

// 测试用户邮箱（独立命名空间，便于清理和识别）
const testEmail = `user_${RANDOM_SUFF}@e2e.test`;

// 测试数据前缀
const testPrefix = `[E2E-${PREFIX}-${RANDOM_SUFF}]`;
```

---

## 断言模式

```typescript
// 状态码
expect(res.status()).toBe(201);

// 解包后的响应数据
const data = await unwrapJson<{ id: string; status: string }>(res);
expect(data.id).toBeDefined();
expect(data.status).toBe('PENDING');

// 权限拒绝
expect(res.status()).toBe(403);

// 业务错误（项目约定的错误壳）
const err = await res.json();
expect(err.code).toBe(40901);
expect(err.message).toContain('already exists');

// 列表
const list = await unwrapJson<any[]>(res);
expect(list.length).toBeGreaterThan(0);

// 部分匹配
expect(data).toMatchObject({ status: 'APPROVED', amount: 100 });
```

---

## 清理模式

```typescript
test.afterAll(async ({ request }) => {
  // 按依赖关系逆序清理，后创建的先删
  for (const id of createdIds.reverse()) {
    await apiDeleteXxx(request, adminToken, id).catch(() => {});
  }
});
```

`.catch(() => {})` 吞错非常重要——前一条清理失败不应该级联阻塞后续。若项目支持直接连 DB 清理，也可以在 `afterAll` 用 ORM 批量删除。

---

## 实现流程

Phase 4.2 的执行步骤：

1. **读取测试计划** — `docs/specs/[module-name].test-plan.md`，筛出 `Tier=API` 的 TC
2. **检查已有 helper** — 读项目的 API helper 文件（若存在），列出需要新增的函数
3. **确认新增 helper** — 告知用户需要添加哪些，等待确认
4. **添加 helper** — 在 helper 文件中按"API Helper 模式"新增函数
5. **生成测试文件** — 按"标准测试文件结构"写 spec
6. **展示审查** — 将生成的代码展示给用户，确认后写入文件

注意：

- helper 文件中已有某模块的函数时优先复用，不要平行创建
- 测试之间有数据依赖时使用 `serial` 模式
- 清理要确保幂等（多次运行不会因上次残留失败）
