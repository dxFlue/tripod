import { describe, expect, it } from 'vitest';

import {
  ErrorCode,
  getErrorDomain,
  isAuthRejection,
  ERROR_CODE_DOMAINS,
} from '../src/errors/codes.js';

describe('ErrorCode enum 完整性', () => {
  it('所有 ErrorCode 值和 key 同名（string enum 约定）', () => {
    for (const [key, value] of Object.entries(ErrorCode)) {
      expect(value).toBe(key);
    }
  });

  it('所有 ErrorCode 可被 getErrorDomain 归类到已知 domain', () => {
    for (const code of Object.values(ErrorCode)) {
      const domain = getErrorDomain(code as ErrorCode);
      expect(ERROR_CODE_DOMAINS).toContain(domain);
    }
  });
});

describe('getErrorDomain', () => {
  it('正确提取 AUTH 前缀', () => {
    expect(getErrorDomain(ErrorCode.AUTH_TOKEN_EXPIRED)).toBe('AUTH');
    expect(getErrorDomain(ErrorCode.AUTH_OTP_INVALID)).toBe('AUTH');
  });

  it('正确提取 SYSTEM 前缀', () => {
    expect(getErrorDomain(ErrorCode.SYSTEM_UNKNOWN)).toBe('SYSTEM');
    expect(getErrorDomain(ErrorCode.SYSTEM_DB_CONNECTION_FAILED)).toBe('SYSTEM');
  });

  it('正确提取 TENANT 前缀', () => {
    expect(getErrorDomain(ErrorCode.TENANT_SUSPENDED)).toBe('TENANT');
  });

  it('未知前缀 fallback 到 SYSTEM', () => {
    expect(getErrorDomain('WEIRD_UNKNOWN' as ErrorCode)).toBe('SYSTEM');
  });
});

describe('isAuthRejection', () => {
  it('401 族返回 true', () => {
    expect(isAuthRejection(ErrorCode.AUTH_UNAUTHENTICATED)).toBe(true);
    expect(isAuthRejection(ErrorCode.AUTH_TOKEN_EXPIRED)).toBe(true);
    expect(isAuthRejection(ErrorCode.AUTH_TOKEN_INVALID)).toBe(true);
    expect(isAuthRejection(ErrorCode.AUTH_TOKEN_REVOKED)).toBe(true);
    expect(isAuthRejection(ErrorCode.AUTH_SESSION_INVALID)).toBe(true);
  });

  it('非 401 族返回 false', () => {
    expect(isAuthRejection(ErrorCode.AUTH_INVALID_CREDENTIALS)).toBe(false);
    expect(isAuthRejection(ErrorCode.AUTH_ACCOUNT_LOCKED)).toBe(false);
    expect(isAuthRejection(ErrorCode.AUTH_OTP_EXPIRED)).toBe(false);
    expect(isAuthRejection(ErrorCode.PERMISSION_DENIED)).toBe(false);
    expect(isAuthRejection(ErrorCode.SYSTEM_UNKNOWN)).toBe(false);
  });
});
