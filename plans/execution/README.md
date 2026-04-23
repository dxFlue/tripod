# plans/execution/

Tripod **执行跟踪**（滚动更新）。跟 `design/` 相反 —— 记录"实际做了什么"。

| 文件                | 作用                                                    | 更新时机                    |
| ------------------- | ------------------------------------------------------- | --------------------------- |
| `tasks.md`          | **任务清单主档** — 总阶段 + 子 task + 状态 + 依赖       | 每阶段启动 / 子 task 完成时 |
| `completion-log.md` | **阶段完成日志** — commit SHA、测试数、交付包、验收结果 | 每阶段完成时追加一节        |

## 职责边界

- **design/** 回答"要做什么、约束是什么"
- **execution/** 回答"做到哪了、下一步是什么、历史是什么"

不在这里写：

- 设计决策（→ design/tripod-core.md + plan-full）
- API 文档（→ 各 package 的 README.md）
- Build / dev 指令（→ docs/dev-setup.md）

## 与 AI 对话的关系

- 新会话启动时：AI 读 `tasks.md` 第一眼就知道当前做到哪阶段、哪些子 task 完成
- 阶段完成时：AI 在 `tasks.md` 标 completed、在 `completion-log.md` 追加一节
- 如果 AI 会话中断：下一次会话直接从 `tasks.md` 接力
