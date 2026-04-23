# Changesets

Tripod 使用 [Changesets](https://github.com/changesets/changesets) 做版本 + 发布管理。

## 策略（plan-full §Changesets）

- **Lockstep（`fixed` 组）**：`@tripod-stack/*` 所有包 + `eslint-plugin-tripod` 版本强绑定，任一改动所有包一起升版、一起 publish
- **依赖写法**：workspace 内全部 `"workspace:*"`；`pnpm publish` 时自动替换为 `^x.y.z` 发 npm
- **发版入口**：`pnpm tripod release`（集成 smoke-test + changeset version + publish + push；本地跑，不代 CI）

## 日常流程

```bash
# 写了代码 + 想加 changeset
pnpm changeset                       # 交互式：选级别（patch/minor/major）+ 描述
# 产出 .changeset/<two-words>.md

# commit 正常走
git commit -m "feat: ..."
```

## 发版（维护者）

```bash
# 1. 消费 changesets，更新版本号 + CHANGELOG
pnpm changeset:version

# 2. 发 npm（需 npm login + OTP）
pnpm changeset:publish

# 3. push tag + 主分支
git push --follow-tags
```

具体见 `plans/mobile-react-19-x-mobile-encapsulated-quokka.md` §Changesets。
