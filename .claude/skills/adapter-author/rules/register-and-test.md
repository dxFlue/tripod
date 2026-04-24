# Phase 4：测试 + 注册 + doctor

Provider 实现完成后按本文件走 3 步收尾。

---

## Step A. 写单元测试（vitest + mock 外部 SDK）

### 测试文件位置

```
adapters/<slot>-<provider>/__tests__/<provider>.provider.test.ts
```

### 测试模板

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { <ProviderClass> } from '../src/<provider>.provider';
import { TripodError, ErrorCode } from '@tripod-stack/shared-contract';

describe('<ProviderClass>', () => {
  let mockClient: any;
  let provider: <ProviderClass>;

  beforeEach(() => {
    // 每个测试前重置 mock client
    mockClient = {
      // mock 外部 SDK 的方法（按 provider 需要）
      <sdkMethod>: vi.fn(),
    };
    provider = new <ProviderClass>(
      { /* config */ },
      mockClient,
    );
  });

  describe('<method>', () => {
    it('正常路径：<描述>', async () => {
      mockClient.<sdkMethod>.mockResolvedValue({ /* 模拟返回 */ });

      const result = await provider.<method>({ /* input */ });

      expect(mockClient.<sdkMethod>).toHaveBeenCalledWith(/* 期望入参 */);
      expect(result).toEqual({ /* 期望输出 */ });
    });

    it('错误路径：<错误场景> → 映射到 ErrorCode.<CODE>', async () => {
      mockClient.<sdkMethod>.mockRejectedValue(new Error('外部错误'));

      await expect(provider.<method>({ /* input */ })).rejects.toThrow(TripodError);
      await expect(provider.<method>({ /* input */ })).rejects.toMatchObject({
        code: ErrorCode.<CODE>,
      });
    });

    it('边界：<边界条件>', async () => {
      // ...
    });
  });
});
```

### 覆盖要求

| 覆盖维度   | 要求                                                         |
| ---------- | ------------------------------------------------------------ |
| 方法覆盖率 | 接口每个方法至少 1 个正常路径 + 1 个错误路径                 |
| 错误码映射 | 每个 `throw TripodError` 都要被测到                          |
| 边界       | rate-limit / quota / timeout / 空入参 / 过长入参 各至少 1 个 |
| 幂等性     | 涉及幂等的方法（如 payment create）要测"重复调用返回同结果"  |

### 铁律

| 场景            | ✅ 做                                          | ❌ 不做                                      |
| --------------- | ---------------------------------------------- | -------------------------------------------- |
| 外部 HTTP       | 通过 `vi.fn()` mock 注入的 client              | ❌ 跑真实 HTTP（会慢 / 不稳 / 泄漏 key）     |
| 外部 SDK 初始化 | mock 整个 SDK 或通过 DI 传 mock 实例           | ❌ `vi.mock('stripe')` 污染全局              |
| env             | 在 `beforeEach` 里传测试用 config 对象         | ❌ 改 `process.env` 污染其他测试             |
| 时钟依赖        | `vi.useFakeTimers()` + `vi.setSystemTime(...)` | ❌ `new Date()` 直接用，测试会随时间漂移     |
| 断言            | 用 `toMatchObject` / `toEqual` 具体字段        | ❌ `toBeTruthy()` / `toBeDefined()` 无信息量 |

### 跑测试

```bash
pnpm --filter @tripod-stack/adapter-<slot>-<provider> test
```

要求：**全绿才能进入 Step B**。

---

## Step B. 注册 adapter（`tripod add-adapter` CLI）

```bash
pnpm tripod add-adapter <slot>=<provider-name>
```

**CLI 自动做的事**（AI 不要手工做）：

| 自动修改     | 文件                                           | 如何改                                                                                        |
| ------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 启用 adapter | `tripod.config.yaml`                           | 在对应 slot 数组 push `<provider-name>`                                                       |
| 追加 env     | `packages/shared-config/env.schema.ts`         | 在 `tripod:env-fields` Magic Comment 之间插入 zod 定义（从 `tripod.adapter.yaml.envVars` 读） |
| auth 专用    | `packages/shared-auth/src/strategies/index.ts` | 仅 `slot=auth.credential.*` 时，在 `tripod:credential-providers` 标记插入 provider 注册       |
| 安装依赖     | `package.json`                                 | 把 `@tripod-stack/adapter-<slot>-<provider>` 加到需要的 app（通常是 `apps/server`）           |

### 走完 add-adapter 后用户要做的

1. 填 `.env`（按 `tripod.adapter.yaml.envVars` 声明的 key）
2. 如果 `tripod.adapter.yaml` 有 `dockerDeps`：提示用户手动加到 `infra/compose/docker-compose.yml`（AI **不要**直接改 compose；plan 约定是"给片段让用户自己合并"）

### AI 铁律

| ❌ 禁                                              | ✅ 正确                                   |
| -------------------------------------------------- | ----------------------------------------- |
| 手改 `tripod.config.yaml` 的 providers 数组        | 走 `tripod add-adapter`                   |
| 手改 `env.schema.ts` 的 `tripod:env-fields` 外位置 | 声明进 `tripod.adapter.yaml.envVars`      |
| 手改 `strategies/index.ts`                         | 走 `tripod add-adapter auth.credential=*` |
| `docker-compose.yml` 直接 write                    | 把 `dockerDeps` 片段贴给用户让他合并      |

---

## Step C. 跑 `tripod doctor` 验证

```bash
pnpm tripod doctor
```

期望输出：

```
✅ adapter-<slot>-<provider>/tripod.adapter.yaml 合法（slot / provides / envVars 字段齐全）
✅ provides: <X>Provider 在 18 接口白名单
✅ .env 所有 required envVars 已填
✅ tripod.config.yaml 对应 slot 已启用 <provider-name>
✅ packages/shared-config/env.schema.ts 同步更新
✅ （auth adapter）shared-auth/strategies/index.ts 已注册
✅ 单元测试全绿
```

**任一 FAIL → 回到对应 Step 修复，不要强行进入下一步**。

### 常见 FAIL

| doctor 报错                         | 原因                     | 修复                                             |
| ----------------------------------- | ------------------------ | ------------------------------------------------ |
| `.env 缺 <ENV_NAME>`                | 用户没填 env             | 让用户填 `.env` 对应 key                         |
| `provides: XxxProvider 不在白名单`  | 写错接口名               | 改 `tripod.adapter.yaml.provides` 为 18 接口之一 |
| `strategies/index.ts 未注册 <name>` | add-adapter 跑失败或跳过 | 重跑 `tripod add-adapter auth.credential=<name>` |
| `单元测试失败`                      | 回去 Step A              | 根据 vitest 输出修测试 / 修实现                  |

---

## 全部通过后

告诉用户：

```
Adapter 交付完成：adapters/<slot>-<provider>/

后续业务侧要做的：
1. 填 .env（参见 tripod.adapter.yaml.envVars）
2. （如有 dockerDeps）手动合并到 infra/compose/docker-compose.yml
3. pnpm dev 验证端到端
4. （可选）按 README.md 的"测试"段跑集成测试
```

本 skill 任务完成，不再做：

- ❌ **不自动**跑 API E2E / UI E2E（adapter 没有面向用户的接口；E2E 由业务场景触发）
- ❌ **不自动**写 Playwright 测试
- ❌ **不自动**部署 / `tripod release`
