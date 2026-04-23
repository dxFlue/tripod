import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { isValidCron, JobRegistry } from '../src/job-registry.js';
import { SchedulerJob } from '../src/scheduler-job.js';

class SampleSvc {
  ran: string[] = [];

  @SchedulerJob({ cron: '0 3 * * *', name: 'daily-cleanup' })
  async cleanup(): Promise<void> {
    this.ran.push('cleanup');
    return Promise.resolve();
  }

  @SchedulerJob({ intervalSec: 30 })
  async poll(): Promise<void> {
    this.ran.push('poll');
    return Promise.resolve();
  }

  async unmarkedMethod(): Promise<void> {
    return Promise.resolve();
  }
}

describe('JobRegistry', () => {
  it('扫描实例注册所有 @SchedulerJob 方法', () => {
    const reg = new JobRegistry();
    const svc = new SampleSvc();
    const jobs = reg.registerFromInstance(svc);
    expect(jobs).toHaveLength(2);
    expect(reg.list()).toHaveLength(2);
  });

  it('name 按 opts.name 或 className.method', () => {
    const reg = new JobRegistry();
    const svc = new SampleSvc();
    reg.registerFromInstance(svc);
    expect(reg.get('daily-cleanup')).toBeDefined();
    expect(reg.get('SampleSvc.poll')).toBeDefined();
  });

  it('handler 绑定到实例（调用能操作实例 state）', async () => {
    const reg = new JobRegistry();
    const svc = new SampleSvc();
    reg.registerFromInstance(svc);
    await reg.get('daily-cleanup')?.handler();
    expect(svc.ran).toContain('cleanup');
  });

  it('名字冲突：register 抛错', () => {
    const reg = new JobRegistry();
    reg.register({
      name: 'x',
      distributed: false,
      lockTtlSec: 10,
      timeoutMs: 1000,
      handler: async () => Promise.resolve(),
    });
    expect(() =>
      reg.register({
        name: 'x',
        distributed: false,
        lockTtlSec: 10,
        timeoutMs: 1000,
        handler: async () => Promise.resolve(),
      }),
    ).toThrow(/Duplicate/);
  });

  it('clear 清空', () => {
    const reg = new JobRegistry();
    reg.registerFromInstance(new SampleSvc());
    reg.clear();
    expect(reg.list()).toHaveLength(0);
  });
});

describe('isValidCron', () => {
  it('合法 5 字段', () => {
    expect(isValidCron('0 3 * * *')).toBe(true);
    expect(isValidCron('*/5 * * * *')).toBe(true);
  });

  it('字段数不对', () => {
    expect(isValidCron('0 3 *')).toBe(false);
    expect(isValidCron('0 3 * * * *')).toBe(false);
  });

  it('空串', () => {
    expect(isValidCron('')).toBe(false);
  });
});
