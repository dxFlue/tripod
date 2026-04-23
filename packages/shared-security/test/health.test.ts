import 'reflect-metadata';

import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  HealthController,
  type HealthCheckResult,
  type HealthProbe,
  type HealthProbeProvider,
} from '../src/health/health.controller.js';

describe('HealthController.liveness', () => {
  it('永远返 200 的 ok', () => {
    const ctrl = new HealthController();
    const r = ctrl.liveness();
    expect(r.status).toBe('ok');
    expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('HealthController.readiness', () => {
  const okProbe: HealthProbeProvider = {
    name: 'db',
    check: async (): Promise<HealthProbe> => Promise.resolve({ status: 'ok' }),
  };
  const downProbe: HealthProbeProvider = {
    name: 'redis',
    check: async (): Promise<HealthProbe> =>
      Promise.resolve({ status: 'down', message: 'ECONNREFUSED' }),
  };
  const throwProbe: HealthProbeProvider = {
    name: 'external-api',
    check: () => Promise.reject(new Error('boom')),
  };

  it('所有 probe ok：status=ok', async () => {
    const ctrl = new HealthController([okProbe]);
    const r = await ctrl.readiness();
    expect(r.status).toBe('ok');
    expect(r.probes['db']?.status).toBe('ok');
  });

  it('任一 down：抛 503（ServiceUnavailableException）', async () => {
    const ctrl = new HealthController([okProbe, downProbe]);
    await expect(ctrl.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('probe throw：当 down 处理，带 message', async () => {
    const ctrl = new HealthController([throwProbe]);
    try {
      await ctrl.readiness();
      throw new Error('should not reach');
    } catch (err) {
      const response = (err as ServiceUnavailableException).getResponse() as HealthCheckResult;
      expect(response.probes['external-api']?.status).toBe('down');
      expect(response.probes['external-api']?.message).toBe('boom');
    }
  });

  it('无 probe：status=ok', async () => {
    const ctrl = new HealthController();
    const r = await ctrl.readiness();
    expect(r.status).toBe('ok');
    expect(Object.keys(r.probes)).toHaveLength(0);
  });
});

describe('HealthController.startup', () => {
  it('行为与 readiness 一致', async () => {
    const ctrl = new HealthController();
    const r = await ctrl.startup();
    expect(r.status).toBe('ok');
  });
});
