---
name: nest-module-author
description: |
  引导 AI 在 tripod 的 `apps/server/src/modules/<name>/` 下新建一个 NestJS 业务 module 时按硬规则走：
  module / controller / service / guard / DTO / manifest 注册 + @Idempotent / @WithCorrelation / ErrorCode / OpenAPI / 多租户 / 测试。
  固化"单 module 6 文件 + 4 步验证"。
  本 skill **不依赖 plans/ 或 tasks.md**——靠前置条件（apps/server 存在）+ 抽象判断进入。
when_to_use: 用户说"加 user module / 加 order module / 写 NestJS controller / 加 API endpoint / 实现某个业务 service / 加 controller" 等要在 `apps/server/src/modules/<name>/` 下新建目录的场景。
priority: high
allowed-tools: Read Grep Glob Bash Edit Write
---

# NestJS Module 开发引导

tripod 的 server 端业务 = 若干 NestJS module。本 skill 固化"加一个 module"的标准 6 文件骨架 + 硬规则（装饰器 / 错误码 / 多租户 / OpenAPI / 测试）。

## 0. 前置条件检查

| 检查                                                       | 若不满足                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| `ls apps/server/src/modules/` 存在                         | **停下报告**：apps/server 尚未交付，本 skill 不越界（阶段 3） |
| `ls apps/server/src/modules/<用户要建的>/ 2>/dev/null`     | 存在 → 改已有 module，不新建                                  |
| shared-\* 基础层可用（`@tripod-stack/shared-contract` 等） | 不齐 → 停下报告                                               |

---

## 1. Phase 1：闸门（这是业务 module 吗？）

| 信号                                          | 走本 skill？                                    |
| --------------------------------------------- | ----------------------------------------------- |
| 有 `@Controller()` / HTTP endpoint / 业务流程 | ✅ 走                                           |
| 只定义接口 / 工具类 / 装饰器（给其他代码调）  | ❌ 走 shared-package-author                     |
| 实现外部 SDK 封装（Stripe / S3 等）           | ❌ 走 adapter-author                            |
| 只是 util / helper（无 @Injectable）          | ❌ 放 `apps/server/src/common/` 或 shared-utils |

---

## 2. Phase 2：6 文件骨架

```
apps/server/src/modules/<name>/
├── <name>.module.ts          # @Module 声明 + manifest 注册
├── <name>.controller.ts      # HTTP 入口
├── <name>.service.ts         # 业务逻辑
├── dto/
│   ├── create-<name>.dto.ts  # 输入 DTO + zod / class-validator
│   ├── update-<name>.dto.ts
│   └── query-<name>.dto.ts   # 含 PaginationDto
├── __tests__/
│   ├── <name>.controller.test.ts  # 覆盖所有 endpoint
│   └── <name>.service.test.ts     # 覆盖所有 public method
└── README.md                 # AI 友好文档（6 节，照 shared-package-author 的 README 约定）
```

### (a) Module 声明 + manifest

```ts
import { Module } from '@nestjs/common';
import { defineModuleManifest } from '@tripod-stack/shared-contract';
import { <Name>Controller } from './<name>.controller';
import { <Name>Service } from './<name>.service';

export const <name>Manifest = defineModuleManifest({
  name: '<name>',
  version: '1.0.0',
  providesPermissions: ['<domain>:<name>:read', '<domain>:<name>:write'],
  providesErrorCodes: [],  // 列出本 module 新增的 ErrorCode（如果有）
});

@Module({
  controllers: [<Name>Controller],
  providers: [<Name>Service],
  exports: [<Name>Service],
})
export class <Name>Module {}
```

### (b) Controller 模板

