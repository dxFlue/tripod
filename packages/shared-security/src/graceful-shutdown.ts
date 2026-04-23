import type { INestApplication } from '@nestjs/common';

/**
 * 优雅关停选项。
 */
export interface GracefulShutdownOptions {
  /** 等待 in-flight 请求完成的最长时间（毫秒）。默认 25000（25s，留 5s 给 pod gracePeriod 30s）。 */
  readonly drainTimeoutMs?: number;
  /** 收到信号后调用的业务 hook（关 queue / flush log / 关 DB / 等）。按注册顺序执行；任一抛错继续下一个。 */
  readonly hooks?: readonly ShutdownHook[];
  /** 日志回调；默认 console.log */
  readonly logger?: (msg: string, extra?: Record<string, unknown>) => void;
}

/** 关停钩子：业务 cleanup 逻辑。 */
export interface ShutdownHook {
  readonly name: string;
  /** 每个 hook 最长等 5 秒，超时跳过。 */
  run(): Promise<void>;
}

const DEFAULT_HOOK_TIMEOUT_MS = 5000;

/**
 * 注册 SIGTERM / SIGINT 优雅关停（plan-full §security §SIGTERM 六步）。
 *
 * 步骤：
 * 1. 收 SIGTERM → 停接新流量（`app.close()` 异步触发）
 * 2. 运行业务 hooks（按顺序）—— 通常：关 BullMQ queue、关 Redis、关 Prisma、flush pino logger
 * 3. 等 in-flight 请求完成（`drainTimeoutMs` 内）
 * 4. `app.close()` 完成关闭
 * 5. 超时强制退出（避免挂死）
 * 6. process.exit(0)
 *
 * @example
 * // apps/server/src/main.ts
 * const app = await NestFactory.create(AppModule);
 * registerGracefulShutdown(app, {
 *   drainTimeoutMs: 25_000,
 *   hooks: [
 *     { name: 'close-bullmq', run: () => queueModule.close() },
 *     { name: 'close-prisma', run: () => prisma.$disconnect() },
 *   ],
 * });
 */
export function registerGracefulShutdown(
  app: INestApplication,
  options: GracefulShutdownOptions = {},
): () => Promise<void> {
  const drainTimeoutMs = options.drainTimeoutMs ?? 25_000;
  const hooks = options.hooks ?? [];
  const log =
    options.logger ??
    ((m: string, x?: Record<string, unknown>): void => {
      const extra = x !== undefined ? ' ' + JSON.stringify(x) : '';
      process.stderr.write(`${m}${extra}\n`);
    });
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('graceful-shutdown: start', { signal });

    const force = setTimeout(() => {
      log('graceful-shutdown: force-exit (timeout)', { timeoutMs: drainTimeoutMs });
      process.exit(1);
    }, drainTimeoutMs);
    force.unref();

    // 业务 hooks
    for (const hook of hooks) {
      const start = Date.now();
      try {
        await withHookTimeout(hook.run(), DEFAULT_HOOK_TIMEOUT_MS);
        log('graceful-shutdown: hook ok', { name: hook.name, ms: Date.now() - start });
      } catch (err) {
        log('graceful-shutdown: hook failed', {
          name: hook.name,
          ms: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 关 Nest app（等 in-flight 请求）
    try {
      await app.close();
      log('graceful-shutdown: app closed');
    } catch (err) {
      log('graceful-shutdown: app close failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    clearTimeout(force);
    log('graceful-shutdown: done');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  return async () => {
    await shutdown('manual');
  };
}

async function withHookTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`hook timeout after ${String(ms)}ms`));
    }, ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
