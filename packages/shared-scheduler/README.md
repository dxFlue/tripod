# @tripod-stack/shared-scheduler

`@SchedulerJob()` 装饰器 + `DistributedLock`（走 CacheProvider 抽象）+ `JobRegistry`。

⚠ **生产多实例部署**必须通过 adapter 切 `cache-redis`（阶段 2 交付），否则锁退化为本地锁。

## 依赖位置

- **层级**：基础层（阶段 1）
- **依赖**：`shared-cache`（CacheProvider 抽象）/ `shared-contract` / `shared-types`
- **被谁依赖**：apps/server 的 SchedulerModule

## 公共 API

### 装饰器

| 名称                                  | 签名                                                                                    | 作用               |
| ------------------------------------- | --------------------------------------------------------------------------------------- | ------------------ |
| `SchedulerJob(opts)`                  | `MethodDecorator`                                                                       | 标记方法为定时任务 |
| `SchedulerJobOptions`                 | `{ cron?, intervalSec?, name?, distributed?=true, lockTtlSec?=300, timeoutMs?=180000 }` | 选项               |
| `getSchedulerJobOptions(target, key)` | metadata reader                                                                         | 扫描用             |
| `SCHEDULER_JOB_METADATA`              | Symbol                                                                                  | metadata key       |

**互斥**：`cron` 和 `intervalSec` 必须且只能传一个。

### 分布式锁

| 类                | 方法                                          | 作用                                                 |
| ----------------- | --------------------------------------------- | ---------------------------------------------------- |
| `DistributedLock` | `new DistributedLock(cacheProvider, logger?)` | 构造（InMemory 时警告）                              |
|                   | `acquire(key, ttlSec)`                        | 抢锁，成功返 release 函数；失败返 null               |
|                   | `withLock(key, ttlSec, fn)`                   | 高阶包装，返回 `{skipped} \| {skipped:false, value}` |

### JobRegistry

| 方法                                | 签名                          | 作用                       |
| ----------------------------------- | ----------------------------- | -------------------------- |
| `registerFromInstance(inst, opts?)` | 扫描 @SchedulerJob → 自动注册 | Nest onModuleInit 用       |
| `register(job)`                     | 手动注册                      | 名字冲突抛错               |
| `list()`                            | 返回所有 job                  | `readonly RegisteredJob[]` |
| `get(name)`                         | 按名查                        |                            |
| `clear()`                           | 清空（测试用）                |                            |

### 工具

| 名称                | 签名                  | 作用                      |
| ------------------- | --------------------- | ------------------------- |
| `isValidCron(expr)` | `(string) => boolean` | 格式校验（仅 5 字段数量） |

## 使用示例

### Golden path：业务 job + 启动时注册

```ts
// apps/server/src/jobs/order-cleanup.ts
import { Injectable } from '@nestjs/common';
import { SchedulerJob } from '@tripod-stack/shared-scheduler';

@Injectable()
export class OrderCleanupJob {
  constructor(private orderService: OrderService) {}

  @SchedulerJob({ cron: '0 3 * * *', name: 'order-cleanup', lockTtlSec: 600 })
  async run() {
    await this.orderService.cleanupExpired();
  }
}
```

```ts
// apps/server/src/scheduler/scheduler.service.ts
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DistributedLock, JobRegistry, type RegisteredJob } from '@tripod-stack/shared-scheduler';
import { CACHE_PROVIDER, type CacheProvider } from '@tripod-stack/shared-cache';
import * as cron from 'node-cron';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly registry = new JobRegistry();
  private readonly lock: DistributedLock;

  constructor(
    private readonly orderCleanup: OrderCleanupJob,
    @Inject(CACHE_PROVIDER) cache: CacheProvider,
  ) {
    this.lock = new DistributedLock(cache);
  }

  onModuleInit() {
    this.registry.registerFromInstance(this.orderCleanup);
    for (const job of this.registry.list()) this.schedule(job);
  }

  private schedule(job: RegisteredJob) {
    if (job.cron) {
      cron.schedule(job.cron, () => this.runOnce(job));
    } else if (job.intervalSec) {
      setInterval(() => this.runOnce(job), job.intervalSec * 1000);
    }
  }

  private async runOnce(job: RegisteredJob) {
    if (!job.distributed) return void job.handler();
    const r = await this.lock.withLock(job.name, job.lockTtlSec, () => job.handler());
    if (r.skipped) logger.info({ name: job.name }, 'job skipped (held by other instance)');
  }
}
```

### 并发保护

```ts
const lock = new DistributedLock(cacheProvider);

// 场景 1：acquire + 手动 release
const release = await lock.acquire('export-daily', 600);
if (!release) return; // 其他实例在跑
try {
  await exportDaily();
} finally {
  await release();
}

// 场景 2：withLock（推荐）
const result = await lock.withLock('export-daily', 600, () => exportDaily());
if (result.skipped) return;
```

## 反模式 ❌ vs 正确 ✅

### 1. 不要在生产多实例跑不加锁的 job

❌

```ts
@SchedulerJob({ cron: '0 0 * * *', distributed: false })  // 2 台机器各跑一次 → 数据重复
```

✅

```ts
@SchedulerJob({ cron: '0 0 * * *' })  // distributed: true 默认
```

### 2. 不要让 lockTtlSec 短于任务执行时间

❌

```ts
@SchedulerJob({ cron: '*/5 * * * *', lockTtlSec: 60 })  // 任务跑 80s → 锁释放 → 第二实例进入
// 如果任务不幂等 → 数据冲突
```

✅

```ts
@SchedulerJob({ cron: '*/5 * * * *', lockTtlSec: 240 })  // 覆盖 p99 执行时间
```

### 3. 不要在 job handler 里 throw 非 BusinessException

❌

```ts
throw new Error('something'); // 错误码缺失，alerts 难路由
```

✅

```ts
throw new BusinessException(ErrorCode.QUEUE_JOB_FAILED, 'cleanup failed', { jobName, cause });
```

## 相关

- `@tripod-stack/shared-cache` — `CacheProvider` / `InMemoryCacheProvider`
- `@tripod-stack/shared-contract` — `BusinessException` / 错误码
- adapter `cache-redis`（阶段 2 交付） — 生产 Redis 实现，满足多实例分布式锁
- plan-full `§shared-scheduler`
