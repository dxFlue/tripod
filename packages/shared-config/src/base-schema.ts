import { z } from 'zod';

/**
 * Tripod M2 基础 env schema。
 *
 * 业务 app 在自己的 env.ts 里通过 `mergeSchemas(baseEnvSchema, appSchema)` 扩展。
 *
 * **硬规则**：每次新增 env 变量必须同步：
 * 1. 加到业务 app 的 env.ts schema
 * 2. 跑 `pnpm tripod env:gen-example > infra/deploy/.env.prod.example` 同步模板
 * 3. 把新 key 加到 `secrets/.env.prod` 本地填真值
 */
export const baseEnvSchema = z.object({
  // ===== 运行时 =====
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // ===== 数据库 =====
  DATABASE_URL: z
    .string()
    .min(10)
    .refine(
      (v) => v.startsWith('postgres://') || v.startsWith('postgresql://'),
      'DATABASE_URL must start with postgres:// or postgresql://',
    ),

  // ===== Redis =====
  REDIS_URL: z
    .string()
    .min(5)
    .refine((v) => v.startsWith('redis://') || v.startsWith('rediss://')),

  // ===== JWT / Session =====
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 chars (use `openssl rand -hex 32` to generate)'),
  JWT_ACCESS_TTL_SEC: z.coerce.number().int().positive().default(900), // 15min
  JWT_REFRESH_TTL_SEC: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 7), // 7d

  // ===== CORS =====
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),

  // ===== 观察栈（可选） =====
  GLITCHTIP_DSN: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),

  // ===== 存储 adapter（M2 默认 local） =====
  STORAGE_PROVIDER: z.enum(['local', 's3', 'oss', 'cos']).default('local'),
  STORAGE_LOCAL_ROOT: z.string().default('./storage'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_REGION: z.string().optional(),

  // ===== Email（SMTP，M2 默认） =====
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().max(65535).default(1025), // mailhog default
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().default('noreply@tripod.local'),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('false'),
});

/** base schema 推断类型 */
export type BaseEnv = z.infer<typeof baseEnvSchema>;
