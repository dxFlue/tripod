# dev-startup 症状表

按症状分 5 类。所有 `pnpm tripod port:check <port>` 是跨平台 CLI（M2 抹平 lsof / netstat）。

## 1. 端口冲突类

| 症状               | 直接原因                     | 诊断命令                      | 修复            | 备注              |
| ------------------ | ---------------------------- | ----------------------------- | --------------- | ----------------- |
| `EADDRINUSE :3000` | 上次 dev 没关 / 其他进程占用 | `pnpm tripod port:check 3000` | 让用户决定 kill | ❌ AI 不主动 kill |
| `EADDRINUSE :3001` | admin-web Vite 占用          | `pnpm tripod port:check 3001` | 同上            | —                 |
| `EADDRINUSE :8025` | mailhog UI 占用              | `pnpm tripod port:check 8025` | 同上            | full profile 才有 |
| `EADDRINUSE :9001` | minio console 占用           | `pnpm tripod port:check 9001` | 同上            | full profile 才有 |
| `EADDRINUSE :8088` | glitchtip 占用               | `pnpm tripod port:check 8088` | 同上            | full profile 才有 |

### 平台 fallback（用户没装 tripod CLI 时）

- macOS / Linux：`lsof -i:<port>`
- Windows：`netstat -ano | findstr :<port>`

## 2. 依赖容器类

| 症状                      | 直接原因                | 诊断命令                      | 修复                                                      | 备注                         |
| ------------------------- | ----------------------- | ----------------------------- | --------------------------------------------------------- | ---------------------------- |
| Postgres 连接拒绝         | 容器没起 / 没 ready     | `docker ps \| grep postgres`  | `docker compose up -d postgres` + 等 healthcheck          | dev DB pwd 在 `secrets/.env` |
| Redis 连接拒绝            | 容器没起                | `docker ps \| grep redis`     | `docker compose up -d redis`                              | —                            |
| mailhog 收不到邮件        | SMTP 配置不对           | 看 dev log "SMTP_HOST"        | 检查 `secrets/.env`：`SMTP_HOST=localhost SMTP_PORT=1025` | mailhog SMTP 是 1025 不是 25 |
| minio 上传 403            | bucket 没建 / key 不对  | `mc ls minio/`                | `mc mb minio/<bucket>`                                    | minio root 在 compose        |
| glitchtip 看不到错误      | DSN 没配 / 容器没 ready | `curl localhost:8088/health/` | 等 glitchtip 起 + 配 `SENTRY_DSN`                         | full profile 才有            |
| 容器 health 一直 starting | 资源不足 / 镜像未拉完   | `docker logs <container>`     | 看具体 log                                                | ❌ 不 `docker rm -f`         |

## 3. DB / Migration 类

| 症状                    | 直接原因                       | 诊断命令                     | 修复                               | 备注                 |
| ----------------------- | ------------------------------ | ---------------------------- | ---------------------------------- | -------------------- |
| Prisma "Drift detected" | dev schema 与 migration 不同步 | `pnpm prisma migrate status` | `pnpm prisma migrate reset`        | 🔴 仅 dev / 生产禁用 |
| Migration 失败          | schema 改坏                    | 看 stderr                    | 回滚 git 改动 + 重新生成 migration | —                    |
| Seed 失败               | demo 数据冲突                  | 看 seed log                  | `pnpm tripod demo:reset`           | 不碰 schema          |

## 4. 系统资源类

| 症状                             | 直接原因              | 诊断命令                                              | 修复                                 | 备注                                |
| -------------------------------- | --------------------- | ----------------------------------------------------- | ------------------------------------ | ----------------------------------- |
| `pnpm install` 报 ENOSPC         | 磁盘满 / inotify 上限 | `df -h` / `cat /proc/sys/fs/inotify/max_user_watches` | 清磁盘 / 调上限（Linux）             | macOS / Linux 上限不同              |
| docker 容器 OOM                  | 内存不足              | `docker stats`                                        | 调 Docker Desktop 内存配额           | Mac/Win Docker Desktop 默认 2G 偏小 |
| 镜像 platform mismatch（M-chip） | 镜像没 ARM 版         | 看 `docker logs` 的 `exec format error`               | compose 里加 `platform: linux/amd64` | Mac M1+ Intel 镜像走 Rosetta        |

## 5. 多 app 定位（哪个 app 挂了）

| 现象                       | 怎么定位                                                             |
| -------------------------- | -------------------------------------------------------------------- |
| `pnpm tripod dev` log 满屏 | 看 turbo 输出的 `[<app-name>]` 前缀（如 `[server]` / `[admin-web]`） |
| 单个 app 挂了              | 用 `pnpm --filter <app-name> dev` 单独起，看专属错误                 |
| 不知道哪个端口属于哪个 app | 看 `apps/<name>/package.json` 的 `dev` script 端口                   |

## tripod 不管的（直接告诉用户）

| 用户问                   | 标准回复                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 本地 HTTPS / 自签证书    | "tripod 不管 HTTPS。自己装 [mkcert](https://github.com/FiloSottile/mkcert) + 配反代（caddy / nginx / traefik 任选）" |
| OAuth 回调 localhost 403 | "OAuth 提供商不允许 http localhost。同上：mkcert + 反代成 https"                                                     |
| 生产证书                 | "由运维层（LB / CDN）负责，不在 tripod 范围"                                                                         |
