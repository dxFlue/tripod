---
name: commit-and-release
description: |
  引导 AI 在 tripod 项目里做 commit / changeset / release 时按规范走：
  commit message 格式（conventional commits）、changeset 粒度（一个业务改动一个）、
  lockstep fixed group 检查（`@tripod-stack/*` + `eslint-plugin-tripod` 一起升）、smoke-test 顺序。
  本 skill **不依赖 plans/ 或 tasks.md**——只基于仓库里的 `.changeset/` 状态、git log、`package.json` 版本号判断。
when_to_use: 用户说"commit / 提交 / 写 changeset / 发版 / release / 打 tag / 升版号 / 要 push 了 / 改动怎么提交 / 发 0.1.0"。
priority: high
allowed-tools: Read Bash Grep Edit Write
---

# Commit / Changeset / Release 引导

tripod 走 **changesets + fixed group lockstep** 发版：所有 `@tripod-stack/*` 和 `eslint-plugin-tripod` 必须同版本号一起升。本 skill 固化 commit 规范 + changeset 粒度 + 发版 smoke-test。

## 0. 入口路由（先做 3 步扫描）

| 扫描 | 命令                                         | 用途                                                                            |
| ---- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| 1    | `git status --short && git log --oneline -5` | 看当前改动 + 最近 commit 风格                                                   |
| 2    | `ls .changeset/`                             | 看有无未消化的 changeset 草稿                                                   |
| 3    | `cat .changeset/config.json`                 | 确认 fixed group 配置（阶段 0 已设 `@tripod-stack/*` + `eslint-plugin-tripod`） |

---

## 1. Commit message 规范（Conventional Commits）

### 格式

```
<type>(<scope>): <subject>

<body，可选>
```

### type 白名单

| type       | 何时用                                            |
| ---------- | ------------------------------------------------- |
| `feat`     | 新功能 / 新包 / 新 skill / 新接口                 |
| `fix`      | 修 bug                                            |
| `refactor` | 不改行为的重构                                    |
| `perf`     | 性能优化                                          |
| `test`     | 只加 / 改测试                                     |
| `docs`     | 只改文档（README / JSDoc / `docs/*.md` / plans/） |
| `chore`    | 无业务影响的杂项（依赖升级 / 配置 / CI）          |
| `build`    | 构建系统 / tsup / turbo 配置                      |

### scope 约定

- 单包：`feat(shared-auth): ...`
- 跨包：`feat(shared): ...`
- apps：`feat(server): ...` / `feat(admin-web): ...`
- adapters：`feat(adapter-stripe): ...`
- skill / hook：`feat(skills): ...` / `chore(hooks): ...`
- 根配置：`chore(turbo): ...` / `chore(eslint): ...`
- 多个小范围：省略 scope，或 `chore: ...`

### subject 约束

- 小写开头（除专有名词）
- 动词在前（add / fix / drop / rename / bump）
- 不加句号
- ≤ 70 字符（超长放 body）

### body 写"为什么"（选写，但推荐）

```
fix(shared-logger): redact cookie header before emit

Pino redaction 默认没覆盖 cookie 字段，导致 Glitchtip 收到原始 session。
```

### 实例（照最近 commit 风格）

```
feat(skills): shared-package-author skill (SKILL.md + 4 rules, 831 lines)
fix(turbo): drop coverage/** output from test task
chore: reorganize plans/ into design/ + execution/ subdirs
feat: shared-* foundation layer — 8 packages (stage 1)
```

---

## 2. Commit 粒度

| 场景                         | 粒度                                                 | 例子                                                      |
| ---------------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| 新包完整交付                 | **1 commit** 含代码 + 测试 + README + 相关 docs 同步 | `feat(shared-auth): new shared-auth package (42 tests)`   |
| 跨包大重构（如改基础层接口） | **1 commit**（原子；回滚容易）                       | `refactor(shared-contract): split paginate out of ok/err` |
| 多个独立小改                 | 多 commit，每个独立语义                              | `fix(turbo): ...` + `chore(eslint): ...`                  |
| WIP / 调试输出               | **不 commit**（本 skill 禁用 --no-verify）           | —                                                         |

**禁用**：

- "update X"、"misc fixes" 这种空洞 subject
- 单个 commit 跨越多个不相关业务（要拆）
- `--no-verify`（绕 pre-commit hook）
- 把 `.log` / `node_modules/` / `.env*` 加进 commit

---

## 3. Changeset 粒度 + fixed group

### 什么时候写 changeset

| 场景                                                                                  | 要不要 changeset         |
| ------------------------------------------------------------------------------------- | ------------------------ |
| 改 `packages/shared-*` 代码（影响消费方）                                             | ✅ 必须                  |
| 改 `packages/eslint-plugin-tripod` / `eslint-config` / `prettier-config` / `tsconfig` | ✅ 必须（lockstep）      |
| 改 `.claude/skills/` / `.claude/hooks/`                                               | ❌ 不需要（非 npm 包）   |
| 改 `apps/*`                                                                           | ❌ 不需要（apps 不发版） |
| 改 `docs/*` / `plans/*` / README                                                      | ❌ 不需要                |
| 改 `infra/` / `turbo.json` / 根 `package.json`                                        | ❌ 不需要                |

### 怎么写

```bash
pnpm changeset  # 交互式
```

