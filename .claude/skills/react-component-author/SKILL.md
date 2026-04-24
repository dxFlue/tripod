---
name: react-component-author
description: |
  引导 AI 在 tripod 的 React app（`apps/admin-web` / `apps/platform` / `apps/portal` / `apps/mall-web`）下新建一个组件 / 页面时按硬规则走：
  函数组件（禁 class）、逻辑与 UI 分离、权限 `<Gate>` / feature flag `<Flag>` / 错误边界 / i18n / analytics 埋点 / a11y、单元测试。
  固化"单组件 4 步"：骨架 → 逻辑层与 UI 层分离 → 硬规则贯穿 → 单测 + Storybook（若启用）。
  本 skill **不依赖 plans/ 或 tasks.md**——靠前置条件 + 仓库实际 React app 状态判断。
when_to_use: 用户说"加页面 / 加组件 / 写 React 组件 / 加 AntD 表 / 加 Form / 写 Dashboard / 新增路由 / 加菜单项"，或要在 React app 的 `src/pages` / `src/components` / `src/features` 下新建 .tsx。
priority: high
allowed-tools: Read Grep Glob Bash Edit Write
---

# React 组件开发引导

tripod 的 React app 有硬架构约束：**严禁 class component**、**逻辑与 UI 库解耦**、**权限 / flag / 错误边界 / i18n / analytics / a11y 都要覆盖**。本 skill 固化新建一个组件 / 页面的完整姿势。

## 0. 前置条件检查

| 检查                                                                                            | 若不满足                                                                                       |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 存在目标 React app（`apps/admin-web` / `apps/platform` / `apps/portal` / `apps/mall-web` 之一） | **停下报告**：对应 app 尚未交付（阶段 3）                                                      |
| `apps/<app>/src/` 结构存在                                                                      | 不满足 → 停报                                                                                  |
| `@tripod-stack/shared-web-ui`（或等价层）可用                                                   | 不齐时给用户选项：(a) 等阶段 2 shared-web-ui 出 (b) 本组件不走 Gate/Flag/ErrorBoundary（降级） |

---

## 1. Phase 1：闸门（放哪 / 走不走本 skill）

| 信号                      | 目录                                                      | 走本 skill？                    |
| ------------------------- | --------------------------------------------------------- | ------------------------------- |
| 某个路由对应的完整页面    | `apps/<app>/src/pages/<Name>/index.tsx`                   | ✅                              |
| 跨页面复用的业务组件      | `apps/<app>/src/components/<Name>/index.tsx`              | ✅                              |
| 单个页面内部的子组件      | `apps/<app>/src/pages/<ParentPage>/components/<Name>.tsx` | ✅                              |
| 纯 UI 通用组件（无业务）  | 应该放 `@tripod-stack/shared-web-ui`                      | ❌ 走 shared-package-author     |
| 一个 React hook / context | `apps/<app>/src/hooks/` 或 shared-web-ui                  | ✅（hook 风格同样遵循本 skill） |
| 原生 DOM 操作 / 副作用    | 不应在组件里，改 hook 或 service                          | ❌ 重构                         |

---

## 2. Phase 2：组件骨架（逻辑 / UI 分离）

### 目录结构（单组件）

```
<Name>/
├── index.tsx              # barrel：re-export
├── <Name>.tsx             # UI 层（接 props，无数据源）
├── use<Name>.ts           # 逻辑 hook（数据请求 / 状态 / 副作用）
├── <Name>.types.ts        # props / 本地 types（可选，小组件直接写 .tsx 里）
├── <Name>.i18n.ts         # i18n key 定义（集中管理本组件的翻译 key）
├── <Name>.test.tsx        # 单测（RTL）
└── <Name>.stories.tsx     # Storybook（若项目启用，可选）
```

### UI 层（`<Name>.tsx`）

```tsx
import { type FC, memo } from 'react';
import { Gate } from '@tripod-stack/shared-web-ui';           // 权限
import { Flag } from '@tripod-stack/shared-web-ui';           // feature flag
import { useTranslation } from 'react-i18next';
import { TrackButton } from '@tripod-stack/shared-web-ui';    // analytics 埋点
import type { <Name>Props } from './<Name>.types';

export const <Name>: FC<<Name>Props> = memo(({ data, onAction }) => {
  const { t } = useTranslation('<name>');

  return (
    <section aria-labelledby="<name>-heading">
      <h2 id="<name>-heading">{t('title')}</h2>

      <Gate permission="<domain>:<name>:write">
        <TrackButton event="<name>.action" onClick={onAction}>
          {t('action')}
        </TrackButton>
      </Gate>

      <Flag name="<feature-flag-name>" fallback={null}>
        <Experimental<Name> data={data} />
      </Flag>

      {/* 主渲染 */}
    </section>
  );
});
<Name>.displayName = '<Name>';
```

