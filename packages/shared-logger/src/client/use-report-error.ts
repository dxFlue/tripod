import { createContext, useCallback, useContext } from 'react';

/**
 * 错误上报 reporter 接口。
 * Stage 1 提供 noop 默认实现；生产环境用 adapter（如 adapter-error-reporting-glitchtip）
 * 在 apps 入口通过 `<ErrorReporterProvider value={glitchTipReporter}>` 覆盖。
 */
export interface ErrorReporter {
  captureException(error: unknown, context?: Readonly<Record<string, unknown>>): void;
  captureMessage(
    message: string,
    level?: 'info' | 'warning' | 'error',
    context?: Readonly<Record<string, unknown>>,
  ): void;
}

/** 默认 noop reporter（未装 adapter 时用）。 */
export const noopReporter: ErrorReporter = {
  captureException: () => {
    /* noop */
  },
  captureMessage: () => {
    /* noop */
  },
};

export const ErrorReporterContext = createContext<ErrorReporter>(noopReporter);
export const ErrorReporterProvider = ErrorReporterContext.Provider;

/**
 * `useReportError()` —— 组件里主动上报错误。
 *
 * 用于事件 handler / async 回调（ErrorBoundary 捕不到的场景）。
 *
 * @example
 * const report = useReportError();
 * const handleClick = async () => {
 *   try {
 *     await api.post(...);
 *   } catch (e) {
 *     report(e, { feature: 'order-submit' });
 *   }
 * };
 */
export function useReportError(): (
  error: unknown,
  extra?: Readonly<Record<string, unknown>>,
) => void {
  const reporter = useContext(ErrorReporterContext);
  return useCallback(
    (error, extra) => {
      reporter.captureException(error, extra);
    },
    [reporter],
  );
}
