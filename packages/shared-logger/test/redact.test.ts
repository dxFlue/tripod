import { describe, expect, it } from 'vitest';

import { DEFAULT_REDACT_PATHS, redactObject } from '../src/shared/redact-rules.js';
import { LOG_LEVELS, isLogLevel, LOG_LEVEL_VALUES } from '../src/shared/log-level.js';

describe('redactObject', () => {
  it('顶层敏感字段替换', () => {
    const input = { username: 'alice', password: 'secret' };
    const out = redactObject(input) as Record<string, string>;
    expect(out['username']).toBe('alice');
    expect(out['password']).toBe('[Redacted]');
  });

  it('嵌套字段替换', () => {
    const input = {
      user: { name: 'bob', token: 'abc' },
      headers: { authorization: 'Bearer xyz' },
    };
    const out = redactObject(input) as {
      user: Record<string, string>;
      headers: Record<string, string>;
    };
    expect(out.user.token).toBe('[Redacted]');
    expect(out.headers.authorization).toBe('[Redacted]');
  });

  it('数组内对象字段', () => {
    const input = { users: [{ name: 'a', password: 'x' }] };
    const out = redactObject(input) as { users: Array<Record<string, string>> };
    expect(out.users[0]?.['password']).toBe('[Redacted]');
  });

  it('自定义 keys', () => {
    const out = redactObject({ licenseKey: 'L123', other: 'x' }, ['licenseKey']) as Record<
      string,
      string
    >;
    expect(out['licenseKey']).toBe('[Redacted]');
    expect(out['other']).toBe('x');
  });

  it('null / primitive 不改', () => {
    expect(redactObject(null)).toBeNull();
    expect(redactObject(42)).toBe(42);
    expect(redactObject('hi')).toBe('hi');
  });

  it('DEFAULT_REDACT_PATHS 非空且含核心字段', () => {
    expect(DEFAULT_REDACT_PATHS).toContain('password');
    expect(DEFAULT_REDACT_PATHS).toContain('accessToken');
  });
});

describe('LogLevel helpers', () => {
  it('LOG_LEVELS 6 项', () => {
    expect(LOG_LEVELS).toEqual(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
  });

  it('isLogLevel 识别合法值', () => {
    expect(isLogLevel('info')).toBe(true);
    expect(isLogLevel('critical')).toBe(false);
  });

  it('LOG_LEVEL_VALUES 匹配 pino 规范', () => {
    expect(LOG_LEVEL_VALUES.info).toBe(30);
    expect(LOG_LEVEL_VALUES.fatal).toBe(60);
  });
});
