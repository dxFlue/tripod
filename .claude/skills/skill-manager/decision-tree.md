# Skill 生命周期决策树（详细 + 边界 case）

按 5 个场景展开。每个场景给"用户原话 → AI 处理流程 → 边界 case"。

## 场景 1：用户说"我想写个 X skill"

### 处理流程

```
1. 先做"该不该做 skill"判断（参 SKILL.md §2 排除清单）
   └── 命中排除项 → 引导到正确去处（lint / CLI / docs / CLAUDE.md），不继续创建

2. 询问"自己写还是装第三方现成的？"
   ├── 自己写 → 走 §3-自写分支
   └── 装第三方 → 走 vendor-install.md

3. 自写分支：
   a. 询问 category（参 SKILL.md §4，给候选）
   b. 询问命名（kebab-case + 动词-对象，跨所有 namespace 不撞名）
   c. 跑 tripod skill:new <name>（CLI 建目录 + 登记 manifest.yaml: custom + experimental 硬约定）
   d. 让用户写 SKILL.md（frontmatter：name / description / when_to_use / priority）
   e. CLI 已自动登记 manifest + skill-rules，无需手填
```

### 边界 case

| 情况                                                                  | 处理                                                                                                                                           |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 用户说"加个 audit skill" 但内容是"禁某 import"                        | 实际应该写 ESLint custom rule，不是 skill。引导转到 `packages/eslint-plugin-tripod/`                                                           |
| 用户说"我想写个 skill" 但说不清楚要解决什么                           | 反问"你希望 Claude 在用户说什么的时候自动激活这个 skill？"。说不出 → 多半不该做 skill                                                          |
| 用户给的命名是 `audit` / `helper` 等过宽词                            | 让用户具体化：是审计**什么**？审计**操作**还是审计**日志**？引出 `audit-log-pattern` 这种具体名                                                |
| 用户想加的 skill 与某个 template skill（namespace: template）高度重叠 | 提议**改进上游**而非 fork：到 tripod 仓库提 PR；如果业务情境特殊确实要分叉，跑 skill:new + SKILL.md 顶部注明"基于 template `<name>` v1.x 修改" |

## 场景 2：用户说"改 skill"

### 处理流程

```
1. 询问改的是哪部分：
   ├── SKILL.md 内容（流程 / 模板）→ 改后更新 lastReviewedAt
   ├── 触发词（keywords / intentPatterns）→ 改 skill-rules.json + 更新 lastReviewedAt
   ├── 大版本（语义不向后兼容）→ 升 version major
   └── 暂时停用 → 加 deprecatedAt（不删）

2. 提示用户："改完后跑 tripod skill:audit 验证一致性"
```

### 边界 case

| 情况                                 | 处理                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 用户说"skill 没激活"                 | 先确认 skill-rules.json 有对应条目；keywords / intentPatterns 是否覆盖用户的 prompt；priority 是不是 low（low 仅在显式匹配触发） |
| 改了 SKILL.md 但忘改 manifest 时间戳 | pre-commit `tripod skill:audit --auto` 不会自动改 lastReviewedAt（那是人决定的）；提醒用户手动改                                 |
| 用户说"skill 报错"                   | skill 本身是 markdown 不会报错；多半是 hook 解析 / 触发词 regex 写错。引导跑 `tripod skill:audit` 看具体诊断                     |

## 场景 3：用户说"删 skill"

### 处理流程

```
1. 必须先跑 tripod skill:audit 看 lastActivatedAt
   ├── 6 月以上未激活 → 删除安全
   ├── 最近激活过 → 询问"确认删？还是你想停用而非删（加 deprecatedAt）？"
   └── 与 _template/ 重叠 → 提议先确认上游是否覆盖再删

2. 5 步 delete checklist（参 SKILL.md §8）
3. 提示 git commit 兜底（万一删错可以 git revert）
```

### 边界 case

| 情况                                  | 处理                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 用户想删 namespace: template 的 skill | ❌ 拒绝。template 由 tripod sync 管理，删了下次 sync 会拉回。引导：到 tripod 仓库提 issue / PR |
| 用户想删 vendor skill                 | 走标准 5 步；额外检查是否有其他 skill 依赖（M2 不强制，M3+ audit 加这一项）                    |
| 用户说"清理所有没用的 skill"          | ❌ 不批量删。逐个走 audit + 用户确认。批量误删风险高                                           |

## 场景 4：定期 audit

### 推荐节奏

| 频率        | 谁做                 | 做什么                                              |
| ----------- | -------------------- | --------------------------------------------------- |
| 每次 commit | pre-commit hook 自动 | `tripod skill:audit --auto` 检测孤儿 skill 自动登记 |
| 每月        | 人主动               | `tripod skill:audit` 看 5 类信号报告                |
| 季度        | 人主动               | 上面 + 决定哪些走 deprecate / delete / 上游合并     |

### 输出报告样例

```
$ tripod skill:audit

⚠️  STALE (>6 months since last activation):
  old-flow  (last used: 2025-09-12)  ← namespace: custom

⚠️  NEVER ACTIVATED (added >30 days ago):
  form-helper  (added: 2026-02-01)  ← namespace: custom

⚠️  OVERLAPS with template skills:
  dev-startup-v2  ← dev-startup (namespace: template) 已存在
  → 建议：合并到上游或删除

⚠️  NAMING VIOLATIONS:
  util  ← 太宽泛，应改为 <动词>-<对象>

⚠️  MISSING source.yaml (vendor):
  foo-bar  ← namespace: vendor 必须有 source.yaml

⚠️  ORPHAN skills (auto-registered as namespace: custom / trust: experimental):
  my-cool-skill  ← 若来自外部安装，跑 tripod skill:relabel

📊 12 skills total (5 template / 2 vendor / 5 custom). Action needed on 5.
```

## 场景 5：用户说"安装第三方 skill"

→ 直接跳 [vendor-install.md](./vendor-install.md)。

本场景不在 SKILL.md 主文件展开，因为细节多（source.yaml schema / 字段推断 / checksum / 升级路径）。

## 元规则：什么时候 AI 应该停下来问

| 用户原话                              | 信息够 / 不够 | AI 行为                                     |
| ------------------------------------- | ------------- | ------------------------------------------- |
| "加个 X skill" + 说清楚 X 是什么      | 够            | 走决策树                                    |
| "加个 skill" 没说什么                 | 不够          | 反问"想解决什么问题？"                      |
| "删了 X skill" + skill 在 manifest 里 | 够            | 跑 audit 后走 delete 流程                   |
| "删了 X skill" + skill 不在 manifest  | 不够          | 反问"你说的是 .claude/skills/ 下哪个目录？" |
| "review 一下 skill"                   | 够            | 跑 `tripod skill:audit`                     |
| "skill 不工作"                        | 不够          | 反问"哪个 skill / 你说什么时候该激活？"     |
