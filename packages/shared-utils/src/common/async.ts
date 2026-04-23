/**
 * 延时 N 毫秒。测试 / 重试 backoff 用。
 *
 * @example
 * await delay(500); // 等 500ms
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 给 Promise 加超时保护。超时 reject `TimeoutError`。
 *
 * @param promise - 目标 Promise
 * @param ms - 超时毫秒
 * @param message - 可选超时错误文字
 *
 * @example
 * await withTimeout(fetch('/slow'), 5000)
 *   .catch((e) => { if (e.name === 'TimeoutError') retry(); else throw e; });
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = `Operation timed out after ${String(ms)}ms`,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(message);
      err.name = 'TimeoutError';
      reject(err);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/**
 * 指数退避重试。默认 3 次、起始 100ms、因子 2。
 *
 * @param fn - 要重试的 async 函数
 * @param options.attempts - 最大尝试次数（含首次），默认 3
 * @param options.baseMs - 首次等待（下一次重试前），默认 100
 * @param options.factor - 每次 backoff 倍数，默认 2
 * @param options.shouldRetry - 自定义判定，返回 false 时不再重试，默认重试所有错误
 *
 * @example
 * // 幂等操作：网络瞬断重试 5 次
 * await retry(() => fetch(url), { attempts: 5, baseMs: 200 })
 *
 * // 区分可重试错误：429 / 5xx 重试，其他直接抛
 * await retry(doHttp, {
 *   shouldRetry: (e) => e.response?.status >= 500 || e.response?.status === 429
 * })
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    readonly attempts?: number;
    readonly baseMs?: number;
    readonly factor?: number;
    readonly shouldRetry?: (err: unknown) => boolean;
  } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseMs = options.baseMs ?? 100;
  const factor = options.factor ?? 2;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i === attempts - 1 || !shouldRetry(err)) throw err;
      await delay(baseMs * Math.pow(factor, i));
    }
  }
  throw lastError;
}
