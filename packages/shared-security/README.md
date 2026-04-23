# @tripod-stack/shared-security

应用层安全基建：CORS + Helmet + body-limit + 健康检查三 probe + SIGTERM 优雅关停。

## 依赖位置

- **层级**：基础层（阶段 1）
- **依赖**：`shared-contract`、`helmet`；`@nestjs/common` / `@nestjs/core`（peer）
- **被谁依赖**：所有 Nest app（apps/server / apps/platform）

## 公共 API

### 安全配置

| 名称                        | 签名                                                                     | 作用                       |
| --------------------------- | ------------------------------------------------------------------------ | -------------------------- |
| `applySecurity(app, opts?)` | `(app: INestApplication, opts?: ApplySecurityOptions) => void`           | Helmet + CORS + body limit |
| `ApplySecurityOptions`      | `{ corsOrigins?, bodyLimitBytes?=1MB, helmetOptions?, exposedHeaders? }` | 选项                       |
| `parseOrigins(input)`       | `(string \| string[] \| undefined) => true \| string[]`                  | CORS origins 解析          |

### 健康检查

| 名称                  | 签名                                              | 作用                                                         |
| --------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| `HealthController`    | Controller                                        | `/health/liveness` / `/health/readiness` / `/health/startup` |
| `HealthProbeProvider` | `{ name, check(): Promise<HealthProbe> }`         | 业务实现自注册                                               |
| `HEALTH_PROBES`       | `Symbol` DI token                                 | `@Inject(HEALTH_PROBES) probes: HealthProbeProvider[]`       |
| `HealthCheckResult`   | `{ status, timestamp, probes }`                   | 返回结构                                                     |
| `HealthProbe`         | `{ status: 'ok'\|'down', durationMs?, message? }` | 单 probe 结果                                                |

### 三 probe 语义

| 路由                | K8s 用途        | 行为                                    |
| ------------------- | --------------- | --------------------------------------- |
| `/health/liveness`  | liveness probe  | **永远返 200**（进程还活着即可）        |
| `/health/readiness` | readiness probe | 所有 probe ok → 200；任一 down → 503    |
| `/health/startup`   | startup probe   | 和 readiness 同（语义上是"初始化完成"） |

⚠ Liveness **不能**跑 DB/Redis probe，否则 DB 短暂不可用 → K8s 重启循环 → 雪崩。

### 优雅关停

| 名称                                   | 签名                                         | 作用                     |
| -------------------------------------- | -------------------------------------------- | ------------------------ |
| `registerGracefulShutdown(app, opts?)` | `(app, opts?) => () => Promise<void>`        | 注册 SIGTERM/SIGINT 处理 |
| `GracefulShutdownOptions`              | `{ drainTimeoutMs?=25000, hooks?, logger? }` | 选项                     |
| `ShutdownHook`                         | `{ name, run(): Promise<void> }`             | 业务 cleanup             |

**SIGTERM 六步**：

1. 停接新流量（`app.close()` 异步触发）
2. 跑业务 hooks（关 queue / redis / prisma / flush log 等），按顺序，每个 5s 超时
3. 等 in-flight 请求完成（`drainTimeoutMs` 内）
4. `app.close()` 完成关闭
5. 超时强制 exit(1)
6. 正常完成 exit(0)

## 使用示例

### Golden path：Nest app 启动

```ts
// apps/server/src/main.ts
import { NestFactory } from '@nestjs/core';
import { applySecurity, registerGracefulShutdown } from '@tripod-stack/shared-security';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    rawBody: true,
  });

  applySecurity(app, {
    corsOrigins: process.env.CORS_ORIGINS, // 'http://localhost:5173,https://app.example.com'
    bodyLimitBytes: 2 * 1024 * 1024, // 2MB
  });

  registerGracefulShutdown(app, {
    drainTimeoutMs: 25_000,
    hooks: [
      { name: 'close-bullmq', run: () => app.get(QueueService).close() },
      { name: 'close-prisma', run: () => app.get(PrismaService).$disconnect() },
    ],
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

### 注册 readiness probe

```ts
// apps/server/src/health/db.probe.ts
import { Injectable } from '@nestjs/common';
import type { HealthProbeProvider, HealthProbe } from '@tripod-stack/shared-security';

@Injectable()
export class DbHealthProbe implements HealthProbeProvider {
  name = 'database';
  constructor(private prisma: PrismaService) {}
  async check(): Promise<HealthProbe> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}

// apps/server/src/health/health.module.ts
import { HealthController, HEALTH_PROBES } from '@tripod-stack/shared-security';

@Module({
  controllers: [HealthController],
  providers: [
    DbHealthProbe,
    RedisHealthProbe,
    {
      provide: HEALTH_PROBES,
      useFactory: (db: DbHealthProbe, redis: RedisHealthProbe) => [db, redis],
      inject: [DbHealthProbe, RedisHealthProbe],
    },
  ],
})
export class HealthModule {}
```

## 反模式 ❌ vs 正确 ✅

### 1. 不要在 liveness 跑 probe

❌

```ts
@Get('liveness')
async liveness() { return this.prisma.$queryRaw`SELECT 1`; }  // DB 抖动→K8s 重启→雪崩
```

✅

```ts
// shared-security 的 HealthController.liveness 已写对：永远 200
// 业务逻辑检查放 /readiness
```

### 2. CORS 生产不要配 "\*"

❌

```ts
applySecurity(app, { corsOrigins: '*' }); // credentials + * 浏览器也会拒；安全隐患
```

✅

```ts
applySecurity(app, { corsOrigins: process.env.CORS_ORIGINS });
// env: CORS_ORIGINS=https://admin.example.com,https://portal.example.com
```

### 3. 优雅关停 hooks 不要做重计算

❌

```ts
hooks: [{ name: 'flush-metrics', run: () => metrics.flushHeavy() }];
// 占 > 5s 被超时 kill
```

✅

```ts
hooks: [{ name: 'stop-accepting-jobs', run: () => queue.pause() }];
// 瞬间完成
```

## 相关

- `@tripod-stack/shared-logger` — `gracefulShutdown` 的 logger 回调可接 pino
- plan-full `§security §健康检查三 probe + SIGTERM 6 步`
