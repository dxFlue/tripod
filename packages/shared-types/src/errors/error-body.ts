import type { ErrorCode } from './codes.js';

/**
 * API 错误响应 body。所有业务错误必须返回这个形状。
 *
 * 前端拦截器必读字段：
 * - `code`    — 业务分支判断
 * - `message` — 已翻译（后端按 Accept-Language 选）的 human-readable 文字
 * - `correlationId` — 追溯日志
 */
export interface ErrorBody {
  /** 业务错误码（ErrorCode 枚举或业务扩展 string） */
  readonly code: ErrorCode | string;
  /** 已翻译的 human-readable 错误文字（按 Accept-Language） */
  readonly message: string;
  /** 可选：结构化细节，如 validation 里的字段错误 { field, reason } 数组 */
  readonly details?: Readonly<Record<string, unknown>> | readonly unknown[];
  /** 请求追溯 ID；前端报问题时带上这个 ID 给后端查日志 */
  readonly correlationId: string;
  /** 错误发生时间戳（ISO 8601） */
  readonly timestamp: string;
  /** 可选：后端建议的重试策略（仅限可重试的错误，如 RATE_LIMIT / SYSTEM_DEPENDENCY_TIMEOUT） */
  readonly retry?: {
    readonly retryable: boolean;
    readonly retryAfterMs?: number;
  };
}