**硬约束**：

- `FC<Props>` + `memo(...)` 包裹（避免父组件 re-render 时白刷新）
- `displayName` 设置（DevTools 调试）
- **严禁**：`class <Name> extends Component`（ESLint `react/prefer-stateless-function` + `no-restricted-syntax` 双保险会拦）
- 字符串用户可见的**必须**走 `t('key')`（i18n），不硬编码
- 可点击操作用 `TrackButton` 或手动 `useAnalytics()`，不裸 `<button onClick>`
- a11y：section / nav / article 用 landmark；heading 层级 h1-h6 连续；`aria-*` 该有就有
- 数据从 props 进，**不在 UI 层直接 fetch**（那是 hook 的事）

### 逻辑层（`use<Name>.ts`）

```ts
import { useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@tripod-stack/shared-web-ui';
import { useErrorHandler } from '@tripod-stack/shared-logger/client';

export function use<Name>(params: <Name>Params) {
  const { user } = useAuth();
  const handleError = useErrorHandler();

  const query = useQuery({
    queryKey: ['<name>', params],
    queryFn: () => api.<name>.list(params),
  });

  const mutation = useMutation({
    mutationFn: api.<name>.create,
    onError: handleError,
  });

  const onAction = useCallback(/* ... */, [/* deps */]);
  const derived = useMemo(/* ... */, [query.data]);

  return { data: query.data, loading: query.isLoading, onAction, derived };
}
```

**硬约束**：

- 所有网络 / 异步 / 缓存走 react-query（`useQuery` / `useMutation`），不裸 `useState + useEffect + fetch`
- 错误走 `useErrorHandler()` 上报到 ErrorReporter（adapter 注入）
- 副作用最小化：`useCallback` / `useMemo` 有依赖才加，别无脑包
- 时间 / 金额走 `dayjs` / `Decimal`（shared-utils 提供）

---

## 3. Phase 3：硬规则清单（贯穿 UI + 逻辑）

| 维度           | 必须                                                                  | 禁用                                                                       |
| -------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 组件形态       | 函数组件 + hook                                                       | ❌ class component                                                         |
| 比较           | `===` / `!==`                                                         | ❌ `==` / `!=`（含 `== null`）                                             |
| 日志           | `useErrorHandler()` / 错误 → `ErrorReporter`                          | ❌ `console.*`                                                             |
| 时间           | `dayjs`                                                               | ❌ `new Date()` 直用                                                       |
| 金额           | `Decimal`                                                             | ❌ `number`                                                                |
| 样式           | 项目主栈（AntD 或 shadcn 或 tailwind，**择一**按 app）                | ❌ 混栈（AntD + shadcn 同一页面）；❌ 内联 `style={{ ... }}` 超过 2 条属性 |
| 文本           | `t('...')`                                                            | ❌ 硬编码英文 / 中文可见文案                                               |
| 权限           | `<Gate permission="...">`（UI 层）+ route guard（路由层双层）         | ❌ 单层权限检查；❌ 无权限检查敏感操作                                     |
| Feature flag   | `<Flag name="...">`                                                   | ❌ `process.env.XXX_ENABLED` 这种硬编码                                    |
| Error boundary | 顶层 App 包 `<ErrorBoundary>`（shared-logger/client 提供）            | ❌ 组件内部 try-catch 吞错误                                               |
| Analytics      | `<TrackButton>` 或 `useAnalytics().track(event, props)`               | ❌ 裸 onClick 无埋点；❌ 埋点 event 名没命名空间                           |
| 数据请求       | react-query                                                           | ❌ `useState + useEffect + fetch` 手撸                                     |
| 表单           | react-hook-form + zod schema 校验                                     | ❌ 手工 useState 管 form                                                   |
| memoization    | `memo()` 包组件，有 children 时 `useMemo` + `useCallback`             | ❌ 无脑 memo 所有东西                                                      |
| a11y           | section/nav/article 用 landmark；label for / aria-label；heading 层级 | ❌ 全用 div；❌ 按钮无 aria-label / text                                   |
| props types    | 显式 `type <Name>Props`，不用 any                                     | ❌ `props: any`                                                            |
| key prop       | 列表渲染必须稳定 key                                                  | ❌ `key={index}`（除非数组永不重排）                                       |