手写：`.changeset/<slug>.md`

```markdown
---
'@tripod-stack/shared-auth': minor
'@tripod-stack/shared-permission': minor
'eslint-plugin-tripod': minor
---

Added credential / session / MFA interfaces. Implemented email-password and username-password adapters.
```

### Fixed group lockstep

`.changeset/config.json` 里配了 fixed group：

```json
{
  "fixed": [["@tripod-stack/*", "eslint-plugin-tripod"]]
}
```

含义：**这组里任意一个升版号，所有都升同样版号**。

**硬约束**：

- changeset 的 `'包名': <bump>` 行只需写**直接改动的包**，fixed group 会自动扩散
- `<bump>` 级别：`patch` / `minor` / `major`（遵循 semver）
- 破坏性变更必须 `major`（即使本期只改一个包）
- 不写 changeset 就发版 → `changesets publish` 会跳过，版本号不动

### 粒度

| 场景                       | 做法                                         |
| -------------------------- | -------------------------------------------- |
| 一个业务功能跨多包         | **1 个 changeset**，列出所有改动包           |
| 一个 PR 含多个独立业务     | **多个 changeset**，每业务一个               |
| 纯重构（无消费方行为变更） | **1 个 changeset**，写 `patch`               |
| Breaking change            | 单独 changeset + `major` + body 列出迁移步骤 |

---

## 4. Smoke-test（发版前硬门槛）

`pnpm tripod release`（阶段 4 CLI 交付后）会跑这套；当前手动跑：

```
1. pnpm install                               # 锁 pnpm 版本
2. pnpm turbo run lint typecheck test build   # 全量 4 绿
3. pnpm changeset status                      # 看待发版 changeset
4. pnpm changeset version                     # 应用 changeset → 更新 package.json 版本 + CHANGELOG
5. git diff packages/*/package.json           # 人工核版本号（fixed group 都升了？）
6. pnpm install                               # 更新 pnpm-lock（版本号变了）
7. pnpm turbo run build                       # 二次 build（版本号进 dist/）
8. git add .changeset/ packages/*/package.json packages/*/CHANGELOG.md pnpm-lock.yaml
9. git commit -m "chore: version packages (<version>)"
10. pnpm changeset publish                    # 推 npm + 打 git tag
11. git push && git push --tags
```

**失败处理**：

- 任一步失败 → 停下报告，不绕过
- 版本号对不上（fixed group 不一致）→ 回 step 4 重跑；先 `git reset --hard` 清未 commit 改动
- npm publish 失败 → 看 npm token / 看 package `publishConfig.access`；**禁用** `--tag=force`

---

## 5. 发版节奏

| 版本号  | 何时发                                                                |
| ------- | --------------------------------------------------------------------- |
| `0.0.0` | 阶段 1 每包的默认 version（未发布）                                   |
| `0.1.0` | 阶段 8 首次发版（8 基础层 + 18 业务基建 + eslint-plugin）一起到 0.1.0 |
| `0.x.y` | 后续迭代（alpha 期，允许 breaking minor）                             |
| `1.0.0` | API 稳定后（需要决策）                                                |

**禁用**：

- 单独给某个包升版（fixed group 会自动扩散，但 changeset 要按 group 写）
- skip 发版号（比如从 0.1.0 直接跳 0.3.0）
- 发 pre-release `1.0.0-rc.1`（tripod 用 `0.x` 而非 rc）

---

## 6. AI 铁律

| 场景            | 必须做                                           | 必须不做                                                        |
| --------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| commit message  | Conventional Commits 格式                        | ❌ "update / misc / wip" 空洞 subject；❌ 大写开头；❌ 句号结尾 |
| commit 粒度     | 一个语义一个 commit                              | ❌ 跨业务混 commit                                              |
| 绕过 hook       | 不绕                                             | ❌ `--no-verify`；❌ `--no-gpg-sign`                            |
| changeset 判断  | 改 `packages/shared-*` 必须写                    | ❌ 改 shared-\* 但不写 changeset                                |
| fixed group     | 依赖 group 自动扩散，不手改其他包版本            | ❌ 手改某包 package.json version                                |
| bump 级别       | breaking → major；加功能 → minor；修 bug → patch | ❌ breaking 偷偷 minor                                          |
| 发版 smoke-test | 10 步全绿                                        | ❌ 跳 step 2（全量 4 绿）                                       |
| 失败处理        | 停下报告                                         | ❌ `publish --force`；❌ 删错误 changeset "先发了再说"          |
| tag             | `pnpm changeset publish` 自动打                  | ❌ 手 `git tag v0.1.0`                                          |
| 推送顺序        | push commits → push tags                         | ❌ 只 push tag 不 push commit                                   |

---

## 7. 结束报告模板

做完 commit 或发版后给 5 行摘要：

### Commit 模式

```
✅ commit 完成：<short-sha>
message：<type>(<scope>): <subject>
changeset：<写了 / 不需要>
pre-commit：<绿 / 失败>
建议下一步：<push / 继续写 / 发版>
```

### Release 模式

```
✅ 发版完成：<version>
涉及包：<N 个（fixed group 全部）>
npm 推送：<N 个成功 / 0 失败>
git tag：<v0.1.0>
建议下一步：<验证 npm install @tripod-stack/shared-types / 写 release notes>
```
