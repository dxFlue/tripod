# @tripod-stack/shared-config

Tripod 环境变量 **Zod schema** + **`loadEnv()` 纯函数**。启动 fail-fast，不合法立即抛 `EnvValidationError`。

**Framework-agnostic**：不引 `@nestjs/*`，NestJS `ConfigModule` 由 apps 自己包一层。

## 依赖位置

- **层级**：基础层（阶段 1）
- **依赖**：`shared-types`、`zod`
- **被谁依赖**：所有 apps 的启动代码

## 公共 API

| 名称                       | 签名                                               | 作用                                                                                                                          | 错误                 |
| -------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `baseEnvSchema`            | `z.ZodObject`                                      | M2 核心 env 字段（NODE*ENV/PORT/LOG_LEVEL/DATABASE_URL/REDIS_URL/JWT*_/CORS*ORIGINS/GLITCHTIP_DSN/OTEL*_/STORAGE*\*/SMTP*\*） | —                    |
| `BaseEnv`                  | `type = z.infer<typeof baseEnvSchema>`             | base schema 推断类型                                                                                                          | —                    |
| `loadEnv(schema, source?)` | `<T>(schema: T, source=process.env) => z.infer<T>` | 校验 + 返回类型安全 env 对象                                                                                                  | `EnvValidationError` |
| `mergeSchemas(a, b)`       | `(a: ZodObject, b: ZodObject) => ZodObject`        | 合并两个 object schema（重名 b 覆盖 a）                                                                                       | —                    |
| `EnvValidationError`       | `class extends Error`                              | 校验失败抛的错；含 `.issues` / `.formatIssues()` / `.code = ErrorCode.SYSTEM_CONFIG_INVALID`                                  | —                    |

## baseEnvSchema 字段清单

| 字段                                                                                    | 类型                                        | 默认                                          | 说明                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------- | --------------------------- |
| `NODE_ENV`                                                                              | `development\|test\|staging\|production`    | `'development'`                               |                             |
| `PORT`                                                                                  | `number` (coerce)                           | `3000`                                        | HTTP 端口                   |
| `LOG_LEVEL`                                                                             | `trace\|debug\|info\|warn\|error\|fatal`    | `'info'`                                      | pino 级别                   |
| `DATABASE_URL`                                                                          | `string`（`postgres://` / `postgresql://`） | ⭐必填                                        |                             |
| `REDIS_URL`                                                                             | `string`（`redis://` / `rediss://`）        | ⭐必填                                        |                             |
| `JWT_SECRET`                                                                            | `string`（≥32）                             | ⭐必填                                        | `openssl rand -hex 32` 生成 |
| `JWT_ACCESS_TTL_SEC`                                                                    | `number`                                    | `900`（15min）                                | access token 生存期         |
| `JWT_REFRESH_TTL_SEC`                                                                   | `number`                                    | `604800`（7d）                                | refresh token 生存期        |
| `CORS_ORIGINS`                                                                          | `string`（逗号分隔）                        | `http://localhost:5173,http://localhost:3000` |                             |
| `GLITCHTIP_DSN`                                                                         | `URL`                                       | 可选                                          | 错误上报                    |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                                                           | `URL`                                       | 可选                                          | OTEL endpoint               |
| `STORAGE_PROVIDER`                                                                      | `local\|s3\|oss\|cos`                       | `'local'`                                     |                             |
| `STORAGE_LOCAL_ROOT`                                                                    | `string`                                    | `./storage`                                   | provider=local 时           |
| `S3_*`                                                                                  | `string`                                    | 可选                                          | provider=s3 时              |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` / `SMTP_SECURE` | 对应类型                                    | mailhog 默认（本地）                          | 邮件通道                    |

## 使用示例

### Golden path（Nest app 启动）

```ts
// apps/server/src/main.ts
import { baseEnvSchema, EnvValidationError, loadEnv } from '@tripod-stack/shared-config';

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

// 之后 NestFactory.create + ConfigModule.forRoot({ load: [() => env] })
```

### 业务 app 扩展 schema

```ts
// apps/server/src/env.ts
import { baseEnvSchema, mergeSchemas } from '@tripod-stack/shared-config';
import { z } from 'zod';

const appSchema = z.object({
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  ORDER_EXPIRY_HOURS: z.coerce.number().int().positive().default(24),
});

export const appEnvSchema = mergeSchemas(baseEnvSchema, appSchema);
export type AppEnv = z.infer<typeof appEnvSchema>;
```

## 反模式 ❌ vs 正确 ✅

### 1. 不要在业务代码 `process.env.XXX`

❌

```ts
const dbUrl = process.env.DATABASE_URL; // 无类型，可能 undefined，启动期不校验
```

✅

```ts
// 通过 loadEnv() 拿到校验过的 env
// 业务 controller/service 注入 env（Nest：ConfigService）
```

### 2. 不要 silent fallback

❌

```ts
const secret = process.env.JWT_SECRET || 'dev-fallback'; // 生产忘设也能起，灾难
```

✅

```ts
// JWT_SECRET 在 baseEnvSchema 里是 required + min(32)，缺了 loadEnv 就抛
```

### 3. 不要在 shared-config 里包 Nest 相关代码

❌

```ts
// 本包 import @nestjs/* → 前端 / Vite 也要打进这些 → 体积爆
```

✅

```ts
// 本包只导出纯函数；apps/server 里写 NestConfigModule.forRoot({ validate: loadEnv })
```

## 相关

- `@tripod-stack/shared-types` — `ErrorCode.SYSTEM_CONFIG_INVALID`
- `apps/cli` — `tripod env:validate` / `tripod env:gen-example` / `tripod env:doctor`
- plan-full `§Secrets 管理：本地维护 + 打包捎带`