---

## 4. Phase 4：测试硬门槛

### 最低要求

| 层                             | 最低覆盖                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| UI（RTL）                      | 渲染 happy + 权限拒绝场景（`<Gate>` 拦截显示降级 UI） + 主要交互（按钮点击触发回调） |
| hook（@testing-library/react） | 每个返回值 ≥ 1 happy + 1 error                                                       |
| 视觉（Storybook，若启用）      | default / loading / error / empty 4 状态                                             |

### 测试风格

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { <Name> } from './<Name>';

describe('<Name>', () => {
  it('happy: 渲染标题 + action 按钮', () => {
    render(<<Name> data={fakeData} onAction={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /action/i })).toBeInTheDocument();
  });

  it('error: 无权限时 Gate 隐藏 action', () => {
    render(
      <MockAuthProvider user={{ permissions: [] }}>
        <<Name> data={fakeData} onAction={vi.fn()} />
      </MockAuthProvider>,
    );
    expect(screen.queryByRole('button', { name: /action/i })).not.toBeInTheDocument();
  });

  it('interaction: 点击 action 触发 onAction', () => {
    const onAction = vi.fn();
    render(<<Name> data={fakeData} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /action/i }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
```

**禁用**：`it.skip` / 用 `container.querySelector('.some-class')`（走 role / label 查询，不耦合 DOM 结构）

---

## 5. AI 铁律

| 场景           | 必须做                                       | 必须不做                                                     |
| -------------- | -------------------------------------------- | ------------------------------------------------------------ |
| 前置条件       | 目标 app 已建                                | ❌ app 未建也硬加组件                                        |
| 闸门           | 放对目录                                     | ❌ 业务组件放 shared-web-ui（污染公共层）                    |
| 组件形态       | 函数 + hook                                  | ❌ class（ESLint 会拦，别和 linter 斗）                      |
| 逻辑 / UI 分离 | `use<Name>.ts` + `<Name>.tsx` 双文件         | ❌ 把 fetch 写进 UI 层；❌ UI 层直接摸 state 管理库          |
| 国际化         | 所有用户可见文案 `t('key')`                  | ❌ 硬编码字符串                                              |
| 权限           | `<Gate>` + route guard 双层                  | ❌ 前端无权限检查"反正后端会拦"                              |
| Feature flag   | `<Flag>`                                     | ❌ `process.env` / 硬编码 if                                 |
| Analytics      | 所有可点击业务操作埋点                       | ❌ 裸 `<button onClick>`                                     |
| 测试           | UI + hook + 权限降级都要                     | ❌ 只测 happy path                                           |
| 样式栈         | 按 app 规定（AntD / shadcn / tailwind 择一） | ❌ 跨栈混用；❌ 内联 style 堆                                |
| 失败           | 停下报告                                     | ❌ 用 `@ts-ignore` / `eslint-disable` 糊过 hook deps warning |

---

## 6. 参考

| 用途                                               | 位置                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| 已建组件样本                                       | `apps/<app>/src/pages/<任一>/`                                        |
| `<Gate>` / `<Flag>` / `<ErrorBoundary>` 实现       | `@tripod-stack/shared-web-ui` 或 `@tripod-stack/shared-logger/client` |
| `useAuth` / `useAnalytics` / `useFeatureFlag` hook | `@tripod-stack/shared-web-ui`                                         |
| react-query 封装                                   | `apps/<app>/src/api/`                                                 |
| i18n key 约定                                      | `@tripod-stack/shared-i18n`（阶段 2 交付后）                          |
| 测试 util（RTL + provider 包装）                   | `apps/<app>/src/test-utils/`（阶段 3 约定后）                         |

**触发本 skill 后先 Read** 已建组件样本，不凭记忆写模板。若仓库里还没样本（首批组件）→ 展示骨架给用户审查后再写入。

---

## 7. 结束报告模板

```
✅ 组件 <Name> 交付
位置：apps/<app>/src/<pages|components>/<Name>/
文件：index.tsx / <Name>.tsx / use<Name>.ts / <Name>.test.tsx（+ types/i18n/stories 按需）
覆盖：UI 渲染 ✓ / 权限降级 ✓ / 交互 ✓
i18n key：N 个
埋点 event：N 个
建议下一步：<route 注册 / 菜单项更新 / commit（走 commit-and-release）>
```
