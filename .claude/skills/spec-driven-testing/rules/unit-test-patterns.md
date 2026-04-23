# 单元测试模式（Jest / Vitest / pytest）

本文件定义 Phase 4.1 生成单元测试时的规则和模板。目标是把"纯函数/内部逻辑/边界判断"这类无需起服务、无需网络、无需浏览器的用例放到最便宜的层级。

本文件覆盖三种最常见的 runner：**Jest**（TS/JS）、**Vitest**（TS/JS，现代替代）、**pytest**（Python）。具体用哪一个跟随项目已有配置——不是这个 skill 来选。

---

## 0. 识别项目 runner

Phase 4.1 开始前先识别项目使用的 runner：

| 识别依据                                                            | 判断                                 |
| ------------------------------------------------------------------- | ------------------------------------ |
| `package.json` devDeps 含 `jest` / `ts-jest`                        | Jest                                 |
| `package.json` devDeps 含 `vitest`                                  | Vitest                               |
| 根目录或 `vitest.config.{ts,js}` 存在                               | Vitest                               |
| `pyproject.toml` 包含 `[tool.pytest.ini_options]` 或依赖含 `pytest` | pytest                               |
| 源代码紧邻处已有 `*.spec.ts` / `*.test.ts` / `*_test.py`            | 沿用既有 runner                      |
| 以上都没有                                                          | 询问用户，或按"首次初始化"给默认推荐 |

同一仓库可能多个端用不同 runner（如前端 Vitest + 后端 pytest）。按 TC 涉及的源代码文件所在端分别处理。

---

## 1. 目标端定位

拿到一个 `Tier=Unit` 的 TC 后，先判断它属于哪个端（根据 `SKILL.md §0` 识别的后端/前端目录约定）：

- 后端纯函数 / service 内部逻辑 → 跟后端 runner
- 前端工具函数 / 自定义 hook 的非 UI 部分 / 纯业务逻辑 → 跟前端 runner
- 跨端共享的工具代码（若有 shared 包 / 模块） → 优先放共享位置测试，避免重复

---

## 2. 首次初始化

每次进入 Phase 4.1 前，对目标端做以下检查：

```
1. 读目标端的 package.json / pyproject.toml
2. 检查 runner 依赖是否安装（Jest / Vitest / pytest）
3. 检查配置文件是否存在（jest.config.* / vitest.config.* / pyproject.toml [tool.pytest]）
4. 检查是否有 test / test:run 之类的 script 入口
```

**未配置** → 按下面"默认初始化模板"自动补齐，告知用户："检测到 `{目标端}` 未配置 {runner}，我将添加以下文件/配置，然后再写测试。"

**已配置** → 直接进入"测试文件布局"阶段。

### Jest 初始化模板（TS 项目）

`package.json` devDeps 追加：

```json
{
  "jest": "^29.7.0",
  "ts-jest": "^29.1.5",
  "@types/jest": "^29.5.12"
}
```

`scripts` 追加：

```json
{
  "test": "jest",
  "test:watch": "jest --watch"
}
```

`jest.config.cjs`（Node 环境，按需改 `jsdom` 等）：

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: './src',
  testRegex: '.*\\.(spec|test)\\.ts$',
};
```

React 组件测试追加 `@testing-library/react`、`@testing-library/jest-dom`，`testEnvironment: 'jsdom'`。

### Vitest 初始化模板

`package.json` devDeps 追加：

```json
{
  "vitest": "^1.0.0"
}
```

`scripts` 追加：

```json
{
  "test": "vitest",
  "test:run": "vitest run"
}
```

`vitest.config.ts`：

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // 或 'jsdom' 测 React 组件
    globals: true, // 让 describe/it/expect 成为全局
    include: ['src/**/*.{spec,test}.{ts,tsx}'],
  },
});
```

### pytest 初始化模板（Python 项目）

`pyproject.toml` 的 `[project.optional-dependencies].dev` 追加：

```toml
[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

在 `tests/` 下创建 `conftest.py` 放 fixture。如果项目是 async（FastAPI / aiohttp 等），`asyncio_mode = "auto"` 让 `async def test_*` 自动可运行。

---

## 3. 测试文件布局

### JS/TS 项目

**推荐：紧邻源文件**，文件名 `.spec.ts` 或 `.test.ts`：

```
src/services/order-service.ts
src/services/order-service.spec.ts   ← 紧邻

src/utils/calculate-total.ts
src/utils/calculate-total.spec.ts    ← 紧邻
```

紧邻放便于阅读和跳转。若项目已有 `__tests__/` 或 `tests/` 的集中式约定，跟随项目。

### Python 项目

**常见：独立 `tests/` 目录**，文件名 `test_*.py`，镜像源码结构：

```
app/services/order_service.py
tests/services/test_order_service.py

app/utils/calculate_total.py
tests/utils/test_calculate_total.py
```

---

## 4. 测试文件结构

### TS 通用模式（Jest 和 Vitest 语法几乎一致）

```typescript
// Jest 用全局 describe/it/expect；Vitest 可选全局或显式导入
import { describe, it, expect, vi, beforeEach } from 'vitest'; // Vitest
// import { describe, it, expect, jest as vi } from '@jest/globals'; // Jest 显式导入（可选）

import { calculateBusinessDays } from './calculate-business-days';

