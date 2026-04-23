import { asCorrelationId, asTenantId, asUserId } from '@tripod-stack/shared-types';
import { withCorrelationContext } from '@tripod-stack/shared-contract';
import { describe, expect, it } from 'vitest';

import { createLogger } from '../src/server/logger.js';

describe('createLogger + ALS correlation 集成', () => {
  it('correlationAware=true（默认）时 ALS 有上下文不崩', () => {
    const logger = createLogger({ level: 'info', pretty: false });
    expect(() =>
      withCorrelationContext(
        {
          correlationId: asCorrelationId('corr-1'),
          tenantId: asTenantId('t-1'),
          userId: asUserId('u-1'),
        },
        () => {
          logger.info({ orderId: 'o-1' }, 'order created');
        },
      ),
    ).not.toThrow();
  });

  it('ALS 无上下文时也不崩', () => {
    const logger = createLogger({ level: 'info', pretty: false });
    expect(() => logger.info({ orderId: 'x' }, 'no-context')).not.toThrow();
  });

  it('correlationAware=false 时关闭 mixin', () => {
    const logger = createLogger({
      level: 'info',
      pretty: false,
      correlationAware: false,
    });
    expect(() => logger.info({ orderId: 'x' }, 'opt-out')).not.toThrow();
  });
});