```ts
import { Controller, Get, Post, Patch, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ok, err } from '@tripod-stack/shared-contract';
import { ErrorCode, type ApiResult } from '@tripod-stack/shared-types';
import { <Name>Service } from './<name>.service';

@ApiTags('<name>')
@Controller('<name>s')    // 路径复数，snake 或 kebab
@UseGuards(PermissionGuard)   // 阶段 2 shared-permission 提供
export class <Name>Controller {
  constructor(private readonly service: <Name>Service) {}

  @Get()
  @ApiOperation({ summary: 'List <name>s' })
  @RequiresPermission('<domain>:<name>:read')
  async list(@Query() q: Query<Name>Dto): Promise<ApiResult<...>> {
    return ok(await this.service.list(q));
  }

  @Post()
  @ApiOperation({ summary: 'Create <name>' })
  @RequiresPermission('<domain>:<name>:write')
  @Idempotent({ headerName: 'x-idempotency-key', ttl: 60_000 })
  async create(@Body() dto: Create<Name>Dto): Promise<ApiResult<...>> {
    return ok(await this.service.create(dto));
  }

  // patch / delete / get one 同理
}
```

### (c) Service 模板

```ts
import { Injectable } from '@nestjs/common';
import { BusinessException, WithCorrelation } from '@tripod-stack/shared-contract';
import { ErrorCode } from '@tripod-stack/shared-types';

@Injectable()
export class <Name>Service {
  constructor(
    private readonly prisma: PrismaService,
    // 其他 shared-* 依赖按需注入
  ) {}

  @WithCorrelation()
  async list(q: Query<Name>Dto) {
    // tenantId 由 Prisma middleware 自动注入，这里不手写
    return this.prisma.<name>.findMany({ where: this.buildWhere(q), take: q.limit, skip: ... });
  }

  @WithCorrelation()
  async create(dto: Create<Name>Dto) {
    // 业务校验 → throw BusinessException + ErrorCode
    if (await this.prisma.<name>.findFirst({ where: { name: dto.name } })) {
      throw new BusinessException(ErrorCode.CONFLICT_DUPLICATE_NAME, 'name exists');
    }
    return this.prisma.<name>.create({ data: dto });
  }
}
```

### (d) DTO + 校验

```ts
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';   // 或 class-validator，按项目惯例

export const Create<Name>Schema = z.object({
  name: z.string().min(1).max(100),
  // ...
});

export class Create<Name>Dto extends createZodDto(Create<Name>Schema) {}
```

---

## 3. Phase 3：硬规则清单

| 场景               | 必须                                                                         | 禁用                                                         |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 错误               | `throw new BusinessException(ErrorCode.X, msg)`                              | ❌ `throw new Error(...)`；❌ `throw new HttpException(...)` |
| 错误码             | 映射到 `shared-types` `ErrorCode` enum 的现有码；新业务码加 enum 项 + 4 语言 | ❌ 字符串字面量；❌ 只写一种语言                             |
| 日志               | `@tripod-stack/shared-logger/server` 的 `createLogger(...)`                  | ❌ `console.*`（ESLint 拦）                                  |
| 多租户             | Prisma middleware 自动注入 tenantId（不在 service 写 `where: { tenantId }`） | ❌ 手写 tenantId 过滤                                        |
| 时间               | `dayjs`（走 `@tripod-stack/shared-utils` 的 `initDayjs` 后）                 | ❌ `new Date()` / `Date.now()`                               |
| 金额               | `Decimal`（shared-utils 提供）                                               | ❌ `number` / `bigint`                                       |
| 幂等               | 写操作走 `@Idempotent({ headerName, ttl })`                                  | ❌ service 层自己塞幂等逻辑                                  |
| CorrelationContext | Service 每个 public method 加 `@WithCorrelation()`                           | ❌ 手写 correlationId 传参                                   |
| 权限               | Controller 每个 endpoint 加 `@RequiresPermission('...')`                     | ❌ 无权限检查的 endpoint                                     |
| 分页               | 用 `PaginationDto`（shared-types）+ `paginate()`（shared-contract）          | ❌ 自造分页字段                                              |
| 响应               | `ok(data)` / `err(code, msg)` 走 shared-contract helper                      | ❌ 裸对象返回                                                |
| OpenAPI            | `@ApiTags` + `@ApiOperation` + DTO schema                                    | ❌ 无 swagger 标注                                           |
| DTO 校验           | zod 或 class-validator（按项目惯例）                                         | ❌ 手写校验                                                  |
| manifest           | `defineModuleManifest` 注册 permission / ErrorCode                           | ❌ 未注册（CLI doctor 会漏）                                 |

