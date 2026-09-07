import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { RedisService } from "../redis/redis.service";
import {
  createIndexerRunnerToken,
  IndexerRunnerService,
} from "../indexer/indexer-runner.service";

type RunnerHealth = {
  mode: string;
  running: boolean;
  latestIndexedBlock: string | null;
  latestChainBlock: string | null;
};

type HealthResponse = {
  status: "ok";
  service: "pumpnow-indexer";
  checks: {
    postgres: "up";
    redis: "up";
    chains: {
      arc: RunnerHealth;
      opn: RunnerHealth;
    };
  };
  timestamp: string;
};
function serializeHealth(
  health: {
    mode: string;
    running: boolean;
    latestIndexedBlock: bigint | null;
    latestChainBlock: bigint | null;
  },
): RunnerHealth {
  return {
    mode: health.mode,
    running: health.running,
    latestIndexedBlock:
      health.latestIndexedBlock === null
        ? null
        : health.latestIndexedBlock.toString(),
    latestChainBlock:
      health.latestChainBlock === null
        ? null
        : health.latestChainBlock.toString(),
  };
}
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,

    @Inject(createIndexerRunnerToken("arc"))
    private readonly arcIndexer: IndexerRunnerService,

    @Inject(createIndexerRunnerToken("opn"))
    private readonly opnIndexer: IndexerRunnerService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const [postgres, redis, arc, opn] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
      this.arcIndexer.health(),
      this.opnIndexer.health(),
    ]);

    const arcHealthy =
      arc.status === "fulfilled" &&
      (arc.value.mode !== "live" || arc.value.running);

    const opnHealthy =
      opn.status === "fulfilled" &&
      (opn.value.mode !== "live" || opn.value.running);

    if (
      postgres.status === "rejected" ||
      redis.status === "rejected" ||
      !arcHealthy ||
      !opnHealthy
    ) {
      throw new ServiceUnavailableException({
        status: "error",
        service: "pumpnow-indexer",
        checks: {
          postgres: postgres.status === "fulfilled" ? "up" : "down",
          redis: redis.status === "fulfilled" ? "up" : "down",
          chains: {
            arc:
              arc.status === "fulfilled"
                ? arc.value
                : {
                    mode: "unknown",
                    running: false,
                    latestIndexedBlock: null,
                    latestChainBlock: null,
                  },
            opn:
              opn.status === "fulfilled"
                ? opn.value
                : {
                    mode: "unknown",
                    running: false,
                    latestIndexedBlock: null,
                    latestChainBlock: null,
                  },
          },
        },
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: "ok",
      service: "pumpnow-indexer",
      checks: {
        postgres: "up",
        redis: "up",
        chains: {
          arc: serializeHealth(arc.value),
          opn: serializeHealth(opn.value),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}