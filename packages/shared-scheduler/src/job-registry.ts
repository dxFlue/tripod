import { getSchedulerJobOptions } from './scheduler-job.js';

export interface RegisteredJob {
  readonly name: string;
  readonly cron?: string;
  readonly intervalSec?: number;
  readonly distributed: boolean;
  readonly lockTtlSec: number;
  readonly timeoutMs: number;
  /** 真正执行任务的函数（业务 service 实例的方法绑定）。 */
  readonly handler: () => Promise<unknown>;
}

/**
 * JobRegistry —— 收集所有 @SchedulerJob 装饰的业务方法，供 apps 的 SchedulerService 启动时枚举。
 *
 * **注册模式**（两种都支持）：
 * 1. **自动扫描**：Nest 启动时遍历 provider 的 prototype 方法，有 metadata 的调 `registerFromInstance()`
 * 2. **手动**：直接 `register(job)`
 */
export class JobRegistry {
  private readonly jobs = new Map<string, RegisteredJob>();

  /**
   * 扫描业务 service 实例上所有带 @SchedulerJob 装饰的方法，注册它们。
   * 会忽略继承链上游（Object.prototype / 基类方法）。
   *
   * @throws {Error} 任务名冲突
   */
  public registerFromInstance(
    instance: object,
    options: { className?: string } = {},
  ): RegisteredJob[] {
    const proto = Object.getPrototypeOf(instance) as object;
    const className =
      options.className ?? (proto.constructor as { name?: string }).name ?? 'Anonymous';
    const methodNames = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor');
    const registered: RegisteredJob[] = [];
    for (const method of methodNames) {
      const opts = getSchedulerJobOptions(proto, method);
      if (opts === undefined) continue;
      const name = opts.name !== '' ? opts.name : `${className}.${method}`;
      const methodFn = (instance as unknown as Record<string, unknown>)[method];
      if (typeof methodFn !== 'function') continue;
      const handler = (methodFn as (...args: unknown[]) => unknown).bind(
        instance,
      ) as () => Promise<unknown>;
      const job: RegisteredJob = {
        name,
        ...(opts.cron !== undefined ? { cron: opts.cron } : {}),
        ...(opts.intervalSec !== undefined ? { intervalSec: opts.intervalSec } : {}),
        distributed: opts.distributed,
        lockTtlSec: opts.lockTtlSec,
        timeoutMs: opts.timeoutMs,
        handler,
      };
      this.register(job);
      registered.push(job);
    }
    return registered;
  }

  /** 手动注册一个 job。任务名冲突抛错。 */
  public register(job: RegisteredJob): void {
    if (this.jobs.has(job.name)) {
      throw new Error(`Duplicate scheduler job name: ${job.name}`);
    }
    this.jobs.set(job.name, job);
  }

  /** 拿全部 jobs（不可变副本）。 */
  public list(): readonly RegisteredJob[] {
    return [...this.jobs.values()];
  }

  public get(name: string): RegisteredJob | undefined {
    return this.jobs.get(name);
  }

  public clear(): void {
    this.jobs.clear();
  }
}

/**
 * 验证 cron 表达式格式（5 字段，宽松校验：不校验每字段的数值范围，只格式）。
 */
export function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  return parts.length === 5 && parts.every((p) => p.length > 0);
}
