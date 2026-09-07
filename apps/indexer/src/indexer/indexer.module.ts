import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { AbiLoader } from "./abi.loader";
import {
  BlockchainSourceService,
  createBlockchainSourceToken,
  type BlockchainSourceConfig,
} from "./blockchain-source.service";
import { EventProcessorService } from "./event-processor.service";
import {
  createIndexerRunnerToken,
  IndexerRunnerService,
} from "./indexer-runner.service";
import { RedisLockService } from "./redis-lock.service";
import { StructuredLogger } from "./structured-logger.service";

const arcIndexerConfig: BlockchainSourceConfig = {
  name: "arc",
  chainId: 5042002n,
  rpcUrls: ["https://rpc.testnet.arc.network"],
  factoryAddress: "0x832c135903f0BbdB4d4ea24170a5AC79F570aB68",
  startBlockEnv: "INDEXER_START_BLOCK",
};

const opnIndexerConfig: BlockchainSourceConfig = {
  name: "opn",
  chainId: 984n,
  rpcUrls: ["https://testnet-rpc.iopn.tech"],
  factoryAddress: "0x6CA6457fcFBcE13f53780e6b38B4BE6F171b7657",
  startBlockEnv: "OPN_INDEXER_START_BLOCK",
};

@Module({
  providers: [
    AbiLoader,

    {
      provide: createBlockchainSourceToken("arc"),
      useFactory: (abiLoader: AbiLoader) =>
        new BlockchainSourceService(
          arcIndexerConfig,
          abiLoader,
        ),
      inject: [AbiLoader],
    },

    {
      provide: createBlockchainSourceToken("opn"),
      useFactory: (abiLoader: AbiLoader) =>
        new BlockchainSourceService(
          opnIndexerConfig,
          abiLoader,
        ),
      inject: [AbiLoader],
    },

    EventProcessorService,
    RedisLockService,
    StructuredLogger,
    PrismaService,
    ConfigService,

    {
      provide: createIndexerRunnerToken("arc"),
      useFactory: (
        config: ConfigService,
        prisma: PrismaService,
        source: BlockchainSourceService,
        processor: EventProcessorService,
        lock: RedisLockService,
        logger: StructuredLogger,
      ) =>
        new IndexerRunnerService(
          config,
          prisma,
          source,
          processor,
          lock,
          logger,
          {
            name: "arc",
            startBlockEnv: "INDEXER_START_BLOCK",
          },
        ),
      inject: [
        ConfigService,
        PrismaService,
        createBlockchainSourceToken("arc"),
        EventProcessorService,
        RedisLockService,
        StructuredLogger,
      ],
    },

    {
      provide: createIndexerRunnerToken("opn"),
      useFactory: (
        config: ConfigService,
        prisma: PrismaService,
        source: BlockchainSourceService,
        processor: EventProcessorService,
        lock: RedisLockService,
        logger: StructuredLogger,
      ) =>
        new IndexerRunnerService(
          config,
          prisma,
          source,
          processor,
          lock,
          logger,
          {
            name: "opn",
            startBlockEnv: "OPN_INDEXER_START_BLOCK",
          },
        ),
      inject: [
        ConfigService,
        PrismaService,
        createBlockchainSourceToken("opn"),
        EventProcessorService,
        RedisLockService,
        StructuredLogger,
      ],
    },
  ],

  exports: [
    createIndexerRunnerToken("arc"),
    createIndexerRunnerToken("opn"),
  ],
})
export class IndexerModule {}