# 共享基础层总览（阶段 1 交付）

Tripod monorepo 的 `packages/shared-*` 基础层 **8 个包**。所有业务 shared-\*（阶段 2）和 apps（阶段 3）都依赖这层。

## 依赖图

```
shared-types        (0 deps)
     │
     ├── shared-utils          (types + dayjs + decimal.js)
     │       │
     │       └── shared-contract   (types + utils + reflect-metadata)
     │             │
     │             ├── shared-cache     (contract + types + reflect-metadata)
     │             │     │
     │             │     └── shared-scheduler   (cache + contract + types)
     │             │
     │             ├── shared-security  (contract + types + helmet + @nestjs)
     │             │
     │             └── shared-logger    (contract + types + pino + react?)
     │
     └── shared-config         (types + zod)
```

**拓扑**：`shared-types` → `shared-utils` / `shared-config` → `shared-contract` → `shared-cache` / `shared-security` / `shared-logger` → `shared-scheduler`。

## 包职责速查表

| #   | 包                 | 层          | 核心 API                                                                                                                          | 依赖                           | 测试 |
| --- | ------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---- |
| 1.1 | `shared-types`     | 类型底座    | `ErrorCode` / `ApiResult<T>` / `PaginationDto` / branded `TenantId/UserId/...`                                                    | —                              | 17   |
| 1.3 | `shared-config`    | env 校验    | `baseEnvSchema` / `loadEnv()` / `mergeSchemas()` / `EnvValidationError`                                                           | types                          | 11   |
| 1.4 | `shared-utils`     | 工具        | `initDayjs` / `startOfTenantDay` / `toDecimal` / `sum` / `retry` / `chunk`                                                        | types、dayjs、decimal.js       | 41   |
| 1.2 | `shared-contract`  | API 契约    | `ok/err` / `BusinessException` / `paginate` / `@Idempotent` / `@WithCorrelation` / ALS / `defineModuleManifest` / `getHttpStatus` | types、utils、reflect-metadata | 59   |
| 1.7 | `shared-cache`     | 缓存        | `CacheProvider` / `InMemoryCacheProvider` / `@Cacheable`                                                                          | contract、types                | 18   |
| 1.6 | `shared-security`  | 安全        | `applySecurity` / `HealthController` / `registerGracefulShutdown`                                                                 | contract、helmet、@nestjs      | 12   |
| 1.5 | `shared-logger`    | 日志 & 错误 | `createLogger` (server) / `<ErrorBoundary>` (client) / `DEFAULT_REDACT_PATHS` (shared)                                            | contract、pino、react?         | 16   |
| 1.8 | `shared-scheduler` | 定时        | `@SchedulerJob` / `DistributedLock` / `JobRegistry`                                                                               | cache、contract、types         | 20   |

总计 **214 单测**，全部绿。

## 选型决策速查

| 决策           | 选择                                                           | 为什么                                       |
| -------------- | -------------------------------------------------------------- | -------------------------------------------- |
| Build 工具     | tsup                                                           | esbuild 内核，dual CJS/ESM 零配置            |
| 测试           | Vitest 2.x                                                     | ESM 原生、Vite 共享 config、jest API 兼容    |
| 输出           | dual CJS + ESM + `.d.ts` / `.d.cts`                            | Nest (CJS) + Vite / Next (ESM) 两边都能吃    |
| TS config      | strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes | 最严模式，一次到位                           |
| Logger backend | Pino 9                                                         | 结构化 + redaction 快、内置 ALS mixin 机制   |
| Cache          | InMemory 默认 + Redis adapter（stage 2）                       | 生产多实例必须切 redis，README 硬警告        |
| Scheduler      | 无特定 cron 库依赖                                             | apps 层自选 `node-cron` 或 BullMQ repeatable |
| 错误上报       | noop reporter 默认 + adapter（stage 2）                        | 生产接 GlitchTip/Sentry 走 adapter           |

## 接口扩展规则

