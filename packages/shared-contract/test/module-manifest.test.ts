import { describe, expect, it } from 'vitest';

import { defineModuleManifest } from '../src/module-manifest.js';

describe('defineModuleManifest', () => {
  it('identity 返回入参', () => {
    const m = defineModuleManifest({
      name: 'order',
      version: '0.1.0',
      permissions: ['order:read:own'],
    });
    expect(m.name).toBe('order');
    expect(m.permissions).toEqual(['order:read:own']);
  });

  it('保留完整 shape', () => {
    const m = defineModuleManifest({
      name: 'order',
      version: '0.1.0',
      permissions: ['order:read:own', 'order:write:all'],
      auditEvents: ['order.created'],
      transitions: {
        OrderStatus: [
          { from: 'DRAFT', to: 'CONFIRMED' },
          { from: 'CONFIRMED', to: 'SHIPPED' },
        ],
      },
      exportTypes: ['OrderDto'],
      featureFlags: ['order.allow-backorder'],
    });
    expect(m.transitions?.['OrderStatus']?.[0]).toEqual({ from: 'DRAFT', to: 'CONFIRMED' });
    expect(m.featureFlags).toContain('order.allow-backorder');
  });
});
