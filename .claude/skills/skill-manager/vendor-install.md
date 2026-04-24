# Vendor Skill 安装手册

第三方开源 skill 的安装、登记、升级、卸载流程。

## M2 CLI 流程（推荐）

```bash
pnpm tripod skill:install https://github.com/anthropic-skills/code-reviewer
# → 下载到 .claude/skills/code-reviewer/（目录名取自 repo 末段，可自由改）
# → 交互式询问 trust（默认 community）
# → 生成 source.yaml + 登记 manifest.yaml（namespace: vendor）
# → 抽 SKILL.md 关键词到 skill-rules.json
```

## M2 手工 fallback（CLI 未 ready / 离线 / 自备源码）

```bash
# 1. 拉源码到任意目录名（不再要求 vnd- 前缀）
cp -r ~/Downloads/code-reviewer .claude/skills/code-reviewer/

# 2. git add . && git commit
# → pre-commit hook 自动跑 tripod skill:audit --auto
# → 检测到 orphan skill
# → 保守登记 namespace: custom, trust: experimental（手 copy 无法辨别是 vendor）
# → 输出："若来自外部请跑 tripod skill:relabel code-reviewer --namespace=vendor --trust=community"

# 3. 跑 relabel 修正 namespace + 补 source.yaml
pnpm tripod skill:relabel code-reviewer \
  --namespace=vendor \
  --trust=community \
  --source=https://github.com/anthropic-skills/code-reviewer \
  --ref=v1.2.0
# → 补建 source.yaml
# → 改 manifest.yaml 字段
```

## source.yaml schema

每个 vendor skill 目录下必有 `source.yaml`，由 `skill:install` / `skill:relabel` 生成。

```yaml
source: https://github.com/anthropic-skills/code-reviewer # 上游 URL
ref: v1.2.0 # tag / commit / npm version
installedAt: 2026-04-23 # 首次安装日期
trust: community # official / community / experimental
license: MIT # 检测自 LICENSE 文件
checksum: sha256:abc123... # 防本地误改
```

**字段说明**：

| 字段          | 必需 | 说明                                                                      |
| ------------- | ---- | ------------------------------------------------------------------------- |
| `source`      | ✅   | 上游来源 URL（github / npm / 直接下载链接）                               |
| `ref`         | ✅   | 版本锁定（tag 优先 / commit hash / npm version）                          |
| `installedAt` | ✅   | 首次安装日期，固定不变                                                    |
| `trust`       | ✅   | 安装时询问（默认 `community`）；`official` 仅 tripod / Anthropic 官方仓库 |
| `license`     | ✅   | 检测自 `LICENSE` / `LICENSE.md` 文件头部 200 字符                         |
| `checksum`    | ✅   | tar 后 sha256，`tripod skill:audit` 用来检测本地是否被改过                |

## 字段自动推断策略（pre-commit auto-register / skill:relabel）

按优先级，每个字段从多个来源推断：

| 字段                      | 推断顺序                                                                                                              | Fallback         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `source`                  | (1) skill 目录下 `.git/config` remote.origin.url<br>(2) `skill:install` 的参数<br>(3) 目录名匹配 `<host>-<repo>` 反推 | `unknown`        |
| `ref`                     | (1) skill 目录下 `.git` HEAD 当前 tag<br>(2) commit hash 前 7 位<br>(3) `package.json#version`                        | `unknown`        |
| `trust`                   | (1) source URL 匹配 tripod / Anthropic 官方 repo → `official`<br>(2) 其他 → `community`                               | `community`      |
| `version`（manifest）     | (1) `package.json#version`<br>(2) SKILL.md frontmatter `version`                                                      | `0.0.0`          |
| `license`                 | 扫 `LICENSE` / `LICENSE.md` / `LICENSE.txt` 头部 200 字符识别（MIT / Apache-2.0 / BSD-3 / ISC 等用特征匹配）          | `unknown`        |
| `checksum`                | tar 整目录 + sha256 自动算                                                                                            | —                |
| `priority`（skill-rules） | 默认 `medium`                                                                                                         | —                |
| `keywords`（skill-rules） | 抽自 SKILL.md frontmatter `description` / `## When to use` 章节                                                       | `[<目录名末段>]` |

→ 推断不准没关系。后续 `tripod skill:audit --fix <name>` 交互式调整。

## 为什么目录名自由？

- `manifest.yaml.skills.<name>.namespace` 是唯一 source of truth；目录名不承担判定职责
- 改目录名代价高（`git mv` + 更新所有引用），改 manifest 字段代价低（一行）
- 用户意外 copy 不会因"忘改前缀"而误判；走 `skill:relabel` 一条命令修正
- sync 安全通过 `namespace: template` 判定，不依赖目录名
- 防撞名靠"跨 namespace 不重名"约定（SKILL.md §5），不靠前缀隔离

## 升级路径

### M2 CLI

```bash
pnpm tripod skill:upgrade <name>
# → 读 source.yaml.ref → 比对上游最新 tag → 提示 diff → 确认后替换
# → 自动更新 manifest / source.yaml
```

### M2 手工

```bash
1. rm -r .claude/skills/<name>/（source.yaml 和目录一起删）
2. 拉新版到同名目录
3. git commit → pre-commit 跑 skill:audit --auto 重新登记
```

### M3+ 自动化

`tripod skill:upgrade <vendor-skill>`（M3+ 加强）：

- 批量升级所有 vendor skill
- 自动识别 breaking change（major 版本跳跃）要求人工确认

## 卸载

### M2 CLI

```bash
pnpm tripod skill:uninstall <name>
# → 删目录 + manifest / skill-rules 条目
# → git commit
```

### 手工等价

```bash
1. rm -r .claude/skills/<name>/
2. 手删 manifest.yaml 对应条目
3. 手删 skill-rules.json 对应条目
4. git commit
```

## checksum 校验失败怎么办

`tripod skill:audit` 会比对 vendor skill 目录的 sha256 与 source.yaml 中记录的 checksum。

| 不匹配的可能原因                    | 处理                            |
| ----------------------------------- | ------------------------------- |
| 你手改了 vendor skill 内容          | ❌ 不应该改！失去与上游同步能力 |
| 上游版本悄悄变了（同 tag 但内容变） | 重新跑安装流程，更新 checksum   |
| 文件系统 corruption                 | 重新拉源码                      |

**正确做法**：如果想改 vendor skill 行为 → fork 到上游 / 或跑 `tripod skill:new <name>` 建 custom skill 复用思路。**不要直接改 vendor 目录**。

## AI 行为铁律（vendor 段）

| 场景                | 必须做                                                                                      | 必须不做                                        |
| ------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 判定 namespace      | 读 `manifest.yaml.skills.<name>.namespace` 字段                                             | ❌ 不从目录名猜；目录名不承担判定职责           |
| 安装第三方 skill    | 跑 `tripod skill:install <url>`（M2 已交付）；离线场景引导走手工 fallback + `skill:relabel` | ❌ 不让用户自己拼目录前缀                       |
| 推断 license 字段   | 检测 LICENSE 文件                                                                           | ❌ 不假设 MIT；检测不到就标 `unknown`           |
| checksum 不匹配     | 提示用户确认修改是有意还是意外                                                              | ❌ 不自动重算 checksum 覆盖（会掩盖未授权改动） |
| vendor skill 不工作 | 引导用户看上游 issue 或 fork 改                                                             | ❌ 不直接改 vendor 目录代码                     |
