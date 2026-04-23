import { describe, expect, it } from 'vitest';

import { getDeprecationHeaders, isDeprecatedResponse } from '../src/api-version.js';

describe('getDeprecationHeaders', () => {
  it('只有 sunsetDate', () => {
    const h = getDeprecationHeaders({
      deprecated: true,
      sunsetDate: '2027-01-01T00:00:00Z',
    });
    expect(h['Deprecation']).toBe('true');
    expect(h['Sunset']).toContain('2027');
  });

  it('带 since 和 replacement', () => {
    const h = getDeprecationHeaders({
      deprecated: true,
      since: '2026-04-22T00:00:00Z',
      sunsetDate: '2027-01-01T00:00:00Z',
      replacement: '/api/v2/orders',
    });
    expect(h['Deprecation']).toContain('2026');
    expect(h['Link']).toBe('</api/v2/orders>; rel="successor-version"');
  });
});

describe('isDeprecatedResponse', () => {
  it('识别 Deprecation header', () => {
    expect(isDeprecatedResponse({ Deprecation: 'true' })).toBe(true);
    expect(isDeprecatedResponse({ deprecation: 'true' })).toBe(true);
  });

  it('无 header', () => {
    expect(isDeprecatedResponse({})).toBe(false);
  });
});
