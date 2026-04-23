# 开发环境搭建

## 前置依赖

| 工具             | 版本     | 安装                                                      |
| ---------------- | -------- | --------------------------------------------------------- |
| Node.js          | ≥ 22.0.0 | [nodejs.org](https://nodejs.org/) 或 `fnm install 22`     |
| pnpm             | ≥ 10.0.0 | `corepack enable`（自动用 `packageManager` 字段锁定版本） |
| Docker + Compose | 最新     | [docker.com](https://www.docker.com/)                     |
| gitleaks         | 任意     | **见下**                                                  |

## gitleaks 安装（husky pre-commit 依赖）

### macOS

```bash
brew install gitleaks
```

### Linux

```bash
# 任选一种
sudo apt install gitleaks         # Debian/Ubuntu
sudo pacman -S gitleaks            # Arch
# 或下载二进制：https://github.com/gitleaks/gitleaks/releases
```

### Windows

```powershell
scoop install gitleaks
# 或
choco install gitleaks
```

### 验证

```bash
gitleaks version
# 示例输出：8.x.y
```

## 首次起项目

```bash
# 1. 克隆
git clone https://github.com/dxFlue/tripod.git
cd tripod

# 2. 装依赖（自动触发 husky install）
pnpm install

# 3. 起 dev 栈（最小 profile：pg + redis）
pnpm dev

# 4. 全量 dev 栈（+ mailhog + minio + glitchtip）
pnpm dev --profile=full
```

## 常见问题

见 `.claude/skills/dev-startup/troubleshoot.md`。

| 症状                                       | 原因                    | 修复                                                                |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------------------- |
| `EADDRINUSE :3000`                         | 上次进程没关            | `lsof -i:3000` → `kill <PID>`                                       |
| DB 连不上                                  | postgres 容器没起       | `docker compose up -d postgres`                                     |
| Prisma `Drift detected`                    | dev 和 migration 不同步 | `prisma migrate reset`（dev 才可以！）                              |
| Redis 连不上                               | redis 容器没起          | `docker compose up -d redis`                                        |
| `gitleaks: command not found`（commit 时） | 未装 gitleaks           | 按上表安装；不想装可改 `.husky/pre-commit` 删 gitleaks 段（不建议） |

## 提交流程

```bash
# 写代码 ...
git add <files>
git commit -m "feat: add something"   # 触发 pre-commit：gitleaks + lint-staged
git push                               # 触发 pre-push：turbo lint/typecheck/test/build
```

pre-push 校验用 `turbo --filter=...[origin/main]` 只跑动过的包；首次 push（远端尚无 main）自动降为全量校验。
