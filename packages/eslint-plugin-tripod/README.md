# eslint-plugin-tripod

Tripod 自定义 ESLint 规则。配合 `@tripod-stack/eslint-config` 使用。

## 规则列表

| 规则                                  | 类型    | 默认在 preset           | 说明                                                                                         |
| ------------------------------------- | ------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| `tripod/no-direct-prisma-client`      | problem | 所有 preset             | 禁 `new PrismaClient()` 和从 `@prisma/client` 导入 `PrismaClient`；`shared-prisma/` 内部除外 |
| `tripod/no-default-export`            | problem | 所有 preset             | 禁 default export；Next 特殊文件（`app/**/page.tsx` 等）preset override 关闭                 |
| `tripod/no-barrel-import`             | problem | 所有 preset             | 禁从目录隐式 index 导入；强制具体文件路径                                                    |
| `tripod/error-code-required`          | problem | 所有 preset             | `new BusinessException(...)` 第一参数必须是标识符，禁字面量/模板字符串                       |
| `tripod/require-permission-decorator` | problem | **仅 nest**             | `@Controller()` 里 `@Post/@Put/@Patch/@Delete` 方法必须带 `@RequirePermission` 或 `@Public`  |
| `tripod/require-idempotent-decorator` | problem | **仅 nest**（路径触发） | `payment/shipping/notification` 路径下的写操作必须带 `@Idempotent()`                         |

## 安装（workspace 内）

```jsonc
// 业务包 package.json
{
  "devDependencies": {
    "@tripod-stack/eslint-config": "workspace:*",
    "eslint-plugin-tripod": "workspace:*",
    "eslint": "^8.57.0",
  },
}
```

`.eslintrc.cjs` 里通过 preset 自动引用，不需手动写 `plugins: ['tripod']`。

## 规则选项

### `tripod/no-barrel-import`

```js
['error', { allowPatterns: ['^@tripod-stack/'] }]; // 正则白名单（默认空）
```

### `tripod/error-code-required`

```js
['error', { exceptionNames: ['BusinessException', 'TenantException'] }]; // 默认 ['BusinessException']
```

### `tripod/require-permission-decorator`

```js
[
  'error',
  {
    writeMethods: ['Post', 'Put', 'Patch', 'Delete'],
    allowedDecorators: ['RequirePermission', 'Public', 'Internal'],
  },
];
```

### `tripod/require-idempotent-decorator`

```js
[
  'error',
  {
    filePatterns: ['apps/server/src/payment/', 'packages/shared-payment/'],
  },
];
```
