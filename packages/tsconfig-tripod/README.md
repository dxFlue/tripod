# @tripod-stack/tsconfig

Tripod TypeScript 基础配置。每种场景继承对应 base。

| 文件         | 场景                   | 关键项                                                               |
| ------------ | ---------------------- | -------------------------------------------------------------------- |
| `base.json`  | 所有包通用底           | `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` |
| `react.json` | Vite / SPA（AntD web） | DOM lib + `react-jsx`                                                |
| `next.json`  | Next.js 15             | `jsx: preserve` + `noEmit` + next plugin                             |
| `nest.json`  | NestJS server          | CommonJS + 装饰器 metadata                                           |
| `rn.json`    | React Native（Expo）   | `react-jsx` + `node` types                                           |

## 用法

```jsonc
// 业务包 tsconfig.json
{
  "extends": "@tripod-stack/tsconfig/react.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src"],
}
```

## 为什么 `verbatimModuleSyntax: true`

`import type` 写对即可消除 "import was not used" 误报（TS 5.0+），配合 `@typescript-eslint/consistent-type-imports` 强制。
Nest 场景因为装饰器 metadata 依赖运行时 import，`nest.json` 覆写回 `false`。
