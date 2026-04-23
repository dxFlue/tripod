---
name: spec-driven-testing
description: |
  Spec 驱动的三轨 TDD 工作流。引导用户编写功能需求 Spec（纯需求文档，不涉及 API/数据模型等技术细节），交叉审查所有 Spec 的重合/冲突/依赖关系，然后三路并行生成测试计划（用户手动 edge case + /graph-code-analysis 代码扫描 + Spec 推导 ~40 个用例），最终输出三层测试代码：单元测试 + Playwright API E2E + Playwright UI E2E。支持无代码的 greenfield 项目，单元测试框架可自动初始化。
  当用户提到需求规格、功能描述、测试计划、TDD、写 spec、edge case、测试生成、测试用例设计、三轨测试、单元测试、UI 测试时使用。即使用户只说"帮我写这个功能的需求"或"帮我设计测试用例"，也应该触发此 skill。
allowed-tools: Read Grep Glob Bash Agent Edit Write
argument-hint: [module-name | "review" | "generate module-name" | "implement module-name [unit|api|ui]"]
---

# Spec 驱动的三轨 TDD 工作流

这个 skill 的核心理念：**先把需求写清楚，再从三个不同角度生成测试用例，最大化覆盖率。**

Spec 是纯粹的需求文档——描述"这个功能/页面应该支持什么"，不涉及 API 设计、数据模型、技术选型等实现细节。这意味着在项目还没有代码的时候就可以开始写 Spec。

三轨测试生成的逻辑是三个视角互补：

- **Track A**（用户直觉）：用户凭经验提供的 edge case，覆盖业务层面的隐性知识
- **Track B**（代码扫描）：调用 `/graph-code-analysis` 分析已有代码，发现代码层面的盲区
- **Track C**（Spec 推导）：从需求 Spec 系统性展开，确保功能完整性覆盖

## 渐进式加载

| 阶段                    | 加载文件（相对于本文件所在目录）  |
| ----------------------- | --------------------------------- |
| Phase 1：Spec 编写      | `rules/spec-template.md`          |
| Phase 2：跨 Spec 审查   | `rules/cross-review-checklist.md` |
| Phase 3：测试计划生成   | `rules/test-plan-template.md`     |
| Phase 4.1：单元测试实现 | `rules/unit-test-patterns.md`     |
| Phase 4.2：API E2E 实现 | `rules/playwright-patterns.md`    |
| Phase 4.3：UI E2E 实现  | `rules/playwright-ui-patterns.md` |

只加载当前阶段需要的文件，不要一次性全部加载。Phase 4 按用户指定层级（unit/api/ui 或全部）只加载对应 pattern 文件。

---

## 0. 入口路由

每次触发时，先执行上下文扫描：

1. 读项目根的 `CLAUDE.md` / `README` / `AGENTS.md` 任一份（谁存在就读谁），识别：
   - 后端服务目录约定（如 `server/app/services/` / `apps/server/src/modules/` / `backend/services/` 等）
   - 前端页面目录约定（如 `apps/web/src/app/` / `src/pages/` / `frontend/src/routes/` 等）
   - 测试目录约定（`tests/` / `e2e/` / `__tests__/` 等）
   - 单元测试 runner（读 `package.json` 的 devDeps 判断 Jest / Vitest；读 `pyproject.toml` 判断 pytest）
2. 列出 `docs/specs/*.md`（排除 `*.test-plan.md`）已有 Spec——本 skill 约定 Spec 放 `docs/specs/`，若项目已有其他约定则跟随项目
3. 列出 `docs/specs/*.test-plan.md` 已有测试计划
4. 列出项目既有的 E2E 测试文件（根据步骤 1 识别出的测试目录）

然后根据参数决定进入哪个阶段：

| 参数                    | 条件                          | 进入阶段                               |
| ----------------------- | ----------------------------- | -------------------------------------- |
| `[module-name]`         | `docs/specs/[name].md` 不存在 | Phase 1（写 Spec）                     |
| `review`                | —                             | Phase 2（跨 Spec 审查）                |
| `generate [name]`       | Spec 存在但无 test-plan       | Phase 3（生成测试计划）                |
| `implement [name]`      | test-plan 存在                | Phase 4（三层都生成：unit + api + ui） |
| `implement [name] unit` | 同上 + 只想要单元测试         | Phase 4.1                              |
| `implement [name] api`  | 同上 + 只想要 API E2E         | Phase 4.2                              |
| `implement [name] ui`   | 同上 + 只想要 UI E2E          | Phase 4.3                              |

如果用户输入了模块名但已有 Spec 和 test-plan，询问用户想做什么。

---

## 1. Phase 1：Spec 编写引导

**加载 `rules/spec-template.md`，按其中定义的格式和交互流程引导用户。**

核心原则：