describe('calculateBusinessDays', () => {
  describe('TC-[PREFIX]-03: BR-001 排除周末', () => {
    it('周一到周五 = 5 个工作日', () => {
      expect(calculateBusinessDays('2026-04-13', '2026-04-17')).toBe(5);
    });

    it('跨周末 = 排除周六日', () => {
      expect(calculateBusinessDays('2026-04-17', '2026-04-20')).toBe(2);
    });
  });

  describe('TC-[PREFIX]-04: EC-002 起止日期倒置', () => {
    it('startDate > endDate 应抛错', () => {
      expect(() => calculateBusinessDays('2026-04-20', '2026-04-17')).toThrow();
    });
  });
});
```

### Service + Mock 依赖（TS）

```typescript
import { OrderService } from './order-service';

describe('OrderService.normalizeAmount', () => {
  let service: OrderService;
  let repo: { findOne: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repo = { findOne: vi.fn() };
    service = new OrderService(repo as any);
  });

  describe('TC-[PREFIX]-01: BR-002 金额换算为 JPY', () => {
    it('USD 金额按汇率换算到 JPY', () => {
      const result = service.normalizeAmount(100, 'USD', { JPY: 150 });
      expect(result).toBe(15000);
    });

    it('JPY 金额直接返回', () => {
      const result = service.normalizeAmount(15000, 'JPY', { JPY: 150 });
      expect(result).toBe(15000);
    });
  });
});
```

### Python / pytest 模式

```python
import pytest
from app.services.order_service import normalize_amount


class TestNormalizeAmount:
    """TC-[PREFIX]-01: BR-002 金额换算为 JPY"""

    def test_usd_converted_to_jpy(self):
        result = normalize_amount(100, "USD", {"JPY": 150})
        assert result == 15000

    def test_jpy_returned_directly(self):
        result = normalize_amount(15000, "JPY", {"JPY": 150})
        assert result == 15000


# async 测试（pytest-asyncio + asyncio_mode="auto"）
class TestCreateOrder:
    """TC-[PREFIX]-10: F-003 创建订单"""

    async def test_create_order_success(self, db_session):
        order = await create_order(db_session, user_id="u1", amount=100)
        assert order.id is not None
        assert order.status == "pending"
```

---

## 5. TC 命名约定

所有 runner 共用的 TC 命名规范：

```
TC-[PREFIX]-[NN]: [REQ-IDS] - [Description]
```

- **JS/TS**：放在 `describe()` 里
- **Python**：放在类名 docstring 或 test 函数 docstring 里

一个 TC 可以包含多个 `it()` / `test_*`，表示同一场景下的不同输入（等价类/边界）。

---

## 6. Mock 策略对照

| 被 mock 对象 | Jest                                      | Vitest                                      | pytest                                      |
| ------------ | ----------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| 模块级 mock  | `jest.mock('./module')`                   | `vi.mock('./module')`                       | `monkeypatch.setattr('module.attr', value)` |
| 函数级 stub  | `jest.fn()`                               | `vi.fn()`                                   | `unittest.mock.Mock()` / `AsyncMock()`      |
| 时间/时钟    | `jest.useFakeTimers().setSystemTime(...)` | `vi.useFakeTimers(); vi.setSystemTime(...)` | `freezegun.freeze_time("...")`              |
| 环境变量     | `beforeEach` 存/恢复 `process.env`        | 同 Jest                                     | `monkeypatch.setenv(...)`                   |
| HTTP 请求    | `msw` / `jest.fn()`                       | 同 Jest                                     | `httpx.MockTransport` / `respx`             |
| DB / ORM     | 用 Repository mock 代替真连接             | 同 Jest                                     | `SQLAlchemy` session fixture + in-memory DB |

**不 mock 的东西**：

- 被测函数自身
- 同文件的辅助函数（除非它调用外部依赖）
- 标准库 / 语言内置
- 项目内跨端共享的纯函数模块（shared utility 包 / 独立模块等）

---

## 7. 写测试的通用原则

### AAA 结构

```
Arrange  —— 准备输入和依赖
Act      —— 调用被测函数
Assert   —— 断言输出或副作用
```

让每一段都清晰可见，不要把三者混在一起。

### 独立性

- 每个 test 都能单独跑，不依赖别的 test 的副作用
- 有共享状态时用 `beforeEach` / fixture 重置
- 顺序无关：随机打乱也应该全绿

### 只 mock 边界

跨边界的依赖（DB / HTTP / 文件 / 时间 / 外部服务）才 mock。业务代码内部调用不要 mock——这是在测试"实现"而非"行为"，会让重构很痛苦。

### 测行为，不测实现

```typescript
// ❌ 在测实现细节
expect(service.internalHelper).toHaveBeenCalledWith(42);

// ✅ 在测行为
expect(service.computeTotal(items)).toBe(150);
```

内部 helper 调用次数、顺序这些是实现细节；接口的输入→输出才是行为。

---

## 8. 生成流程

1. 读测试计划，筛 `Tier=Unit` 的 TC
2. 按源代码位置分组到各端
3. 对每个端：识别 runner → 必要时初始化 → 按模板生成 `.spec.ts` / `test_*.py`
4. 展示所有新增/修改给用户审查，确认后写入
5. 告知用户执行命令：
   - Jest / Vitest：`pnpm test` 或 `npm test`（按项目 scripts）
   - pytest：`uv run pytest` / `pytest`（按项目命令）
   - 首次初始化的端，还需要 `pnpm install` / `uv sync` 安装新增依赖
