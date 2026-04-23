# @tripod-stack/shared-types

错误码枚举 + API 响应 envelope + 分页 DTO + branded ID 类型。**纯类型 + 少量 helper**，零 runtime 依赖。

## 依赖位置

- **层级**：基础层（阶段 1 的最底层，不依赖任何 `@tripod-stack/*`）
- **被谁依赖**：`shared-contract` / `shared-logger` / `shared-config` / 几乎所有业务 shared-\* 和 apps
- **依赖**：无

## 公共 API

### 错误码

| 名称                    | 形式                                   | 作用                                                                                                                          |
| ----------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ErrorCode`             | `enum`（string enum）                  | M2 核心错误码（SYSTEM/AUTH/PERMISSION/TENANT/VALIDATION/RATE_LIMIT/NOT_FOUND/CONFLICT/QUOTA/QUEUE/IDEMPOTENCY 11 域共 40 码） |
| `ERROR_CODE_DOMAINS`    | `readonly [...]` 常量                  | 业务域前缀清单（alert 路由、日志分类用）                                                                                      |
| `getErrorDomain(code)`  | `(code: ErrorCode) => ErrorCodeDomain` | 从错误码提取域前缀                                                                                                            |
| `isAuthRejection(code)` | `(code: ErrorCode) => boolean`         | 判断是否 401 族（前端自动退登触发）                                                                                           |

### API 响应

| 名称             | 形式                                                            | 作用                                          |
| ---------------- | --------------------------------------------------------------- | --------------------------------------------- |
| `ApiResult<T>`   | discriminated union                                             | 统一 envelope：`ApiSuccess<T>` ∨ `ApiFailure` |
| `ApiSuccess<T>`  | `{ success: true, data: T, meta? }`                             | 成功响应                                      |
| `ApiFailure`     | `{ success: false, error: ErrorBody }`                          | 失败响应                                      |
| `ErrorBody`      | `{ code, message, correlationId, timestamp, details?, retry? }` | 错误结构（前端拦截器直接解）                  |
| `ApiMeta`        | `{ correlationId?, pagination?, apiVersion?, deprecation? }`    | 响应元数据                                    |
| `PaginationMeta` | `{ limit, hasMore, page?, total?, nextCursor? }`                | 分页位置                                      |

### 分页 / 排序 / 筛选

| 名称                  | 形式                                                          | 作用                               |
| --------------------- | ------------------------------------------------------------- | ---------------------------------- |
| `PaginationDto`       | `{ limit?, page?, cursor? }`                                  | Query DTO（page 和 cursor 二选一） |
| `SortDto`             | `{ field, order: 'asc' \| 'desc' }`                           | 排序单项                           |
| `FilterDto`           | `Record<string, FilterValue>`                                 | 筛选条件                           |
| `FilterValue`         | `string \| number \| boolean \| null \| [...] \| FilterRange` | 支持标量 / 数组 / 区间             |
| `FilterRange`         | `{ gte?, gt?, lte?, lt? }`                                    | 区间筛选                           |
| `PaginationResult<T>` | `{ items, hasMore, limit, total?, nextCursor? }`              | service 层返回                     |
| `MAX_PAGE_LIMIT`      | `100`（常量）                                                 | 后端硬上限                         |
| `DEFAULT_PAGE_LIMIT`  | `20`（常量）                                                  | 默认值                             |

### 上下文 & Header

| 名称                 | 形式                                                   | 作用                   |
| -------------------- | ------------------------------------------------------ | ---------------------- |
| `CorrelationContext` | `{ correlationId, tenantId?, userId?, traceId?, ... }` | 请求上下文（ALS 承载） |
| `CORRELATION_HEADER` | `'x-correlation-id'`                                   | HTTP header name       |
| `REQUEST_ID_HEADER`  | `'x-request-id'`                                       | HTTP header name       |
| `TRACE_ID_HEADER`    | `'traceparent'`                                        | W3C Trace Context      |

### Branded ID

| 类型             | Raw 形式        | 工厂                    | 格式校验                 |
| ---------------- | --------------- | ----------------------- | ------------------------ |
| `TenantId`       | UUID v7/v4      | `asTenantId(raw)`       | 走 `parseUuid(raw)`      |
| `UserId`         | UUID v7/v4      | `asUserId(raw)`         | 走 `parseUuid(raw)`      |
| `PermissionId`   | `a:b:c`         | `asPermissionId(raw)`   | `parsePermissionId(raw)` |
| `CorrelationId`  | UUID v7         | `asCorrelationId(raw)`  | 走 `parseUuid(raw)`      |
| `IdempotencyKey` | UUID 或 SHA-256 | `asIdempotencyKey(raw)` | 业务层校验               |

`asXxx()` 是**类型断言**，不校验值。需要校验用 `parseUuid()` / `parsePermissionId()` 先校验再断言。

## 安装

业务 `package.json`：

```json
{
  "dependencies": {
    "@tripod-stack/shared-types": "workspace:*"
  }
}
```

## 使用示例

### Golden path：错误码 + 401 族前端拦截

```ts
import { ErrorCode, isAuthRejection } from '@tripod-stack/shared-types';

axios.interceptors.response.use(undefined, (error) => {
  const code = error.response?.data?.error?.code;
  if (code && isAuthRejection(code)) {
    authStore.clear();
    router.push('/login');
  }
  return Promise.reject(error);
});
```

### Branded ID：防止参数误传

```ts
import { type TenantId, type UserId, asTenantId, asUserId } from '@tripod-stack/shared-types';

function invalidate(tenantId: TenantId, userId: UserId) {
  /* ... */
}

const t = asTenantId(req.user.tenantId);
const u = asUserId(req.user.id);
invalidate(t, u); // ✓
invalidate(u, t); // ✗ 编译错（两参互换）
invalidate('raw-string', u); // ✗ 编译错（string 不是 TenantId）
```

### 分页 Query

```ts
import { type PaginationDto, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@tripod-stack/shared-types';

function normalize(q: PaginationDto) {
  const limit = Math.min(q.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  return { ...q, limit };
}
```

## 反模式 ❌ vs 正确 ✅

### 1. 错误码不要用字符串字面量

❌

```ts
if (err.code === 'AUTH_TOKEN_EXPIRED') { ... }
```

✅

```ts
import { ErrorCode } from '@tripod-stack/shared-types';
if (err.code === ErrorCode.AUTH_TOKEN_EXPIRED) { ... }
```

### 2. 不要自造 ApiResult shape

❌

```ts
// 后端返回 { ok: true, result: ... }
```

✅

```ts
// 后端走 shared-contract 的 ok() helper 产出标准 { success: true, data: ... }
```

### 3. 不要 string ↔ branded 随意互转

❌

```ts
const userId: UserId = req.params.id; // 类型错
```

✅

```ts
const userId = asUserId(req.params.id);
// 或校验后：
const userId = parseUuid(req.params.id) ? asUserId(req.params.id) : throwBadRequest();
```

## 相关

- `@tripod-stack/shared-contract` — `ok()` / `err()` / `paginate()` helper，产出 ApiResult
- `@tripod-stack/shared-logger` — CorrelationContext 的 ALS 实现
- plan-full `§shared-contract §错误码命名规范` — 错误码扩展规则
- plan-full `§shared-contract §分页/排序/筛选统一 Query 语法` — 分页硬约束
