import { ErrorCode } from '@tripod-stack/shared-types';
import { afterEach, describe, expect, it } from 'vitest';

import {
  _clearStatusMapping,
  getDefaultMapping,
  getHttpStatus,
  registerStatusMapping,
} from '../src/status-mapping.js';

afterEach(() => {
  _clearStatusMapping();
});

describe('getHttpStatus 默认映射', () => {
  it.each<[ErrorCode, number]>([
    [ErrorCode.AUTH_TOKEN_EXPIRED, 401],
    [ErrorCode.PERMISSION_DENIED, 403],
    [ErrorCode.NOT_FOUND, 404],
    [ErrorCode.CONFLICT, 409],
    [ErrorCode.IDEMPOTENCY_IN_FLIGHT, 409],
    [ErrorCode.RATE_LIMIT_EXCEEDED, 429],
    [ErrorCode.VALIDATION_FAILED, 400],
    [ErrorCode.TENANT_ISOLATION_VIOLATION, 403],
    [ErrorCode.TENANT_SUSPENDED, 403],
    [ErrorCode.SYSTEM_UNKNOWN, 500],
    [ErrorCode.SYSTEM_MAINTENANCE, 503],
    [ErrorCode.SYSTEM_DEPENDENCY_TIMEOUT, 504],
  ])('%s → %i', (code, expected) => {
    expect(getHttpStatus(code)).toBe(expected);
  });

  it('未知 code 默认 500', () => {
    expect(getHttpStatus('RANDOM_UNKNOWN_CODE')).toBe(500);
  });
});

describe('registerStatusMapping', () => {
  it('业务注册覆盖默认', () => {
    registerStatusMapping('ORDER_EXPIRED', 410);
    expect(getHttpStatus('ORDER_EXPIRED')).toBe(410);
  });

  it('覆盖已有映射', () => {
    registerStatusMapping(ErrorCode.SYSTEM_UNKNOWN, 503);
    expect(getHttpStatus(ErrorCode.SYSTEM_UNKNOWN)).toBe(503);
  });

  it('非法 status 抛 RangeError', () => {
    expect(() => registerStatusMapping('X', 42)).toThrow(RangeError);
    expect(() => registerStatusMapping('X', 600)).toThrow(RangeError);
  });
});

describe('getDefaultMapping', () => {
  it('返回默认映射副本', () => {
    const m = getDefaultMapping();
    expect(m[ErrorCode.AUTH_TOKEN_EXPIRED]).toBe(401);
  });
});
