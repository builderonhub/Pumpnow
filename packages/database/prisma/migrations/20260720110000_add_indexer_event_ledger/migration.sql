ALTER TABLE "liquidity_pools"
  ALTER COLUMN "graduation_tx_hash" DROP NOT NULL,
  ALTER COLUMN "graduation_block_number" DROP NOT NULL;

CREATE TABLE "indexed_events" (
  "transaction_hash" VARCHAR(66) NOT NULL,
  "log_index" INTEGER NOT NULL,
  "block_number" BIGINT NOT NULL,
  "block_hash" VARCHAR(66) NOT NULL,
  "event_name" VARCHAR(50) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "indexed_events_pkey" PRIMARY KEY ("transaction_hash", "log_index")
);

CREATE INDEX "indexed_events_block_number_idx" ON "indexed_events"("block_number");
