import { ErrorCode } from '@tripod-stack/shared-types';
import { describe, expect, it } from 'vitest';

import { err, isApiSuccess, ok } from '../src/envelope.js';

describe('ok', () => {
  it('无 meta', () => {
    const r = ok({ id: 1 });
    expect(r).toEqual({ success: true, data: { id: 1 } });
  });

  it('带 meta', () => {
    const r = ok([1, 2], {
      pagination: { limit: 20, hasMore: false },
    });
    expect(r.success).toBe(true);
    expect(r.meta?.pagination?.limit).toBe(20);
  });
});

describe('err', () => {
  it('包 ErrorBody', () => {
    const r = err({
      code: ErrorCode.AUTH_TOKEN_EXPIRED,
      message: 'expired',
      correlationId: 'abc',
      timestamp: '2026-04-22T00:00:00Z',
    });
    expect(r.success).toBe(false);
    expect(r.error.code).toBe('AUTH_TOKEN_EXPIRED');
  });
});

describe('isApiSuccess', () => {
  it('判 success', () => {
    expect(isApiSuccess(ok(1))).toBe(true);
    expect(
      isApiSuccess(
        err({
          code: 'X',
          message: '',
          correlationId: '',
          timestamp: '',
        }),
      ),
    ).toBe(false);
  });
});
