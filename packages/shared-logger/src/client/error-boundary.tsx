import {
  ErrorBoundary as REBErrorBoundary,
  type FallbackProps,
  type ErrorBoundaryProps as REBProps,
} from 'react-error-boundary';

/**
 * Fallback 渲染参数。来自 `react-error-boundary`，重命名以匹配 tripod 语义。
 */
export type ErrorFallbackProps = FallbackProps;

/**
 * ErrorBoundary 属性。透传 react-error-boundary 的全部属性 —— 支持 `FallbackComponent`
 * 或 `fallbackRender` 两种写法。
 */
export type ErrorBoundaryProps = REBProps;

/**
 * 通用 React ErrorBoundary。内部走 `react-error-boundary` 包，对外 API 与其一致。
 *
 * ⚠ **只捕获渲染阶段错误**，不捕事件 handler / setTimeout / Promise —— 后者业务用
 * `useReportError()` + try/catch 主动上报。
 *
 * @example
 * // apps/admin-web/src/main.tsx
 * const ErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => (
 *   <div>
 *     <h1>出错了</h1>
 *     <pre>{error.message}</pre>
 *     <button onClick={resetErrorBoundary}>重试</button>
 *   </div>
 * );
 *
 * <ErrorBoundary
 *   FallbackComponent={ErrorFallback}
 *   onError={(err, info) => reporter.captureException(err, { componentStack: info.componentStack })}
 * >
 *   <App />
 * </ErrorBoundary>
 */
export const ErrorBoundary = REBErrorBoundary;
