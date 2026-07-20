import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { IndexerModule } from "../indexer/indexer.module";

@Module({
  imports: [IndexerModule],
  controllers: [HealthController],
})
export class HealthModule {}
