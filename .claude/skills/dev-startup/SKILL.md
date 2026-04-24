---
name: dev-startup
description: 引导用户起本地全栈开发环境，按固定顺序诊断起服务失败 / 端口冲突 / DB 连不上 / docker 容器异常 / mobile 启动入口
when_to_use: 用户说"起项目 / 跑不起来 / dev 挂了 / 端口冲突 / DB 连不上 / docker 容器 / mailhog/minio/glitchtip / mobile 启动 / Expo / EAS"等
priority: high
---

## 触发场景

| 用户说                                             | 该激活 | Claude 行为                                          |
| -------------------------------------------------- | ------ | ---------------------------------------------------- |
| 起项目 / 跑不起来 / dev 挂了 / 起不来              | ✅     | 走"诊断流程 5 步"                                    |
| 端口冲突 / EADDRINUSE / port in use                | ✅     | 走"端口冲突类"症状                                   |
| DB 连不上 / Prisma drift / Redis 连不上            | ✅     | 走"DB / 依赖容器类"症状                              |
| docker 容器没起 / mailhog / minio / glitchtip 没起 | ✅     | 走"依赖容器类"症状                                   |
| 要本地 HTTPS / mkcert / OAuth 回调                 | ✅     | 直接说 tripod 不管，引导用户自配                     |
| mobile 怎么起 / Expo 怎么跑 / EAS 怎么发版         | ✅     | 跳"Mobile 速查"，给命令 + 文档链接，**不进诊断流程** |

## 诊断流程（按顺序，不可跳）

| Step | 动作                          | Claude 怎么做                                               |
| ---- | ----------------------------- | ----------------------------------------------------------- |
| 1    | 确认 `pnpm install` 跑过      | 看 `node_modules/` 是否存在；缺失 → 让用户跑 `pnpm install` |
| 1.5  | 确认 `secrets/.env` 存在      | 不存在 → 让用户从 `secrets/.env.example` 复制               |
| 2    | 跑 `pnpm tripod doctor`       | Claude 直接执行，看 hot-spot / env / migration 报告         |
| 3    | 跑 `docker ps`                | Claude 直接执行，看依赖容器健康状态                         |
| 4    | 读 dev log                    | 按下面"读 log 降级序列"                                     |
| 5    | 对照 `troubleshoot.md` 症状表 | 命中症状 → 给出对应诊断命令 + 修复方案                      |

## 读 dev log 降级序列

| 顺序 | 来源                                                                     | 命令                                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4a   | 优先：`.tripod/logs/dev.latest.log`（用户用了 `pnpm tripod dev` 自动有） | `tail -200 .tripod/logs/dev.latest.log`                                                                                                                                |
| 4b   | 文件不存在 → 问用户启动方式                                              | "你是用 `pnpm tripod dev` 还是 `pnpm dev` 起的？"<br>用户用 `pnpm dev` → 让用户改用 `pnpm tripod dev`（自动有 log）<br>用户改不了 → 让用户复制 terminal 最后 30 行粘贴 |
| 4c   | 同步命令直接拿（不依赖 log）                                             | `pnpm tripod doctor` / `docker ps` / `docker logs <name>` / `pnpm tripod port:check <port>` / `pnpm prisma migrate status`                                             |

## AI 行为铁律

| 场景                        | 必须做                                                   | 必须不做                                                              |
| --------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| 端口冲突                    | `pnpm tripod port:check <port>` 查占用，告诉用户进程信息 | ❌ 不主动 `kill -9 <pid>`                                             |
| HTTPS / mkcert / OAuth 回调 | 提示"tripod 不管 HTTPS，自己装 mkcert + 配反代"          | ❌ 不试图配证书                                                       |
| Prisma drift                | 仅 dev 环境提示 `prisma migrate reset`                   | ❌ 不在 prod / staging 跑 reset                                       |
| docker 容器 health 失败     | 给 `docker logs <container>` 看日志                      | ❌ 不 `docker rm -f`                                                  |
| 看不到 dev server log       | 按"读 log 降级序列"走                                    | ❌ 不假装"我看到 log 了"<br>❌ 不主动跑 `pnpm dev` 起新进程（撞端口） |
| 跨平台 shell 命令           | 优先用 `tripod` CLI（已抹平 lsof / netstat 差异）        | ❌ 不直接给 `lsof` / `netstat` 命令（除非用户明确要 fallback）        |
| Mobile 启动 / 发版          | 给命令 + 文档链接                                        | ❌ 不替用户跑 `eas build` / `eas submit`                              |

## 配套 CLI 速查

| 命令                                      | 用途                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `pnpm tripod dev`                         | 一键起全栈（compose + migration + seed + turbo dev，**排除 mobile**） |
| `pnpm tripod dev --fresh`                 | 重置 DB + reseed demo                                                 |
| `pnpm tripod dev --profile=minimal\|full` | minimal=pg+redis / full=+mailhog+minio+glitchtip                      |
| `pnpm tripod doctor`                      | 检查 hot-spot / env / migration                                       |
| `pnpm tripod port:check <port>`           | 查端口占用（跨平台抹平 lsof / netstat）                               |
| `pnpm tripod demo:reset`                  | 仅重置 demo 数据                                                      |

## Mobile（admin-mobile / mall-mobile）

⚠️ tripod 不替你管 mobile 启动 / 调试 / 发版 —— 模拟器和真机调试是交互式，AI 介入价值低。
本节只给命令 + 官方文档入口，遇问题请直接看 Expo CLI 报错。

### 启动

| 目的                  | 命令                                  |
| --------------------- | ------------------------------------- |
| 起 Metro + 选模拟器   | `pnpm --filter admin-mobile start`    |
| 直接起 iOS 模拟器     | `pnpm --filter admin-mobile ios`      |
| 直接起 Android 模拟器 | `pnpm --filter admin-mobile android`  |
| Web 预览              | `pnpm --filter admin-mobile web`      |
| Expo Go 真机扫码      | 起 Metro 后按 `s` 切到 Expo Go，扫 QR |

### 发版

tripod **不管** mobile 发版，由业务团队按需选路线。常见三条路：

| 路线                                                   | 适合                                           | 文档入口                                 |
| ------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------- |
| **EAS**（Expo 官方云服务，付费 tier）                  | 大多数 Expo 项目；不想自己维护 native 构建环境 | https://docs.expo.dev/eas/               |
| **本地构建**（`expo prebuild` + Xcode/Android Studio） | 已有 native 工具链；不想付费                   | https://docs.expo.dev/workflow/prebuild/ |
| **fastlane / CI**（传统 native 发版）                  | 团队已有 fastlane / CI 资产                    | https://docs.fastlane.tools/             |

具体路线 + 命令由业务团队决定，AI 不预设、不代跑发版命令。

→ 详细症状表见 [troubleshoot.md](./troubleshoot.md)
