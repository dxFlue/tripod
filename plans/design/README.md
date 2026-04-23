# plans/design/

Tripod **设计文档**（权威契约）。AI 做任何决策前必须以此为准。

| 文件                                                           | 行数  | 作用                                         | 何时加载                     |
| -------------------------------------------------------------- | ----- | -------------------------------------------- | ---------------------------- |
| `tripod-core.md`                                               | ~1000 | AI 首加载：硬规则 + 快速索引 + 里程碑一句话  | 每个对话开头                 |
| `mobile-react-19-x-mobile-encapsulated-quokka.md`（plan-full） | ~8600 | 详细设计档案：接口定义 / 决策论证 / 示例代码 | core 不足以回答时按主题 grep |

## 修改规则

- 用户调契约（加/砍功能 / 调 recipe / 换技术栈）时 AI 先改 **plan-full**，再同步改 core
- 不在 core 贴大段代码（>20 行），示例代码放 plan-full
- core 行数 ≤ 1100，超过时砍最细的挪 plan-full
- 发现 core 与 plan-full 矛盾：**以 plan-full + 代码为准**，同步刷 core
- 执行进度不写到这里，写到 [`../execution/`](../execution/)

## 与执行档案的关系

`design/` 描述"应该做什么"，`execution/` 记录"实际做了什么 + 还剩什么"。
AI 按 design 决策、按 execution 找当前进度。
