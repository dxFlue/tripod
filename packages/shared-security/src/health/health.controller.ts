import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * 健康检查三 probe 数据。
 */
export interface HealthCheckResult {
  readonly status: 'ok' | 'degraded' | 'down';
  readonly timestamp: string;
  readonly probes: Readonly<Record<string, HealthProbe>>;
}

export interface HealthProbe {
  readonly status: 'ok' | 'down';
  readonly durationMs?: number;
  readonly message?: string;
}

/**
 * 业务通过实现这个接口注册探针。用 `HEALTH_PROBES` DI token 聚合。
 */
export interface HealthProbeProvider {
  readonly name: string;
  /** 应当快（<200ms）；抛错或 timeout 视为 down。 */
  check(): Promise<HealthProbe>;
}

export const HEALTH_PROBES = Symbol.for('tripod.shared-security.HealthProbes');

/**
 * 健康检查 Controller。暴露三条路由：
 *
 * | 路由 | 用途 | 语义 |
 * |---|---|---|
 * | `GET /health/liveness` | K8s / Docker liveness | **永远返 200**（只要进程还活着） |
 * | `GET /health/readiness` | 准备接流量 | 所有 probe ok 返 200；任一 down 返 503 |
 * | `GET /health/startup` | 启动完成判定 | 和 readiness 一致但语义上是"初始化完成" |
 *
 * **Liveness 不能跑 probe**，否则 DB 短暂不可用会引起 K8s 重启循环，雪崩。
 */
@Controller('health')
export class HealthController {
  public constructor(
    @Optional()
    @Inject(HEALTH_PROBES)
    private readonly probes: readonly HealthProbeProvider[] = [],
  ) {}

  @Get('liveness')
  @HttpCode(200)
  public liveness(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('readiness')
  public async readiness(): Promise<HealthCheckResult> {
    return this.runProbes();
  }

  @Get('startup')
  public async startup(): Promise<HealthCheckResult> {
    return this.runProbes();
  }

  private async runProbes(): Promise<HealthCheckResult> {
    const entries = await Promise.all(
      this.probes.map(async (p): Promise<[string, HealthProbe]> => {
        const start = Date.now();
        try {
          const result = await p.check();
          return [p.name, { ...result, durationMs: Date.now() - start }];
        } catch (err) {
          return [
            p.name,
            {
              status: 'down',
              durationMs: Date.now() - start,
              message: err instanceof Error ? err.message : String(err),
            },
          ];
        }
      }),
    );
    const probeMap = Object.fromEntries(entries);
    const hasDown = entries.some(([, v]) => v.status === 'down');
    const status: HealthCheckResult['status'] = hasDown ? 'down' : 'ok';

    const result: HealthCheckResult = {
      status,
      timestamp: new Date().toISOString(),
      probes: probeMap,
    };

    if (hasDown) {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
