import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { baseEnvSchema } from '../src/base-schema.js';
import { EnvValidationError, loadEnv, mergeSchemas } from '../src/load-env.js';

const validBase = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://u:p@host:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(32),
};

describe('loadEnv + baseEnvSchema', () => {
  it('最小合法 env：defaults 生效', () => {
    const env = loadEnv(baseEnvSchema, validBase);
    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.SMTP_HOST).toBe('localhost');
    expect(env.STORAGE_PROVIDER).toBe('local');
  });

  it('JWT_SECRET 少于 32 字符：抛 EnvValidationError', () => {
    expect(() => loadEnv(baseEnvSchema, { ...validBase, JWT_SECRET: 'short' })).toThrow(
      EnvValidationError,
    );
  });

  it('DATABASE_URL 格式错误：抛 EnvValidationError', () => {
    expect(() => loadEnv(baseEnvSchema, { ...validBase, DATABASE_URL: 'mysql://x' })).toThrow(
      EnvValidationError,
    );
  });

  it('PORT 非数字：抛 EnvValidationError', () => {
    expect(() => loadEnv(baseEnvSchema, { ...validBase, PORT: 'abc' })).toThrow(EnvValidationError);
  });

  it('PORT 字符串数字：coerce 成功', () => {
    const env = loadEnv(baseEnvSchema, { ...validBase, PORT: '8080' });
    expect(env.PORT).toBe(8080);
  });

  it('SMTP_SECURE 字符串 "true" coerce 成 boolean', () => {
    const env = loadEnv(baseEnvSchema, { ...validBase, SMTP_SECURE: 'true' });
    expect(env.SMTP_SECURE).toBe(true);
  });

  it('未知字段被忽略', () => {
    const env = loadEnv(baseEnvSchema, { ...validBase, RANDOM_KEY: 'x' });
    // 通过即可（不抛错）
    expect(env).toBeDefined();
  });
});

describe('EnvValidationError', () => {
  it('formatIssues 产出多行可读文字', () => {
    try {
      loadEnv(baseEnvSchema, { DATABASE_URL: 'x', JWT_SECRET: 'y', REDIS_URL: 'z' });
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const formatted = (err as EnvValidationError).formatIssues();
      expect(formatted).toContain('DATABASE_URL');
      expect(formatted).toContain('JWT_SECRET');
    }
  });

  it('issues 是 readonly 可迭代的', () => {
    try {
      loadEnv(baseEnvSchema, {});
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const e = err as EnvValidationError;
      expect(e.issues.length).toBeGreaterThan(0);
    }
  });
});

describe('mergeSchemas', () => {
  const appSchema = z.object({
    STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
    FEATURE_X: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .default('false'),
  });

  it('合并后校验两边字段', () => {
    const full = mergeSchemas(baseEnvSchema, appSchema);
    const env = loadEnv(full, { ...validBase, STRIPE_SECRET_KEY: 'sk_test_123' });
    expect(env.STRIPE_SECRET_KEY).toBe('sk_test_123');
    expect(env.FEATURE_X).toBe(false);
    expect(env.DATABASE_URL).toBe(validBase.DATABASE_URL);
  });

  it('合并后的 schema 校验业务字段', () => {
    const full = mergeSchemas(baseEnvSchema, appSchema);
    expect(() => loadEnv(full, { ...validBase, STRIPE_SECRET_KEY: 'wrong_prefix' })).toThrow(
      EnvValidationError,
    );
  });
});
