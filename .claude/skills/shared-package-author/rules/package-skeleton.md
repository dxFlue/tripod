# Phase 2：包骨架模板

**核心原则**：逐字复用仓库里已存在的 shared-\* 样本包，只替换占位符 `<NAME>` / `<DESC>`。**不凭记忆写模板**——先 `ls packages/` + Read 一个样本的 5 件套，再套用。

---

## Step 1：决定入口形态（单 vs 多）

```
Q：这个包要不要同时给 server 和 client 用？
├── 否（纯 Node、纯 Browser、纯 RN 之一）→ 单入口，参考 shared-types
└── 是 → 再问：
    Q2：server 和 client 的依赖异构（如 Pino vs React）吗？
    ├── 是 → 多入口 subpath（./server ./client ./shared），参考 shared-logger
    └── 否 → 单入口够了
```

**硬约束**：subpath 名字只能是 `./server` / `./client` / `./shared` 三选，不造新名字（禁 `./native` / `./rn` / `./node`）。

---

## Step 2：单入口 5 件套模板

### package.json

```json
{
  "name": "@tripod-stack/shared-<NAME>",
  "version": "0.0.0",
  "description": "<一句话职责，中文>",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup",
    "clean": "rm -rf dist .turbo",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --max-warnings=0"
  },
  "dependencies": {
    "@tripod-stack/shared-<依赖包>": "workspace:*"
  },
  "devDependencies": {
    "@tripod-stack/eslint-config": "workspace:*",
    "@tripod-stack/tsconfig": "workspace:*",
    "eslint": "^8.57.0",
    "eslint-plugin-tripod": "workspace:*",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

**规则**：

- 无内部依赖时删掉整个 `dependencies` 字段
- 第三方依赖（dayjs / decimal.js / zod / pino 等）加在 `dependencies`（不是 devDependencies）
- `files` 字段**只有** `["dist", "README.md"]`，不加 src

### tsup.config.ts

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: 'es2022',
  outDir: 'dist',
});
```

若依赖是 peer（React 等），加 `external: ['react']`。

### vitest.config.ts（统一模板，禁改）

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
```

含 tsx 时 `include` 改 `'src/**/*.test.{ts,tsx}'`。

### tsconfig.json

```json
{
  "extends": "@tripod-stack/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

含 React 时 `types` 加 `"react"`；纯 Browser 时去 `"node"`。

### src/ 目录骨架

```
src/
├── index.ts              # barrel：export * from './<main>'
├── <main>.ts             # 主实现
└── <main>.test.ts        # 必建（见 Phase 4 硬门槛）
```

---

## Step 3：多入口 subpath 5 件套模板

参考 `packages/shared-logger/`。

### package.json（exports 三块）

```json
{
  "name": "@tripod-stack/shared-<NAME>",
  "version": "0.0.0",
  "description": "<一句话职责>",
  "license": "MIT",
  "type": "module",
  "exports": {
    "./server": {
      "import": {
        "types": "./dist/server/index.d.ts",
        "default": "./dist/server/index.js"
      },
      "require": {
        "types": "./dist/server/index.d.cts",
        "default": "./dist/server/index.cjs"
      }
    },
    "./client": {
      "import": {
        "types": "./dist/client/index.d.ts",
        "default": "./dist/client/index.js"
      },
      "require": {
        "types": "./dist/client/index.d.cts",
        "default": "./dist/client/index.cjs"
      }
    },
    "./shared": {
      "import": {
        "types": "./dist/shared/index.d.ts",
        "default": "./dist/shared/index.js"
      },
      "require": {
        "types": "./dist/shared/index.d.cts",
        "default": "./dist/shared/index.cjs"
      }
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    /* 和单入口同 */
  },
  "dependencies": {
    "@tripod-stack/shared-contract": "workspace:*",
    "@tripod-stack/shared-types": "workspace:*"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true }
  },
  "devDependencies": {
    /* 和单入口同，React 包加 @types/react + react */
  },
  "publishConfig": { "access": "public" }
}
```

**规则**：

- 只有 client 真的用 React 时才加 `peerDependencies.react` + `peerDependenciesMeta.react.optional = true`
- server-only 的 Node-native 依赖（pino / fs 等）放 `dependencies`，不要放 peer

### tsup.config.ts（多 entry）

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'server/index': 'src/server/index.ts',
    'client/index': 'src/client/index.tsx', // 含 JSX 时 .tsx
    'shared/index': 'src/shared/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: 'es2022',
  outDir: 'dist',
  external: ['react', 'react-dom'], // peer 依赖必须声明 external
});
```

**规则**：peer dep 必须加到 `external`，否则会被 bundle 进产物。

### src/ 目录骨架

```
src/
├── server/
│   ├── index.ts
│   ├── <feature>.server.ts
│   └── <feature>.server.test.ts
├── client/
│   ├── index.tsx              # 或 index.ts
│   ├── <feature>.client.tsx
│   └── <feature>.client.test.tsx
└── shared/
    ├── index.ts
    ├── <feature>.shared.ts
    └── <feature>.shared.test.ts
