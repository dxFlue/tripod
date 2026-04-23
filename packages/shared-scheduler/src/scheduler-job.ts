import 'reflect-metadata';

export const SCHEDULER_JOB_METADATA = Symbol.for('tripod.shared-scheduler.job');

export interface SchedulerJobOptions {
  /**
   * Cron 表达式（标准 5 字段：分 时 日 月 星期）。
   * 例：`'0 3 * * *'` = 每天凌晨 3 点。
   * 必填；interval 模式见 `intervalSec`。
   */
  readonly cron?: string;
  /** 固定间隔（秒），和 cron 互斥。 */
  readonly intervalSec?: number;
  /** 任务名，未指定时走 `<ClassName>.<methodName>`。用于日志 / 锁 key。 */
  readonly name?: string;
  /**
   * 是否加分布式锁。默认 `true`（多实例部署下防止同一任务同时多执行）。
   * 单进程 dev 或特意并发的场景设 `false`。
   */
  readonly distributed?: boolean;
  /** 锁 TTL（秒）。默认 `300`（5 分钟，足够绝大多数定时任务）。 */
  readonly lockTtlSec?: number;
  /** 任务执行超时（毫秒）。超时强制 reject（不 kill job 逻辑，业务自己响应）。默认 `180_000`（3 分钟）。 */
  readonly timeoutMs?: number;
}

/**
 * `@SchedulerJob()` 方法装饰器 —— 标记方法为定时任务。
 *
 * 真正的调度循环由 apps 的 `SchedulerService` 执行（读元数据 + 用 `node-cron` 或
 * BullMQ repeatable job 注册）。本装饰器仅放元数据。
 *
 * @example
 * @Injectable()
 * export class OrderCleanupJob {
 *   @SchedulerJob({ cron: '0 3 * * *', name: 'order-cleanup', lockTtlSec: 600 })
 *   async run() {
 *     await this.orderService.cleanupExpired();
 *   }
 * }
 */
export function SchedulerJob(options: SchedulerJobOptions): MethodDecorator {
  if (options.cron === undefined && options.intervalSec === undefined) {
    throw new Error('@SchedulerJob requires either `cron` or `intervalSec`');
  }
  if (options.cron !== undefined && options.intervalSec !== undefined) {
    throw new Error('@SchedulerJob: `cron` and `intervalSec` are mutually exclusive');
  }

  const resolved: Required<Omit<SchedulerJobOptions, 'cron' | 'intervalSec'>> &
    Pick<SchedulerJobOptions, 'cron' | 'intervalSec'> = {
    ...(options.cron !== undefined ? { cron: options.cron } : {}),
    ...(options.intervalSec !== undefined ? { intervalSec: options.intervalSec } : {}),
    name: options.name ?? '',
    distributed: options.distributed ?? true,
    lockTtlSec: options.lockTtlSec ?? 300,
    timeoutMs: options.timeoutMs ?? 180_000,
  };
  return (target, propertyKey) => {
    Reflect.defineMetadata(SCHEDULER_JOB_METADATA, resolved, target, propertyKey);
  };
}

/** 读方法的 @SchedulerJob 元数据。 */
export function getSchedulerJobOptions(
  target: object,
  propertyKey: string | symbol,
):
  | (Required<Omit<SchedulerJobOptions, 'cron' | 'intervalSec'>> &
      Pick<SchedulerJobOptions, 'cron' | 'intervalSec'>)
  | undefined {
  return Reflect.getMetadata(SCHEDULER_JOB_METADATA, target, propertyKey) as
    | (Required<Omit<SchedulerJobOptions, 'cron' | 'intervalSec'>> &
        Pick<SchedulerJobOptions, 'cron' | 'intervalSec'>)
    | undefined;
}
