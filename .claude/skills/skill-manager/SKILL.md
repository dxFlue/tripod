---
name: skill-manager
description: 引导业务团队加 / 改 / 删 / review / 安装第三方 skill；含决策树（哪个目录 / namespace / category）+ 命名约定 + 填 manifest 模板 + AI 行为铁律
when_to_use: 用户说"我想写个 skill / 加 skill / 改 skill / 删 skill / review skill / 装第三方 skill / skill 放哪 / skill 怎么管"等
priority: high
---

## 触发场景

| 用户说                                                  | 该激活 | 走哪个分支                                    |
| ------------------------------------------------------- | ------ | --------------------------------------------- |
| 我想写个 X skill / 加 skill / skill 放哪 / 怎么写 skill | ✅     | §3 Create                                     |
| 改 skill / skill 失效 / skill 没激活 / skill 报错       | ✅     | §7 Modify                                     |
| 删 skill / unused skill / 清理 skill                    | ✅     | §8 Delete                                     |
| review skill / audit skill / 季度清理                   | ✅     | §9 Audit                                      |
| 装第三方 skill / 安装开源 skill / vendor skill          | ✅     | §3 + [vendor-install.md](./vendor-install.md) |

## §2 先判断"该不该做成 skill"

**排除清单**（这 5 类不该做 skill）：

| 你的需求                                   | 正确去处                  | 为什么不该做 skill               |
| ------------------------------------------ | ------------------------- | -------------------------------- |
| 一句话规则 / 编码契约                      | `tripod-core.md` 硬规则区 | 每次会话固定加载，比按需激活更稳 |
| 编译时静态检查（禁某 import / 强制装饰器） | ESLint custom rule        | 编译时挡住比 AI 提醒更硬         |
| 一次性命令                                 | tripod CLI 子命令         | 命令式动作，不是 AI 引导         |
| 团队流程 / 决策记录                        | `docs/`                   | 给人看，不是给 AI 调             |
| 不需要 AI 主动唤起                         | `CLAUDE.md`               | 每次加载，无需触发               |

**入选标准**（满足任一即做 skill）：

- 多步流程（≥3 步且有顺序约束）
- 跨多个文件协调
- 内容 >100 行的指南
- 需要 Claude 主动唤起提醒（不只是被问到才查）

## §3 Create 分支：加 skill 决策树

```
你想加的 skill 是...
│
├── 自己写  ──────────→ tripod skill:new <name>
│   ├── CLI 建目录 .claude/skills/<name>/
│   ├── 生成 SKILL.md 模板（frontmatter: name / description / when_to_use / priority）
│   └── 自动登记 manifest.yaml（namespace: custom, trust: experimental 硬约定）
│
├── 第三方开源 ────────→ tripod skill:install <url>
│   ├── CLI 下载到 .claude/skills/<name>/（目录名取自 repo 末段，可自由改）
│   ├── 写 source.yaml（source / ref / license / checksum / trust）
│   └── 登记 manifest.yaml（namespace: vendor, trust: <询问>）
│
└── tripod 官方 ──────→ ❌ 不该用户加，等 `tripod sync`
```

**目录名无前缀约束**，namespace 以 `manifest.yaml.skills.<name>.namespace` 为唯一 source of truth。

完整对话流程 + 边界 case 见 [decision-tree.md](./decision-tree.md)。

## §4 category 决策

| skill 是...        | category      | 例                                |
| ------------------ | ------------- | --------------------------------- |
| 所有项目都用       | `global`      | dev-startup / spec-driven-testing |
| NestJS 专属        | `server`      | nest-module-scaffolding           |
| React + AntD 专属  | `web`         | antd-form-pattern                 |
| Next.js 专属       | `nextjs`      | nextjs-ssr-pattern                |
| Expo 专属          | `mobile`      | expo-permissions-flow             |
| tripod CLI 自身    | `cli`         | cli-command-template              |
| packages/shared-\* | `shared`      | shared-package-export             |
| 跨技术栈工具       | `cross-stack` | swap-ui-library                   |

`pnpm create tripod` 按 recipe 选定的 app 类型，按 `manifest.yaml.skills.<name>.category` 字段决定要不要拷给新项目。

## §5 命名约定

| 维度   | 约定                                                                                   |
| ------ | -------------------------------------------------------------------------------------- |
| 风格   | kebab-case 全小写连字符（`<动词>-<对象>` / `<对象>-<模式>`）                           |
| 长度   | 建议 2-5 个单词段                                                                      |
| 唯一性 | 跨所有 namespace 不撞名（即使 namespace 不同）                                         |
| 前缀   | **无前缀约束**（namespace 由 `manifest.yaml` 的 `namespace` 字段判定，不由目录名推导） |

**反例**（不要这样命名）：

| ❌                          | 为什么                         | ✅ 改成               |
| --------------------------- | ------------------------------ | --------------------- |
| `MyCoolSkill`               | 大小写不一致 + 形容词无信息    | `tenant-rls-fix`      |
| `util` / `misc` / `helpers` | 太宽泛，半年后没人记得是干嘛的 | 具体动词 + 对象       |
| `helper-stuff`              | "stuff" 是非词                 | `migration-checklist` |
| `Audit-Log`                 | 大写不规范                     | `audit-log-pattern`   |

