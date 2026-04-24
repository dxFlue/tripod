# Phase 2：包骨架生成

Phase 1 通过后，按本文件模板生成 adapter 包。**展示内容给用户审查 → 确认 → 写入**。

---

## 目录结构

```
adapters/<slot>-<provider>/
├── package.json
├── tripod.adapter.yaml
├── src/
│   ├── index.ts
│   └── <provider>.provider.ts
├── __tests__/
│   └── <provider>.provider.test.ts
└── README.md
```

**命名**：

- `<slot>` = 接口简称（auth / storage / notification / payment / push / shipping / search / i18n / audit / error / analytics / flag / cache / mfa / session / recovery / realtime / deeplink / secrets）
- `<provider>` = 供应商名（kebab-case，全小写）
- 例：`adapters/auth-oauth-google/` / `adapters/storage-s3/` / `adapters/payment-stripe/` / `adapters/notification-sms-twilio/`

---

## package.json 模板

```json
{
  "name": "@tripod-stack/adapter-<slot>-<provider>",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@tripod-stack/shared-<能力>": "workspace:*",
    "@tripod-stack/shared-contract": "workspace:*",
    "@tripod-stack/shared-config": "workspace:*"
  },
  "devDependencies": {
    "@tripod-stack/tsconfig-tripod": "workspace:*",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

**铁律**：

- `dependencies` **只允许** `@tripod-stack/shared-*` + 该 provider 的第三方 SDK（如 `stripe` / `@aws-sdk/client-s3`）
- ❌ 不得依赖 `@tripod-stack/apps-*` / 任何业务代码（违反分层）
- 版本号一律 `workspace:*`（pnpm publish 自动替换，见 plan §模板 package.json）

---

## tripod.adapter.yaml 模板

```yaml
# adapter 元数据（tripod add-adapter / skill:audit / tripod doctor 读取）
name: <slot>-<provider> # 例：storage-s3
slot: <slot-key> # 例：storage.backend（映射到 tripod.config.yaml）
providerClass: <ClassName> # 例：S3StorageProvider（src/index.ts 导出的类名）
provides: <X>Provider # 18 个接口之一（audit 校验在白名单内）
version: 0.1.0

# 声明所需 env，add-adapter 自动加到 env.schema.ts 的 tripod:env-fields 标记
envVars:
  - name: <ENV_NAME>
    required: true # true | false
    sensitive: false # true 标记为敏感（gitleaks 扫描 + .env 示例里用占位）
    default: '' # 可选默认值

# 可选：docker-compose 依赖片段（如 minio / elasticsearch）
# tripod doctor 会提示用户补到 infra/compose/docker-compose.yml
dockerDeps: []
```

**audit 校验规则**（skill:audit 会检查）：

- `provides` 必须在 18 个接口白名单内（见 `interface-guide.md`）
- `slot` 必须能映射到 `tripod.config.yaml` 的有效 slot path
- `providerClass` 必须匹配 `src/index.ts` 导出的类名

---

## src/index.ts 模板

```ts
export { <ProviderClass> } from './<provider>.provider';
// 不要 export 内部 helper / 类型，除非外部真需要
```

**铁律**：`index.ts` **只做 re-export**，不写业务逻辑。

---

## src/\<provider\>.provider.ts 模板

```ts
import type { <X>Provider } from '@tripod-stack/shared-<能力>';
// 根据接口类型可能还要 import 错误类型：
// import { TripodError, ErrorCode } from '@tripod-stack/shared-contract';

/**
 * <Provider 一句话定位>
 *
 * slot: <slot-key>
 * envVars: <env list>
 * 接入指引：tripod add-adapter <slot>=<provider>
 */
export class <ProviderClass> implements <X>Provider {
  constructor(
    private readonly config: {
      // 从 shared-config 注入的类型化 env
      <envName>: string;
      // ...
    },
    // 外部 SDK / client 通过构造函数注入（便于 mock）
    private readonly client: <SDKType> = new <SDK>({ ... }),
  ) {}

  // 实现接口每个方法
  async <method>(input: <Input>): Promise<<Output>> {
    // 1. 入参校验
    // 2. 调外部 SDK
    // 3. 错误映射到 shared-contract 错误码
    //    throw new TripodError(ErrorCode.XXX, '消息', { cause: err })
    // 4. 返回接口约定的结构
  }
}
```

**JSDoc 铁律**（按 `feedback_ai_friendly_docs.md`）：

- 每方法有签名注释（输入 / 输出 / 错误码 / 幂等性）
- 一个正面例子
- 一个反模式（常见错用法）

---

## **tests**/\<provider\>.provider.test.ts 模板

详见 Phase 4 `register-and-test.md`。Phase 2 先创建空文件占位。

---

## README.md 模板（AI 友好结构化）

```markdown
# `@tripod-stack/adapter-<slot>-<provider>`

<一句话定位：这个 adapter 做什么 / 替代哪个 M2 默认 / 何时用>

## 接口

| 实现          | 路径                                        |
| ------------- | ------------------------------------------- |
| `<X>Provider` | `packages/shared-<能力>/src/<X>Provider.ts` |

## 安装

\`\`\`bash
pnpm tripod add-adapter <slot>=<provider>
\`\`\`

## env

| 变量         | 必需 | 说明                |
| ------------ | ---- | ------------------- |
| `<ENV_NAME>` | ✅   | <用途 + 从哪里获取> |

## 方法签名

\`\`\`ts
class <ProviderClass> implements <X>Provider {
<method>(input: <Input>): Promise<<Output>>
}
\`\`\`

## 例子

\`\`\`ts
// 正面例子（直接可跑）
\`\`\`

## 反模式

\`\`\`ts
// ❌ 错误用法 + 为什么错
\`\`\`

## 错误码

| code  | 触发条件 | 建议处理 |
| ----- | -------- | -------- |
| `XXX` | ...      | ...      |

## 测试

\`\`\`bash
pnpm --filter @tripod-stack/adapter-<slot>-<provider> test
\`\`\`
```

**铁律**：README 全走表格 + 代码块，**不写散文段落**（plan feedback：AI 友好文档必须结构化）。

---

## 展示给用户审查的格式

骨架生成时，先把以下内容**列出来给用户看**，确认后才写文件：

```
即将创建：adapters/<slot>-<provider>/

文件清单：
  - package.json      (依赖 shared-<能力> + <SDK>@^<version>)
  - tripod.adapter.yaml
    slot: <slot-key>
    provides: <X>Provider
    envVars: [<ENV_1>, <ENV_2>, ...]
  - src/index.ts
  - src/<provider>.provider.ts     (Provider 实现骨架)
  - __tests__/<provider>.provider.test.ts   (空文件，Phase 4 填)
  - README.md         (AI 友好结构化模板)

确认创建？[y/n]
```

用户确认 → 写入 → 进入 **Phase 3：rules/interface-guide.md**。
