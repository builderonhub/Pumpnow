import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { RedisService } from "../redis/redis.service";
import { IndexerRunnerService } from "../indexer/indexer-runner.service";

type HealthResponse = {
  status: "ok";
  service: "pumpnow-indexer";
  checks: {
    postgres: "up";
    redis: "up";
    latestIndexedBlock: string | null;
    latestChainBlock: string | null;
    worker: "running" | "idle";
  };
  timestamp: string;
};

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly indexer: IndexerRunnerService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const [postgres, redis, indexer] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
      this.indexer.health(),
    ]);

    if (
      postgres.status === "rejected" ||
      redis.status === "rejected" ||
      indexer.status === "rejected" ||
      (indexer.status === "fulfilled" &&
        indexer.value.mode === "live" &&
        !indexer.value.running)
    ) {
      throw new ServiceUnavailableException({
        status: "error",
        service: "pumpnow-indexer",
        checks: {
          postgres: postgres.status === "fulfilled" ? "up" : "down",
          redis: redis.status === "fulfilled" ? "up" : "down",
          indexer:
            indexer.status === "fulfilled" && indexer.value.running
              ? "up"
              : "down",
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
        latestIndexedBlock:
          indexer.value.latestIndexedBlock?.toString() ?? null,
        latestChainBlock: indexer.value.latestChainBlock?.toString() ?? null,
        worker: indexer.value.running ? "running" : "idle",
      },
      timestamp: new Date().toISOString(),
    };
  }
}