---

## 4. Phase 4：单元测试硬门槛

### 最低要求

| 层         | 最低覆盖                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| Controller | 每个 endpoint ≥ 1 happy + 1 error（权限拒绝 / 校验失败 / 业务冲突）                                        |
| Service    | 每个 public method ≥ 1 happy + 1 edge + 1 error                                                            |
| 跨租户隔离 | 若 module 操作 Prisma 表 → 至少 1 个跨租户 isolation test（借用 `prisma-tenancy-author` skill 的 fixture） |

### 测试风格

```ts
describe('<Name>Service', () => {
  let service: <Name>Service;
  let prisma: MockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mock<PrismaService>();
    service = new <Name>Service(prisma);
  });

  it('happy: create() 返回新建记录', async () => {
    prisma.<name>.create.mockResolvedValue({ id: '1', ... });
    expect(await service.create({ name: 'x' })).toEqual(expect.objectContaining({ id: '1' }));
  });

  it('error: 重复 name 抛 BusinessException', async () => {
    prisma.<name>.findFirst.mockResolvedValue({ id: '1' });
    await expect(service.create({ name: 'x' })).rejects.toThrow(BusinessException);
  });
});
```

**禁用**：`it.skip` / `it.only` / 空测试块糊过验证

## 5. 验证 4 步

1. `pnpm -F apps/server typecheck`
2. `pnpm -F apps/server test <name>`（filter 到新 module）
3. `pnpm -F apps/server lint`
4. 启动 server + curl endpoint 冒烟：`curl http://localhost:3000/<name>s` 看响应符合 `ApiResult` shape

失败 → 停报，按 `validation-runner` skill 的决策树诊断。

---

## 6. AI 铁律

| 场景       | 必须做                                                              | 必须不做                                                   |
| ---------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| 前置条件   | apps/server 已建                                                    | ❌ 没有也硬建 module                                       |
| 闸门       | 是业务 module 才走                                                  | ❌ 把 util / interface / adapter 写成 module               |
| 装饰器     | `@WithCorrelation` / `@Idempotent` / `@RequiresPermission` 该用就用 | ❌ service 不加 `@WithCorrelation`（日志丢关联）           |
| 错误       | `BusinessException` + `ErrorCode` 枚举                              | ❌ `HttpException` / 字符串错误                            |
| 多租户     | Prisma middleware 负责，service 不手写                              | ❌ `where: { tenantId }` 散落业务代码                      |
| 响应 shape | `ok()` / `err()`                                                    | ❌ 裸对象 / 裸 string                                      |
| 测试       | controller + service + 跨租户隔离（若涉及 DB）                      | ❌ 只写 service 不写 controller；❌ 不测隔离               |
| OpenAPI    | 每 endpoint 标注                                                    | ❌ 生产环境 API 无 swagger                                 |
| 分页       | 用 shared-types/contract 的 helper                                  | ❌ 自造 pagination shape                                   |
| 手动注册   | 走 `defineModuleManifest`                                           | ❌ 只在 @Module 里声明，不写 manifest（CLI doctor 查不到） |
| 失败       | 停下报告                                                            | ❌ `@ts-ignore` / `// eslint-disable` 糊                   |

---

## 7. 参考

| 用途                                    | 位置                                                     |
| --------------------------------------- | -------------------------------------------------------- |
| 已建 module 骨架样本                    | `apps/server/src/modules/<任一已建>/`                    |
| `defineModuleManifest` 用法             | `packages/shared-contract/src/module/define-manifest.ts` |
| `@Idempotent` / `@WithCorrelation` 实现 | `packages/shared-contract/src/decorators/`               |
| `ErrorCode` 枚举 + HTTP status 映射     | `packages/shared-types/src/errors/`                      |
| `ok` / `err` / `paginate` helper        | `packages/shared-contract/src/api/`                      |

**触发本 skill 后先 Read 已有 module 骨架**，不凭记忆写。
