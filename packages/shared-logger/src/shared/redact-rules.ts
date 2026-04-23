/**
 * 日志 / 错误上报统一 redact 规则。server 和 client 都用这套默认规则，业务可扩展。
 *
 * Pino 接受 `redact.paths`（dot-path 数组），匹配到的字段会被替换为 `[Redacted]`。
 * 我们同时导出一个 `redactObject()` 纯函数供 client Sentry beforeSend 用。
 */
export const DEFAULT_REDACT_PATHS: readonly string[] = Object.freeze([
  // Auth
  'password',
  '*.password',
  'password_confirm',
  'oldPassword',
  'newPassword',

  // Tokens
  'token',
  '*.token',
  'accessToken',
  'refreshToken',
  'bearerToken',
  'jwtSecret',
  'sessionToken',

  // API keys
  'apiKey',
  'api_key',
  '*.apiKey',
  'secretKey',
  'secret_key',

  // PII（业务可按需调整）
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
  'idNumber',

  // Headers（常见敏感 header name 小写）
  'headers.authorization',
  'headers.cookie',
  'headers["x-api-key"]',
  'req.headers.authorization',
  'req.headers.cookie',
]);

/** redactObject 的替换占位符。 */
export const REDACTED_PLACEHOLDER = '[Redacted]';

/**
 * 递归拷贝 object，把 path 命中的字段值替换为 `[Redacted]`。
 *
 * ⚠ 只匹配字段名（key），不支持复杂 path 的 glob；对于简单场景已够用。client Sentry
 * beforeSend 推荐用这个清洗结构化 extras。
 *
 * @example
 * redactObject({ user: { name: 'x', password: 'secret' }}, ['password'])
 * // { user: { name: 'x', password: '[Redacted]' } }
 */
export function redactObject(
  input: unknown,
  sensitiveKeys: readonly string[] = DEFAULT_REDACT_PATHS,
): unknown {
  const keySet = new Set(
    sensitiveKeys
      .map((p) => {
        // 取最后一段 key（去 '*.' / 'x.y.'）
        const segs = p.split(/\.|\[|\]/).filter((s) => s.length > 0);
        return segs[segs.length - 1];
      })
      .filter((k): k is string => k !== undefined && k !== '*'),
  );

  function walk(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(walk);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = keySet.has(k) ? REDACTED_PLACEHOLDER : walk(v);
    }
    return result;
  }

  return walk(input);
}
