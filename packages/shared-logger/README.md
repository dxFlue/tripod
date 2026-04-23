# @tripod-stack/shared-logger

Tripod 日志 & 错误上报。**subpath exports 三子模块**：

| Subpath   | 用于               | 关键出口                                                           |
| --------- | ------------------ | ------------------------------------------------------------------ |
| `/server` | Node / NestJS      | `createLogger()` (Pino) + `withCorrelationMixin()` (ALS 集成)      |
| `/client` | React web / mobile | `<ErrorBoundary>` + `useReportError()` + `<ErrorReporterProvider>` |
| `/shared` | 前后端共享         | `DEFAULT_REDACT_PATHS` / `redactObject()` / `LogLevel`             |

**M2 默认 client 走 noop reporter**。生产接 Sentry / GlitchTip 在 adapter 层（`adapters/error-reporting-glitchtip/`，阶段 2 交付），通过 `<ErrorReporterProvider>` 替换。

## 依赖位置

- **层级**：基础层（阶段 1）
- **依赖**：`shared-types` / `shared-contract`、`pino`；React 是**可选 peer**（只 client subpath 用）
- **被谁依赖**：apps/server（/server） + apps 前端（/client）

## 公共 API

### Server（`@tripod-stack/shared-logger/server`）

| 名称                         | 签名                                                                   | 作用                                                           |
| ---------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `createLogger(opts?)`        | `(opts?: CreateLoggerOptions) => pino.Logger`                          | 产 Pino logger（含默认 redaction + pretty dev 模式）           |
| `CreateLoggerOptions`        | `{ level?, pretty?, appName?, additionalRedactPaths?, extraOptions? }` | 选项                                                           |
| `withCorrelationMixin(base)` | `(base: Logger) => Logger`                                             | 自动注入 ALS 上下文字段（`correlationId/tenantId/userId/...`） |

### Client（`@tripod-stack/shared-logger/client`）

| 名称                    | 签名                                   | 作用                                                       |
| ----------------------- | -------------------------------------- | ---------------------------------------------------------- |
| `<ErrorBoundary>`       | React Component                        | 捕获子树渲染错误，渲染 fallback；`onError` 回调接 reporter |
| `ErrorBoundaryProps`    | `{ children, fallback, onError? }`     |                                                            |
| `useReportError()`      | `() => (error, extra?) => void`        | hook，业务 try/catch 里主动上报                            |
| `ErrorReporterProvider` | Context.Provider                       | 替换默认 noop reporter                                     |
| `ErrorReporter`         | `{ captureException, captureMessage }` | 接口（adapter 实现）                                       |
| `noopReporter`          | 默认实现                               | 未装 adapter 时                                            |

### Shared（`@tripod-stack/shared-logger/shared`）

| 名称                                                             | 签名                        | 作用                                                                            |
| ---------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| `DEFAULT_REDACT_PATHS`                                           | `readonly string[]`         | 默认敏感字段清单（password / token / apiKey / headers.authorization 等 ~18 条） |
| `redactObject(input, keys?)`                                     | `(input, keys?) => unknown` | 递归替换敏感字段为 `[Redacted]`（client Sentry beforeSend 用）                  |
| `LOG_LEVELS` / `LogLevel` / `isLogLevel(s)` / `LOG_LEVEL_VALUES` | 级别相关                    |                                                                                 |

## 使用示例

### Golden path：Server Pino + ALS 集成

```ts
// apps/server/src/logger.ts
import { createLogger, withCorrelationMixin } from '@tripod-stack/shared-logger/server';

const baseLogger = createLogger({
  level: process.env.LOG_LEVEL as 'info',
  appName: 'tripod-server',
});
export const logger = withCorrelationMixin(baseLogger);

// apps/server/src/interceptors/correlation.interceptor.ts
import { withCorrelationContext, generateCorrelationId, asTenantId, asUserId } from '@tripod-stack/shared-contract';

intercept(ctx, next) {
  const req = ctx.switchToHttp().getRequest();
  const cid = req.headers['x-correlation-id'] || generateCorrelationId();
  return withCorrelationContext(
    { correlationId: cid, tenantId: asTenantId(req.user.tenantId), userId: asUserId(req.user.id) },
    () => next.handle()
  );
}

// 业务 service
@Injectable()
export class OrderService {
  async create(dto) {
    logger.info({ orderId: newId, items: dto.items.length }, 'order created');
    // 输出自动带 correlationId / tenantId / userId
  }
}
```

### Golden path：React ErrorBoundary + 上报

```tsx
// apps/admin-web/src/main.tsx
import { ErrorBoundary, ErrorReporterProvider } from '@tripod-stack/shared-logger/client';
import { glitchTipReporter } from '@tripod-stack/adapter-error-reporting-glitchtip'; // 阶段 2 交付

function ErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div>
      <h1>出错了</h1>
      <pre>{error.message}</pre>
      <button onClick={resetError}>重试</button>
    </div>
  );
}

export function AppRoot() {
  return (
    <ErrorReporterProvider value={glitchTipReporter}>
      <ErrorBoundary
        fallback={ErrorFallback}
        onError={(err, info) =>
          glitchTipReporter.captureException(err, { componentStack: info.componentStack })
        }
      >
        <App />
      </ErrorBoundary>
    </ErrorReporterProvider>
  );
}
```

### 组件内主动上报

```tsx
import { useReportError } from '@tripod-stack/shared-logger/client';

function SubmitButton() {
  const report = useReportError();
  const handleClick = async () => {
    try {
      await api.post('/orders');
    } catch (e) {
      report(e, { feature: 'order-submit' });
      toast.error('提交失败，请重试');
    }
  };
  return <button onClick={handleClick}>提交</button>;
}
```

## 反模式 ❌ vs 正确 ✅

### 1. Server 日志不要模板字符串

❌

```ts
logger.info(`order ${orderId} created for tenant ${tenantId}`);
// 日志系统按 msg 字段解析，模板字符串破坏结构化检索
```

✅

```ts
logger.info({ orderId, tenantId }, 'order created');
```

### 2. 不要手动传 correlationId

❌

```ts
logger.info({ correlationId, tenantId, orderId }, 'order created');
// 每次都要手传，漏传=丢失追溯
```

✅

```ts
// withCorrelationMixin 自动拾取 ALS
logger.info({ orderId }, 'order created');
```

### 3. ErrorBoundary 不要放 try/catch 能处理的地方

❌

```tsx
// 事件 handler 抛错 —— ErrorBoundary 抓不到
<button onClick={() => { throw new Error() }}>...
```

✅

```tsx
// 事件 handler 用 try/catch + useReportError
const report = useReportError();
<button onClick={async () => {
  try { await doWork() } catch (e) { report(e) }
}}>...
```

### 4. 不要生产环境 pretty

❌

```ts
createLogger({ pretty: true }); // 生产 log 不是 JSON，日志聚合系统解析不了
```

✅

```ts
createLogger({ pretty: process.env.NODE_ENV !== 'production' });
// 默认就是这个，不用显式传
```

## 相关

- `@tripod-stack/shared-contract` — `withCorrelationContext` / `getCorrelationContext`（ALS）
- `@tripod-stack/shared-types` — `ErrorCode` / `CorrelationContext` 类型
- `adapters/error-reporting-glitchtip/`（阶段 2 交付） — 生产 GlitchTip 实现 `ErrorReporter` 接口
- plan-full `§shared-logger §结构化日志`
- plan-full `§错误上报 / 观察性`
