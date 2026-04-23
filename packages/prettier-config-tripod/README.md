# @tripod-stack/prettier-config

Tripod Prettier 共享配置。

## 用法

项目 `package.json`：

```json
{
  "prettier": "@tripod-stack/prettier-config"
}
```

## 配置值

| 项              | 值                                | 理由                                                  |
| --------------- | --------------------------------- | ----------------------------------------------------- |
| `printWidth`    | 100                               | 大于默认 80，配合 G-TS 规范（plan-full §ESLint 配置） |
| `singleQuote`   | true                              | TS/JS 代码统一单引号                                  |
| `trailingComma` | `'all'`                           | 函数参数也带尾逗号（diff 更干净）                     |
| `semi`          | true                              | 显式分号（避免 ASI 歧义）                             |
| `arrowParens`   | `'always'`                        | `(x) =>` 比 `x =>` 更易读                             |
| `endOfLine`     | `'lf'`                            | 跨平台一致（Windows 走 `core.autocrlf=input`）        |
| `plugins`       | `['prettier-plugin-tailwindcss']` | 自动排序 Tailwind class                               |
