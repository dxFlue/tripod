import { describe, expect, it } from 'vitest';

import {
  asCorrelationId,
  asIdempotencyKey,
  asPermissionId,
  asTenantId,
  asUserId,
  parsePermissionId,
  parseUuid,
} from '../src/ids/branded.js';

describe('asXxx 工厂：运行时等同 string', () => {
  it('asTenantId 不改变运行时值', () => {
    const raw = '123e4567-e89b-42d3-a456-426614174000';
    const id = asTenantId(raw);
    expect(id).toBe(raw);
    expect(typeof id).toBe('string');
  });

  it('所有 asXxx 方法不抛错（纯类型断言）', () => {
    expect(() => asUserId('any')).not.toThrow();
    expect(() => asCorrelationId('any')).not.toThrow();
    expect(() => asPermissionId('any')).not.toThrow();
    expect(() => asIdempotencyKey('any')).not.toThrow();
  });
});

describe('parseUuid', () => {
  it('通过合法 UUID v7', () => {
    expect(parseUuid('019558d0-1e45-7abc-92f4-4a6b1d5e3f8c')).not.toBeNull();
  });

  it('通过合法 UUID v4', () => {
    expect(parseUuid('123e4567-e89b-42d3-a456-426614174000')).not.toBeNull();
  });

  it('拒绝错误格式', () => {
    expect(parseUuid('not-a-uuid')).toBeNull();
    expect(parseUuid('123e4567-e89b-12d3-a456')).toBeNull(); // 短
    expect(parseUuid('')).toBeNull();
  });

  it('大小写不敏感', () => {
    expect(parseUuid('123E4567-E89B-42D3-A456-426614174000')).not.toBeNull();
  });
});

describe('parsePermissionId', () => {
  it('通过合法权限 id', () => {
    expect(parsePermissionId('order:read:own')).toBe('order:read:own');
    expect(parsePermissionId('user_profile:write:all')).toBe('user_profile:write:all');
  });

  it('拒绝非三段', () => {
    expect(parsePermissionId('order:read')).toBeNull();
    expect(parsePermissionId('order:read:own:extra')).toBeNull();
    expect(parsePermissionId('order')).toBeNull();
  });

  it('拒绝大写 / 空段', () => {
    expect(parsePermissionId('ORDER:read:own')).toBeNull();
    expect(parsePermissionId(':read:own')).toBeNull();
    expect(parsePermissionId('order::own')).toBeNull();
  });
});