- Spec = 需求文档，只描述"用户能做什么"，不描述"怎么实现"
- 逐步引导，每次只问一个问题，等用户回答后再问下一个
- 不确定的部分允许标记为 `TBD`，后续迭代补充
- 引导用户至少想出 5 个 edge case（Section 7），这些会直接成为 Track A 的测试用例
- 保存到 `docs/specs/[module-name].md`

完成后告知用户：

- 可以用 `/spec-driven-testing review` 审查所有 Spec 的一致性
- 可以用 `/spec-driven-testing generate [name]` 生成测试计划

---

## 2. Phase 2：跨 Spec 交叉审查

**加载 `rules/cross-review-checklist.md`，按其中定义的审查维度检查所有 Spec。**

流程：

1. 读取 `docs/specs/` 下所有 Spec 文件（排除 `*.test-plan.md`）
2. 如果只有一个 Spec，告知用户写更多 Spec 后再审查跨功能关系；但仍然检查完整性
3. 按审查维度逐一比较，输出 FAIL/WARN/INFO 报告
4. 对每个 FAIL 和 WARN，交互式询问用户如何处理
5. 根据用户决定更新对应 Spec 的 Section 8（跨功能关联）

---

## 3. Phase 3：三轨测试计划生成

**加载 `rules/test-plan-template.md`，按三轨策略生成测试计划。**

### Track A — 用户 Edge Case

直接从目标 Spec 的 Section 7（Edge Cases）提取 EC-NNN，每个映射为 TC-[PREFIX]-A01, A02 ...

### Track B — 代码扫描（调用 `/graph-code-analysis`）

- 先检查该模块是否有对应代码（根据 §0 识别出的后端服务目录 + 前端页面目录搜索）
- **如果代码存在**：告知用户即将调用 `/graph-code-analysis` 进行分析，从分析结果中提取可测试的发现点，转化为测试用例
- **如果代码不存在**：输出 "Track B: Skipped — greenfield module, 无代码可扫描"，跳过

### Track C — Spec 推导（~40 个 E2E 用例）

从 Spec 的功能清单（F-NNN）、业务规则（BR-NNN）、流程状态系统性展开，覆盖 8 个维度（详见 `rules/test-plan-template.md`）。

### 合并去重

三轨结果合并，按标准化签名 `[功能]:[行为]:[预期结果]` 去重，生成最终编号 TC-PREFIX-01 ~ TC-PREFIX-NN。

输出到 `docs/specs/[module-name].test-plan.md`。

---

## 4. Phase 4：三层测试代码实现

测试计划里的每个 TC 都标注了所属层级（Unit / API / UI，详见 `rules/test-plan-template.md`）。Phase 4 按层级分发到对应的 pattern 文件生成代码。

### 公共流程

1. 读取 `docs/specs/[module-name].test-plan.md`
2. 按 TC 的 `Tier` 字段归组：Unit 组、API 组、UI 组
3. 根据参数决定跑哪些子阶段（默认三层都跑）
4. 每个子阶段生成前都要展示给用户审查，确认后再写入文件

### Phase 4.1：单元测试（Unit 组）

**加载 `rules/unit-test-patterns.md`。**

流程：

1. 读取 `docs/specs/[module-name].test-plan.md` 的 Unit 组 TC
2. 根据 TC 描述的源代码位置判断目标语言/runner：
   - TypeScript/JavaScript → 读 `package.json` 判断 Jest / Vitest
   - Python → 读 `pyproject.toml` 判断 pytest
   - 其他语言 → 询问用户项目采用的 runner
3. 检查目标端是否已配置 runner：
   - 未配置 → 按 `unit-test-patterns.md` 里的"首次初始化"清单自动补配置（告知用户改了哪些文件）
   - 已配置 → 跳过，直接写测试
4. 生成测试文件（路径约定见 pattern 文件）
5. 展示给用户审查后再写入

### Phase 4.2：Playwright API E2E（API 组）

**加载 `rules/playwright-patterns.md`。**

流程：

1. 读取 `docs/specs/[module-name].test-plan.md` 的 API 组 TC
2. 读取项目既有的 E2E API helper（若存在）了解已有函数
3. 确认需要新增的 API helper → 列出并询问用户
4. 生成测试文件到项目约定的 E2E 测试目录
5. 展示给用户审查后再写入

### Phase 4.3：Playwright UI E2E（UI 组）

**加载 `rules/playwright-ui-patterns.md`。**

流程：

1. 读取 `docs/specs/[module-name].test-plan.md` 的 UI 组 TC
2. 读取项目既有的 UI E2E 测试作为风格参考
3. 确认是否需要新增 API helper（UI 测试的 fixture 准备也走 API）
4. 生成测试文件到项目约定的 E2E 测试目录
5. 展示给用户审查后再写入
