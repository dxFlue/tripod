# Tripod

全栈代码模板体系（monorepo）。一份模板供多个业务项目复用。

仓库：<https://github.com/dxFlue/tripod>
npm scope：`@tripod-stack/*` + `eslint-plugin-tripod`（unscoped）

## 快速了解

- **计划文档**（权威）：
  - [`plans/tripod-core.md`](./plans/tripod-core.md) — AI 日常加载（硬规则 + 快速索引）
  - [`plans/mobile-react-19-x-mobile-encapsulated-quokka.md`](./plans/mobile-react-19-x-mobile-encapsulated-quokka.md) — 详细设计档案
- **目录结构**：见 `plans/tripod-core.md` §12。

## 前置要求

| 工具                    | 版本                                   |
| ----------------------- | -------------------------------------- |
| Node.js                 | ≥ 22.0.0（LTS）                        |
| pnpm                    | ≥ 10.0.0（锁在 `packageManager` 字段） |
| Docker + Docker Compose | 最新                                   |
| gitleaks                | 任意（`brew install gitleaks`）        |

## 起步

```bash
pnpm install
pnpm dev                   # 起开发环境（最小 profile：pg + redis）
pnpm dev --profile=full    # 全量：+ mailhog + minio + glitchtip
```

## 开发

```bash
pnpm lint                  # 所有包跑 eslint
pnpm typecheck             # 所有包跑 tsc
pnpm test                  # 所有包跑测试
pnpm build                 # 所有包 build
pnpm changeset             # 新增 changeset
```

## 项目状态

M2 里程碑建设中。当前阶段：基础设施（阶段 0）。