| 能力                    | 当前位置                                                            | 扩展路径                                                    |
| ----------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| 新错误码                | `shared-types/src/errors/codes.ts` enum                             | 加 enum 项 + 4 语言翻译 + `status-mapping` 注册 HTTP status |
| 新 env 变量             | `shared-config/src/base-schema.ts` 或业务 schema                    | 改 Zod schema + `tripod env:gen-example` 生成模板           |
| 自定义 CacheProvider    | `shared-cache/src/provider.ts` 接口                                 | 在 `adapters/cache-xxx/` 实现并注入 `CACHE_PROVIDER`        |
| 自定义 IdempotencyStore | `shared-contract/src/decorators/idempotent.ts`                      | CacheProvider 已结构兼容，直接用                            |
| 自定义 HealthProbe      | `shared-security/src/health/health.controller.ts`                   | 实现 `HealthProbeProvider` + 注入 `HEALTH_PROBES`           |
| 新 logger target        | `shared-logger/src/server/logger.ts` `extraOptions.transport`       | pino transport 配置                                         |
| 错误 reporter           | `shared-logger/src/client/use-report-error.ts` `ErrorReporter` 接口 | `<ErrorReporterProvider>` 覆盖 + 阶段 2 adapter 实现        |

## 常见使用组合

### Nest app 启动骨架

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { applySecurity, registerGracefulShutdown } from '@tripod-stack/shared-security';
import { baseEnvSchema, EnvValidationError, loadEnv } from '@tripod-stack/shared-config';
import { createLogger } from '@tripod-stack/shared-logger/server';
import { initDayjs } from '@tripod-stack/shared-utils';

async function bootstrap() {
  initDayjs();

  let env;
  try {
    env = loadEnv(baseEnvSchema);
  } catch (err) {
    if (err instanceof EnvValidationError) {
      console.error('❌ Env validation failed:\n' + err.formatIssues());
      process.exit(1);
    }
    throw err;
  }

  const logger = createLogger({ appName: 'tripod-server', level: env.LOG_LEVEL });
  const app = await NestFactory.create(AppModule, { logger: false });
  applySecurity(app, { corsOrigins: env.CORS_ORIGINS });
  registerGracefulShutdown(app, {
    hooks: [{ name: 'prisma', run: () => app.get(PrismaService).$disconnect() }],
  });

  await app.listen(env.PORT);
  logger.info({ port: env.PORT }, 'server started');
}
bootstrap();
```

### React app 顶层骨架

```tsx
import 'reflect-metadata'; // 如果 app 用装饰器（通常前端不需要）
import {
  ErrorBoundary,
  ErrorReporterProvider,
  noopReporter,
} from '@tripod-stack/shared-logger/client';
import { initDayjs } from '@tripod-stack/shared-utils';

initDayjs();

export function AppRoot() {
  return (
    <ErrorReporterProvider value={noopReporter /* stage 2 换成 glitchTipReporter */}>
      <ErrorBoundary fallback={ErrorFallback}>
        <App />
      </ErrorBoundary>
    </ErrorReporterProvider>
  );
}
```

## 阶段 2 衔接

下一步业务 shared-\* 层（18 包）将构建在此层之上：

- **`shared-auth`** — 5 种 auth adapter + Session 双存储，用 `shared-contract` 的 BusinessException / `shared-cache` 做 OTP 限流 + token 黑名单
- **`shared-permission`** — 3 type 权限 + Guard，用 `shared-contract` 的装饰器元数据
- **`shared-notification`** — SMTP / SSE / channel-push，用 `shared-logger` 记录发送历史
- **`shared-storage`** — StorageProvider，用 `shared-contract` 的 pagination 列文件
- **`shared-workflow`** — state history，用 `shared-contract` 的 `defineModuleManifest.transitions`
- **`shared-i18n`** — 4 语言，用 `shared-utils` 的 dayjs + Decimal
- **`shared-audit`** — BusinessAuditLog，用 `shared-contract` 的 CorrelationContext
- **`shared-feature-flag`** — 用 `shared-cache` 缓存
- ... 等

加 adapter 入 `adapters/`：`cache-redis` / `error-reporting-glitchtip` / `storage-local` / `storage-s3` / `notification-smtp` / `realtime-sse` 等。

## 相关

- plan-full `§shared-*` 章节（每包对应一节）
- plan-full `§里程碑` — M2 范围
- `docs/dev-setup.md` — 开发环境搭建
