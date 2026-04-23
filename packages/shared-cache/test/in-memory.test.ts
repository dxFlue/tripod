import { describe, expect, it } from 'vitest';

import { InMemoryCacheProvider } from '../src/in-memory.js';

describe('InMemoryCacheProvider', () => {
  it('set + get 基础流程', async () => {
    const c = new InMemoryCacheProvider();
    await c.set('k', 'v');
    expect(await c.get('k')).toBe('v');
  });

  it('miss 返回 undefined', async () => {
    const c = new InMemoryCacheProvider();
    expect(await c.get('nonexistent')).toBeUndefined();
  });

  it('TTL 过期后 get 返回 undefined', async () => {
    const c = new InMemoryCacheProvider();
    await c.set('k', 'v', 0.05); // 50ms
    expect(await c.get('k')).toBe('v');
    await new Promise((r) => setTimeout(r, 80));
    expect(await c.get('k')).toBeUndefined();
  });

  it('TTL=0 视为永久（不推荐生产用）', async () => {
    const c = new InMemoryCacheProvider();
    await c.set('perm', 'v', 0);
    expect(await c.ttl('perm')).toBe(-1);
  });

  it('setNX 首次成功', async () => {
    const c = new InMemoryCacheProvider();
    expect(await c.setNX('lock', '1', 60)).toBe(true);
    expect(await c.setNX('lock', '2', 60)).toBe(false);
    expect(await c.get('lock')).toBe('1');
  });

  it('del 幂等', async () => {
    const c = new InMemoryCacheProvider();
    await c.set('k', 'v');
    await c.del('k');
    await c.del('k'); // 不抛
    expect(await c.has('k')).toBe(false);
  });

  it('has', async () => {
    const c = new InMemoryCacheProvider();
    expect(await c.has('k')).toBe(false);
    await c.set('k', 'v');
    expect(await c.has('k')).toBe(true);
  });

  it('ttl：不存在返回 -2', async () => {
    const c = new InMemoryCacheProvider();
    expect(await c.ttl('nonexistent')).toBe(-2);
  });

  it('ttl：有效期返回秒数', async () => {
    const c = new InMemoryCacheProvider();
    await c.set('k', 'v', 30);
    const t = await c.ttl('k');
    expect(t).toBeGreaterThan(25);
    expect(t).toBeLessThanOrEqual(30);
  });

  it('delByPrefix 返回删除数', async () => {
    const c = new InMemoryCacheProvider();
    await c.set('user:1', 'a');
    await c.set('user:2', 'b');
    await c.set('order:1', 'x');
    const count = await c.delByPrefix('user:');
    expect(count).toBe(2);
    expect(await c.has('order:1')).toBe(true);
    expect(await c.has('user:1')).toBe(false);
  });

  it('set 覆盖已有', async () => {
    const c = new InMemoryCacheProvider();
    await c.set('k', 'old');
    await c.set('k', 'new');
    expect(await c.get('k')).toBe('new');
  });

  it('clear 清空', async () => {
    const c = new InMemoryCacheProvider();
    await c.set('a', 1);
    await c.set('b', 2);
    c.clear();
    expect(await c.has('a')).toBe(false);
    expect(await c.has('b')).toBe(false);
  });
});
