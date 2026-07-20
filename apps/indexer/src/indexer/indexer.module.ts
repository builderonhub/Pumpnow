import { Module } from "@nestjs/common";
import { AbiLoader } from "./abi.loader";
import { BlockchainSourceService } from "./blockchain-source.service";
import { EventProcessorService } from "./event-processor.service";
import { IndexerRunnerService } from "./indexer-runner.service";
import { RedisLockService } from "./redis-lock.service";
import { StructuredLogger } from "./structured-logger.service";

@Module({
  providers: [
    AbiLoader,
    BlockchainSourceService,
    EventProcessorService,
    RedisLockService,
    StructuredLogger,
    IndexerRunnerService,
  ],
  exports: [IndexerRunnerService],
})
export class IndexerModule {}
