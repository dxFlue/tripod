# @tripod-stack/eslint-config

Tripod ESLint 共享 preset。

| 文件              | 适用                       | 扩展                                                                                                |
| ----------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| `base.js`         | 所有 TS 包通用             | `eslint:recommended` + `@typescript-eslint/strict-type-checked` + `import/recommended` + `prettier` |
| `react.js`        | Vite SPA / AntD            | base + react + react-hooks + jsx-a11y                                                               |
| `next.js`         | Next.js 15 门户 / mall-web | react + `next/core-web-vitals`                                                                      |
| `nest.js`         | NestJS server              | base + Nest 约束（decorator + parameter-property）                                                  |
| `react-native.js` | Expo mobile                | react + react-native + tailwindcss (NativeWind)                                                     |

## 用法

项目 `.eslintrc.cjs`：

```js
module.exports = {
  extends: ['@tripod-stack/eslint-config/nest'], // 按场景选
};
```

## 自定义规则

6 条 `tripod/*` 规则来自 peer dep `eslint-plugin-tripod`（unscoped）：

| 规则                                  | base    | react   | nest      | react-native |
| ------------------------------------- | ------- | ------- | --------- | ------------ |
| `tripod/no-direct-prisma-client`      | error   | error   | error     | error        |
| `tripod/no-default-export`            | error   | error   | error     | error        |
| `tripod/no-barrel-import`             | error   | error   | error     | error        |
| `tripod/error-code-required`          | error   | error   | error     | error        |
| `tripod/require-permission-decorator` | **off** | **off** | **error** | **off**      |
| `tripod/require-idempotent-decorator` | **off** | **off** | **error** | **off**      |

`require-permission-decorator` 和 `require-idempotent-decorator` 只在 `nest.js` 开启；其他 preset off（M2 默认无 payment/shipping 业务，M3 业务出现时在 `apps/server/.eslintrc` 显式打开）。
