# plans/

Tripod 计划 + 任务档案。两个子目录：

| 子目录                       | 内容                           | 更新频率       |
| ---------------------------- | ------------------------------ | -------------- |
| [`design/`](./design/)       | 设计文档（权威、AI 首加载）    | 架构决策变化时 |
| [`execution/`](./execution/) | 执行跟踪（任务清单、阶段日志） | 每阶段完成同步 |

## 快速导航

**AI 日常加载顺序**：

1. [`design/tripod-core.md`](./design/tripod-core.md) — AI 首加载（硬规则 + 快速索引，~1000 行）
2. [`design/mobile-react-19-x-mobile-encapsulated-quokka.md`](./design/mobile-react-19-x-mobile-encapsulated-quokka.md) — 详细设计档案（plan-full，~8600 行，按主题 grep）
3. [`execution/tasks.md`](./execution/tasks.md) — 当前任务清单 + 阶段进度
4. [`execution/completion-log.md`](./execution/completion-log.md) — 已完成阶段的交付记录（commit / 测试数 / 产出清单）

## 文档优先级

```
tripod.manifest.yaml（未来的机器可读 SoT，阶段 4 由 CLI 产出）
  > plans/design/tripod-core.md
    > plans/design/mobile-react-19-x-mobile-encapsulated-quokka.md
      > 人类注释（最弱权威）
```

执行类文档（`execution/`）不参与契约优先级 — 是进度追踪 / 历史记录。
