# `.claude/skills/` —— Tripod skill 系统

Claude Code 项目级 skill 入口。Claude Code **不递归扫描**，所有 skill 必须扁平：`.claude/skills/<skill-name>/SKILL.md`。

## namespace 单点登记

`manifest.yaml.skills.<name>.namespace` 是 namespace 的**唯一 source of truth**。目录名无命名前缀约束（仅风格建议：kebab-case + 具体动词-对象）。

| namespace  | 谁维护                            | `tripod sync` 行为 | trust 约定                                                                         |
| ---------- | --------------------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| `template` | tripod 模板仓库                   | ✅ 覆写            | 硬约定 `official`（audit 时从 namespace 推导，不入库）                             |
| `vendor`   | 第三方开源（github / npm / 文件） | ❌ 不动            | manifest 显式写 + `<dir>/source.yaml`（`official` / `community` / `experimental`） |
| `custom`   | 业务自定义                        | ❌ 不动            | 硬约定 `experimental`（audit 时从 namespace 推导，不入库）                         |

例如：

- `dev-startup/` → `namespace: template`
- `code-reviewer/` → `namespace: vendor` + `trust: community` + `source.yaml`
- `my-business-flow/` → `namespace: custom`

**为什么目录名自由**：改目录名代价高（`git mv` + 更新所有引用），改 manifest 字段代价低（一行）。用户意外 copy 不会因"忘改前缀"而误判，走 `tripod skill:relabel` 一条命令修正。

## 关键文件

| 文件                    | 职责                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `manifest.yaml`         | 所有 skill 的注册表 + 时间戳真相源（`addedAt` / `lastReviewedAt` / `lastActivatedAt` / `deprecatedAt`） |
| `skill-rules.json`      | `skill-activation-prompt` hook 的触发词表                                                               |
| `<skill>/SKILL.md`      | skill 主文件（Anthropic 官方格式，frontmatter + 正文）                                                  |
| `<skill>/<resource>.md` | skill 资源文件（progressive disclosure，按需加载）                                                      |

## 加新 skill 该放哪？

详见 `skill-manager` skill（M2 待交付）。决策树概要：

```
你的 skill 是...
├── 自己写       → tripod skill:new <name>（CLI 自动登记 namespace: custom）
├── 第三方安装   → tripod skill:install <url>（CLI 自动写 source.yaml + 登记 namespace: vendor）
└── tripod 官方  → 不该用户加，等 tripod sync
```

## 配套机制

| 机制                | 谁负责                                                  | 何时触发          |
| ------------------- | ------------------------------------------------------- | ----------------- |
| skill 自动激活提示  | `skill-activation-prompt` hook (UserPromptSubmit)       | 每条 prompt       |
| 激活时间戳更新      | `skill-usage-tracker` hook (PostToolUse, matcher=Skill) | 每次调 Skill 工具 |
| 孤儿 skill 自动登记 | `tripod skill:audit --auto` (pre-commit hook)           | 每次 commit       |
| 定期 audit          | `tripod skill:audit` (CLI)                              | 用户手动          |
| 模板回流            | `tripod sync` (Tier 2)                                  | 用户手动          |

## category 取值

| category      | 适用项目                                 |
| ------------- | ---------------------------------------- |
| `global`      | 所有项目都装                             |
| `server`      | NestJS (apps/server) 项目                |
| `web`         | React + AntD (admin-web / platform) 项目 |
| `nextjs`      | Next.js (portal / mall-web) 项目         |
| `mobile`      | Expo (admin-mobile / mall-mobile) 项目   |
| `cli`         | tripod CLI 自身                          |
| `shared`      | packages/shared-\* 包                    |
| `cross-stack` | 跨技术栈工具型                           |

`pnpm create tripod <name>` 按 recipe 选定的 app 类型，按 `manifest.yaml` 的 `category` 字段裁剪要拷贝的 skill。
