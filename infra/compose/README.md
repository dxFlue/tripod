# infra/compose/

Tripod docker-compose 文件。

| 文件                      | 场景                | 服务数                                                                                              |
| ------------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| `docker-compose.yml`      | 本地 dev            | profile=minimal：pg + redis（2）<br>profile=full：+ mailhog + minio + glitchtip(web+worker)（共 6） |
| `docker-compose.prod.yml` | 生产（阶段 7 交付） | business apps + pg + redis                                                                          |

## 起 dev 栈

```bash
# minimal（默认，pnpm dev 自动触发）
docker compose -f infra/compose/docker-compose.yml --profile minimal up -d

# full（通知/存储/错误上报都要本地验证时）
docker compose -f infra/compose/docker-compose.yml --profile full up -d
```

## 端口清单（dev）

| 服务          | 端口 | 访问                                                                        |
| ------------- | ---- | --------------------------------------------------------------------------- |
| postgres      | 5432 | `postgres://tripod:tripod@localhost:5432/tripod_dev`                        |
| redis         | 6379 | `redis://localhost:6379`                                                    |
| mailhog SMTP  | 1025 | `smtp://localhost:1025`（dev 发邮件目的地）                                 |
| mailhog web   | 8025 | <http://localhost:8025>（查收邮件）                                         |
| minio S3      | 9000 | `http://localhost:9000`（access: `tripod` / secret: `tripod-dev-password`） |
| minio console | 9001 | <http://localhost:9001>                                                     |
| glitchtip web | 8088 | <http://localhost:8088>（首次起需等 ~30s 迁移）                             |

## 首次起 glitchtip 注意

- `glitchtip-web` 启动时自动跑 DB migration，约 20–60s。此期间访问 8088 会 502，等日志看到 `Starting gunicorn` 即可用
- 首次登录前访问 <http://localhost:8088/accounts/register/> 建管理员账号（`ENABLE_ORGANIZATION_CREATION=true` 已允许自助注册）
- `SECRET_KEY` 在 dev 写死 — **生产切到 secrets/.env.prod 的真值**

## 停 + 清

```bash
docker compose -f infra/compose/docker-compose.yml down         # 停
docker compose -f infra/compose/docker-compose.yml down -v      # 停 + 删 volume（数据丢失）
```