```

**规则**：

- `src/client/` 可以 import `src/shared/`，**不能** import `src/server/`
- `src/server/` 可以 import `src/shared/`，**不能** import `src/client/`
- `src/shared/` 不能 import `server/` 或 `client/`，必须零环境依赖

---

## Step 4：测试文件骨架（必建，不可省）

```ts
// src/<main>.test.ts
import { describe, it, expect } from 'vitest';
import { publicFn } from './<main>';

describe('<main>', () => {
  it('happy: 正常输入返回正常结果', () => {
    expect(publicFn(normalInput)).toEqual(expectedOutput);
  });

  it('edge: 空值 / 零 / 最大值边界', () => {
    expect(publicFn('')).toEqual(/* ... */);
  });
});
```

**最低要求**：每个 **public export** ≥ 1 happy + 1 edge。详细方法论参考 `spec-driven-testing` skill。

---

## 生成骨架时的操作顺序

```
1. Read packages/shared-types/package.json（单入口）或 packages/shared-logger/package.json（多入口）
2. Read 对应的 tsup.config.ts / vitest.config.ts / tsconfig.json
3. 替换占位符 <NAME> / <DESC> / <main>
4. 决定 dependencies / peerDependencies 具体内容
5. 写入 packages/shared-<name>/ 的 5 件套
6. 创建 src/index.ts + src/<main>.ts + src/<main>.test.ts 3 个最小文件
7. 展示给用户审查后进 Phase 3
```

---

## 常见坑

| 坑                                        | 症状                                | 解法                                                          |
| ----------------------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| 漏写 `files` 字段                         | npm publish 带进整个 src + 配置文件 | 必须 `["dist", "README.md"]`                                  |
| `exports` 忘写 `require.types` → `.d.cts` | CJS 消费方拿不到类型                | 单入口必须 `.d.ts` + `.d.cts` 两版；多入口每个 subpath 都要   |
| peer 依赖没加 `external`                  | 产物体积暴涨；用户装 react 两次     | tsup 里 `external: ['react']`                                 |
| `types: ['node']` 忘加                    | 用 `process.env` / `Buffer` 报错    | tsconfig.json `compilerOptions.types: ['node']`               |
| tsup 多 entry 用数组而非对象              | 产物平铺到 dist 根目录不分子目录    | 多 entry 必须用对象 `{ 'server/index': '...' }`               |
| vitest 开了 `globals: true`               | ESLint `no-undef` 报错              | 必须 `globals: false`，显式 import 从 'vitest'                |
| `include` 漏 `test/**/*.test.ts`          | test 目录下的测试不跑               | 两路径 include 都要：`src/**/*.test.ts` + `test/**/*.test.ts` |
