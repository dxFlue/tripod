import { asCorrelationId, asTenantId, asUserId } from '@tripod-stack/shared-types';
import { describe, expect, it } from 'vitest';

import {
  generateCorrelationId,
  getCorrelationContext,
  requireCorrelationContext,
  withCorrelationContext,
} from '../src/correlation/als.js';

describe('withCorrelationContext', () => {
  it('在 run 内可拿到 context', () => {
    const ctx = {
      correlationId: asCorrelationId('c1'),
      tenantId: asTenantId('t1'),
      userId: asUserId('u1'),
    };
    const result = withCorrelationContext(ctx, () => getCorrelationContext());
    expect(result).toBe(ctx);
  });

  it('嵌套 run 覆盖', () => {
    const outer = { correlationId: asCorrelationId('outer') };
    const inner = { correlationId: asCorrelationId('inner') };
    withCorrelationContext(outer, () => {
      withCorrelationContext(inner, () => {
        expect(getCorrelationContext()?.correlationId).toBe('inner');
      });
      expect(getCorrelationContext()?.correlationId).toBe('outer');
    });
  });

  it('run 外 getCorrelationContext 返回 undefined', () => {
    expect(getCorrelationContext()).toBeUndefined();
  });

  it('异步 task 继承 context', async () => {
    const ctx = { correlationId: asCorrelationId('async-test') };
    const result = await withCorrelationContext(ctx, async () => {
      await new Promise((r) => setTimeout(r, 1));
      return getCorrelationContext();
    });
    expect(result).toBe(ctx);
  });
});

describe('requireCorrelationContext', () => {
  it('有 context 时返回', () => {
    const ctx = { correlationId: asCorrelationId('r1') };
    withCorrelationContext(ctx, () => {
      expect(requireCorrelationContext()).toBe(ctx);
    });
  });

  it('无 context 时抛错', () => {
    expect(() => requireCorrelationContext()).toThrow(/CorrelationContext/);
  });
});

describe('generateCorrelationId', () => {
  it('生成合法 UUID v4', () => {
    const id = generateCorrelationId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('每次都不同', () => {
    expect(generateCorrelationId()).not.toBe(generateCorrelationId());
  });
});