## §6 填 manifest.yaml + skill-rules.json

### 推荐路线：用 CLI

```bash
# 自写：
pnpm tripod skill:new my-flow
# → CLI 建 .claude/skills/my-flow/
# → 登记 manifest.yaml（namespace: custom, trust 硬约定 experimental 不入库）
# → 生成 SKILL.md 模板让用户填内容

# 第三方装：
pnpm tripod skill:install https://github.com/foo/bar
# → CLI 下载到 .claude/skills/<name>/
# → 交互式询问 trust（默认 community）
# → 写 source.yaml + 登记 manifest.yaml（namespace: vendor, trust: <询问结果>）

# 手 copy 没走 CLI（fallback）：
# git commit 时 pre-commit 自动跑 tripod skill:audit --auto
# → 检测到 orphan skill
# → 保守登记 namespace: custom, trust: experimental（因为手 copy 无法辨别是 vendor）
# → 输出："若来自外部请跑 tripod skill:relabel <name> --namespace=vendor --trust=community"
```

→ 推断不准的字段（priority / 关键词）后续在 `tripod skill:audit --fix <name>` 交互式调整。

### 手填路线（不用 CLI 时）

**manifest.yaml**（在 `skills:` 段下追加）：

```yaml
skills:
  my-flow:
    namespace: custom # template / vendor / custom
    # trust: experimental     # vendor 必填；template/custom 省略（硬约定推导）
    category: global
    version: 0.1.0
    addedAt: 2026-04-23
    lastReviewedAt: 2026-04-23
    lastActivatedAt: null
    deprecatedAt: null
```

**skill-rules.json**（在 `skills` 段下追加）：

```json
{
  "skills": {
    "my-flow": {
      "priority": "medium",
      "promptTriggers": {
        "keywords": ["xxx", "yyy"],
        "intentPatterns": ["(动词).*?(对象)"]
      }
    }
  }
}
```

## §7 Modify 分支

| 改了什么                            | 必须做                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `SKILL.md` 内容                     | 更新 manifest 的 `lastReviewedAt` 为今天                                     |
| 触发词（keywords / intentPatterns） | 改 `skill-rules.json` + 更新 `lastReviewedAt`                                |
| 大版本变化（不向后兼容）            | `version` 升 major（语义化）                                                 |
| 标记暂时停用                        | manifest 加 `deprecatedAt: <today>`（hook 不再自动激活，Skill 工具仍可手调） |

## §8 Delete 分支

```
1. 跑 `tripod skill:audit` 确认 lastActivatedAt 在 6 月以上未激活
   （除非主动废弃，则跳）
2. 删目录：rm -r .claude/skills/<name>/
3. 删 manifest.yaml 中对应条目
4. 删 skill-rules.json 中对应条目
5. git add -A && git commit
```

**反悔路径**：暂时停用而非彻底删 → 在 manifest 加 `deprecatedAt`，半年后再 review。

## §9 Audit / Review 规则

跑 `tripod skill:audit` 一键报告。5 类信号：

| 信号                                      | 处理                               |
| ----------------------------------------- | ---------------------------------- |
| 超 6 个月未 `lastActivatedAt`             | 提议删除（除非有正当理由）         |
| 与 `_template/` 任意 skill 重叠           | 提议合并到上游或删                 |
| `deprecatedAt` 设置 + 30 天               | 直接删                             |
| 命名违规（参 §5）                         | 改名                               |
| vendor 缺 `source.yaml` / checksum 不匹配 | 补回或重装（参 vendor-install.md） |

## AI 行为铁律

| 场景                                   | 必须做                                                                                                      | 必须不做                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 激活任何 skill / 回答 skill 元信息问题 | **先读 `.claude/skills/manifest.yaml`** 了解 namespace / trust / category                                   | ❌ 不凭目录名或猜测判 namespace      |
| 用户加 / 装 skill                      | 走 CLI（`skill:new` / `skill:install`）；CLI 未实现时引导走 `skill:audit --auto` + `skill:relabel` fallback | ❌ 不手动建目录让用户自己填 manifest |
| 用户加 skill                           | 走决策树 + 询问"业务自写还是第三方安装？"                                                                   | ❌ 不擅自决定 namespace              |
| 用户删 skill                           | 先跑 `tripod skill:audit` 确认无激活 + 提示 git commit 兜底                                                 | ❌ 不直接 `rm -rf`                   |
| skill 改 manifest                      | 提示用户补 `lastReviewedAt` 时间戳                                                                          | ❌ 不替用户改时间戳                  |
| 用户问 hook 怎么写 / namespace 机制    | 引导看 plan §Skill 分发机制                                                                                 | ❌ 不在本 skill 范围                 |

---

→ 详细决策流程 + 边界 case 见 [decision-tree.md](./decision-tree.md)
→ 第三方安装详细流程见 [vendor-install.md](./vendor-install.md)
