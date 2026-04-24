# Phase 3：README + 文档同步

新包必须有**符合 6 节骨架的 README**，禁散文。若仓库存在 `docs/shared-layer.md` 还需同步三处。

---

## 1. README.md 固定 6 节骨架

```markdown
# @tripod-stack/shared-<NAME>

<一句话职责>。**<关键属性 1>** + **<关键属性 2>**。

## 依赖位置

- **层级**：<基础层 / 业务基建层 / 跨端工具>
- **被谁依赖**：<列出或"业务 shared-\* 和 apps">
- **依赖**：<列出 @tripod-stack/\* + 第三方；或"无">

## 公共 API

### <主题 1：如错误码 / 类型 / hook>

| 名称 | 形式 | 作用 |
| ---- | ---- | ---- |
| ...  | ...  | ...  |

### <主题 2>

（同上）

## 安装

\`\`\`json
{
"dependencies": {
"@tripod-stack/shared-<NAME>": "workspace:\*"
}
}
\`\`\`

## 使用示例

### Golden path：<最典型场景>

\`\`\`ts
import { X } from '@tripod-stack/shared-<NAME>';
// 最小可运行例子
\`\`\`

### <场景 2>

\`\`\`ts
// ...
\`\`\`

## 反模式 ❌ vs 正确 ✅

### 1. <常见误用>

❌

\`\`\`ts
// 错的写法
\`\`\`

✅

\`\`\`ts
// 对的写法
\`\`\`

### 2. <另一个误用>

（同上）

## 相关

- \`@tripod-stack/<相关包>\` — 一行说明
- plan-full \`§<章节>\` — 一行说明（若本仓库有 plans/）
```

---

## 2. 6 节硬约束

| 节              | 硬约束                                                               |
| --------------- | -------------------------------------------------------------------- |
| 标题            | `# @tripod-stack/shared-<NAME>`，下一行**一句话职责** + 2 个加粗属性 |
| 依赖位置        | 3 子项（层级 / 被谁依赖 / 依赖），禁写段落                           |
| 公共 API        | 按主题分子节，**每节必须是表格**，3 列：名称 / 形式 / 作用           |
| 安装            | 只给 workspace:\* 写法                                               |
| 使用示例        | ≥ 2 个 golden path，每个 ≤ 20 行代码                                 |
| 反模式 ❌ vs ✅ | ≥ 2 对，每对 ❌ 在前、✅ 在后，代码块内                              |
| 相关            | bullet 指向其他 shared-\* 和 plan-full（若存在）                     |

**禁用**：

- 散文式描述（"本包提供了灵活的 XXX 机制" 这种）
- 单主题无表格的 API 章节
- 长段落代码示例 (> 30 行)
- 不给反模式的章节

---

## 3. 结构化 JSDoc（每个公开 export 都要）

````ts
/**
 * <一句话：这个函数做什么>
 *
 * @example
 * ```ts
 * const result = publicFn(input);
 * // result = { ... }
 * ```
 *
 * @see plan-full §<章节名>（若本仓库有 plans/）
 */
export function publicFn(input: In): Out {
  /* ... */
}
````

**禁用**：

- 多段描述（"此函数会 XXX，并且 YYY，当 ZZZ 时 ..."）
- 没 `@example` 的公开 export
- `@param` / `@returns` 长解释（类型签名已表达，不赘述）

---

## 4. 同步 `docs/shared-layer.md`（若存在）

先判断：

```bash
ls docs/shared-layer.md 2>/dev/null
```

- 不存在 → skip，Phase 3 结束
- 存在 → 必须同步**三处**：

### (a) 依赖图

文件顶部有 ASCII 依赖树或 Mermaid 图。把新包挂到正确的层级节点下。新节点要明确标出依赖指向。

### (b) 职责速查表

表格列：`# / 包 / 层 / 核心 API / 依赖 / 测试数`。追加一行，**测试数** 字段留到 Phase 4 拿到实际数字后填。

### (c) 接口扩展规则表

表格列：`能力 / 当前位置 / 扩展路径`。若新包暴露了新的可扩展接口（如自定义 Provider），追加一行。

---

## 5. 不同步任何 plans/ 文件

tasks.md / completion-log.md / plan-full 不归 skill 管——那些是用户的阶段管理文件。skill 只管 README + docs/shared-layer.md。

若用户说 "顺便更新 tasks.md"，按用户指示做；skill 默认不主动改 plans/ 下任何东西。
