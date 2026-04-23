-- 首次启动 postgres 时跑（docker-entrypoint-initdb.d/）
-- tripod_dev 由 POSTGRES_DB 自动创建。这里补 glitchtip 独立库。

CREATE DATABASE glitchtip_dev;

-- tripod_dev 里启用常用扩展
\c tripod_dev
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- glitchtip_dev 不用额外 extension（glitchtip 自己 migrate 建表）
