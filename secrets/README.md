# secrets/

**这个目录整个 gitignore。** 真值（DB 密码 / JWT_SECRET / SMTP 密码 / API Key 等）只存在发布人本地磁盘和生产 server 磁盘，永不过 CI / git。

## 必须的本地安全措施

- **磁盘加密**：Mac FileVault / Windows BitLocker 必须开启
- **离线备份**：`secrets/.env.prod` 内容复制一份到 1Password / Bitwarden（防电脑丢失）
- **禁止云盘同步明文**：iCloud Drive / Dropbox / Google Drive 的 `secrets/` 目录禁止同步

## 目录约定

```
secrets/
├── .env.prod       生产真值
├── .env.staging    预发真值（可选）
└── README.md       本文件（唯一入库文件）
```

## 日常流程

1. 首次配置：`cp infra/deploy/.env.prod.example secrets/.env.prod` → `vim secrets/.env.prod` → `pnpm tripod env:validate secrets/.env.prod`
2. 加新变量：改 `packages/shared-config/src/env.ts` Zod schema → `pnpm tripod env:gen-example > infra/deploy/.env.prod.example` → 把新 key 加到 `secrets/.env.prod`
3. 发布：`infra/deploy/build.sh v1.2.3` 自动跑 `env:validate` 预检
