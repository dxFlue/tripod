import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { getSchedulerJobOptions, SchedulerJob } from '../src/scheduler-job.js';

describe('@SchedulerJob', () => {
  it('读 cron 选项', () => {
    class Svc {
      @SchedulerJob({ cron: '0 3 * * *', name: 'cleanup' })
      run(): void {
        /* noop */
      }
    }
    const opts = getSchedulerJobOptions(Svc.prototype, 'run');
    expect(opts?.cron).toBe('0 3 * * *');
    expect(opts?.name).toBe('cleanup');
    expect(opts?.distributed).toBe(true);
    expect(opts?.lockTtlSec).toBe(300);
    expect(opts?.timeoutMs).toBe(180_000);
  });

  it('intervalSec 模式', () => {
    class Svc {
      @SchedulerJob({ intervalSec: 60, distributed: false })
      poll(): void {
        /* noop */
      }
    }
    const opts = getSchedulerJobOptions(Svc.prototype, 'poll');
    expect(opts?.intervalSec).toBe(60);
    expect(opts?.cron).toBeUndefined();
    expect(opts?.distributed).toBe(false);
  });

  it('既无 cron 也无 intervalSec：抛错', () => {
    expect(() => SchedulerJob({} as Parameters<typeof SchedulerJob>[0])).toThrow(
      /requires either `cron` or `intervalSec`/,
    );
  });

  it('cron 和 intervalSec 同时给：抛错', () => {
    expect(() => SchedulerJob({ cron: '* * * * *', intervalSec: 60 })).toThrow(
      /mutually exclusive/,
    );
  });
});
