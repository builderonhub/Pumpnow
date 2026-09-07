/*
  Dual-chain migration.

  Existing data is Arc Testnet:
  chain_id = 5042002

  IMPORTANT:
  - Existing data is preserved.
  - liquidity_pools.token_address is renamed to "tokenAddress".
*/

BEGIN;

-- ============================================================
-- 1. Drop old foreign keys
-- ============================================================

ALTER TABLE "candles_1h" DROP CONSTRAINT IF EXISTS "candles_1h_token_address_fkey";
ALTER TABLE "candles_1m" DROP CONSTRAINT IF EXISTS "candles_1m_token_address_fkey";
ALTER TABLE "candles_5m" DROP CONSTRAINT IF EXISTS "candles_5m_token_address_fkey";
ALTER TABLE "fee_history" DROP CONSTRAINT IF EXISTS "fee_history_token_address_fkey";
ALTER TABLE "holders" DROP CONSTRAINT IF EXISTS "holders_token_address_fkey";
ALTER TABLE "liquidity_pools" DROP CONSTRAINT IF EXISTS "liquidity_pools_token_address_fkey";
ALTER TABLE "trades" DROP CONSTRAINT IF EXISTS "trades_token_address_fkey";

-- ============================================================
-- 2. Drop old indexes / unique constraints
-- ============================================================

DROP INDEX IF EXISTS "candles_1h_open_time_idx";
DROP INDEX IF EXISTS "candles_1m_open_time_idx";
DROP INDEX IF EXISTS "candles_5m_open_time_idx";

DROP INDEX IF EXISTS "fee_history_block_number_idx";
DROP INDEX IF EXISTS "fee_history_payer_address_block_timestamp_idx";
DROP INDEX IF EXISTS "fee_history_token_address_block_timestamp_idx";
DROP INDEX IF EXISTS "fee_history_transaction_hash_log_index_key";
DROP INDEX IF EXISTS "fee_history_type_block_timestamp_idx";

DROP INDEX IF EXISTS "holders_token_address_balance_idx";
DROP INDEX IF EXISTS "holders_wallet_address_last_updated_at_idx";

DROP INDEX IF EXISTS "indexed_events_block_number_idx";

DROP INDEX IF EXISTS "liquidity_pools_graduation_tx_hash_key";
DROP INDEX IF EXISTS "liquidity_pools_status_liquidity_idx";
DROP INDEX IF EXISTS "liquidity_pools_token_address_key";

DROP INDEX IF EXISTS "tokens_creation_tx_hash_key";
DROP INDEX IF EXISTS "tokens_creator_address_created_at_idx";
DROP INDEX IF EXISTS "tokens_graduated_at_idx";
DROP INDEX IF EXISTS "tokens_status_created_at_idx";
DROP INDEX IF EXISTS "tokens_status_market_cap_idx";
DROP INDEX IF EXISTS "tokens_status_volume_24h_idx";
DROP INDEX IF EXISTS "tokens_symbol_idx";

DROP INDEX IF EXISTS "trades_block_number_idx";
DROP INDEX IF EXISTS "trades_token_address_block_timestamp_idx";
DROP INDEX IF EXISTS "trades_token_address_side_block_timestamp_idx";
DROP INDEX IF EXISTS "trades_transaction_hash_log_index_key";
DROP INDEX IF EXISTS "trades_wallet_address_block_timestamp_idx";

-- ============================================================
-- 3. Add chain_id as NULLABLE first
-- ============================================================

ALTER TABLE "tokens"
  ADD COLUMN "chain_id" BIGINT;

ALTER TABLE "trades"
  ADD COLUMN "chain_id" BIGINT;

ALTER TABLE "holders"
  ADD COLUMN "chain_id" BIGINT;

ALTER TABLE "liquidity_pools"
  ADD COLUMN "chain_id" BIGINT;

ALTER TABLE "indexed_events"
  ADD COLUMN "chain_id" BIGINT;

ALTER TABLE "candles_1m"
  ADD COLUMN "chain_id" BIGINT;

ALTER TABLE "candles_5m"
  ADD COLUMN "chain_id" BIGINT;

ALTER TABLE "candles_1h"
  ADD COLUMN "chain_id" BIGINT;

ALTER TABLE "fee_history"
  ADD COLUMN "chain_id" BIGINT;

-- ============================================================
-- 4. Preserve liquidity_pools.token_address
--    Prisma wants camelCase DB column "tokenAddress"
-- ============================================================

ALTER TABLE "liquidity_pools"
  RENAME COLUMN "token_address" TO "tokenAddress";

-- ============================================================
-- 5. Backfill existing data as Arc Testnet
-- ============================================================

UPDATE "tokens"
SET "chain_id" = 5042002
WHERE "chain_id" IS NULL;

UPDATE "trades"
SET "chain_id" = 5042002
WHERE "chain_id" IS NULL;

UPDATE "holders"
SET "chain_id" = 5042002
WHERE "chain_id" IS NULL;

UPDATE "liquidity_pools"
SET "chain_id" = 5042002
WHERE "chain_id" IS NULL;

UPDATE "indexed_events"
SET "chain_id" = 5042002
WHERE "chain_id" IS NULL;

UPDATE "candles_1m"
SET "chain_id" = 5042002
WHERE "chain_id" IS NULL;

UPDATE "candles_5m"
SET "chain_id" = 5042002
WHERE "chain_id" IS NULL;

UPDATE "candles_1h"
SET "chain_id" = 5042002
WHERE "chain_id" IS NULL;

UPDATE "fee_history"
SET "chain_id" = 5042002
WHERE "chain_id" IS NULL;

-- ============================================================
-- 6. Make chain_id required
-- ============================================================

ALTER TABLE "tokens"
  ALTER COLUMN "chain_id" SET NOT NULL;

ALTER TABLE "trades"
  ALTER COLUMN "chain_id" SET NOT NULL;

ALTER TABLE "holders"
  ALTER COLUMN "chain_id" SET NOT NULL;

ALTER TABLE "liquidity_pools"
  ALTER COLUMN "chain_id" SET NOT NULL;

ALTER TABLE "indexed_events"
  ALTER COLUMN "chain_id" SET NOT NULL;

ALTER TABLE "candles_1m"
  ALTER COLUMN "chain_id" SET NOT NULL;

ALTER TABLE "candles_5m"
  ALTER COLUMN "chain_id" SET NOT NULL;

ALTER TABLE "candles_1h"
  ALTER COLUMN "chain_id" SET NOT NULL;

ALTER TABLE "fee_history"
  ALTER COLUMN "chain_id" SET NOT NULL;

-- ============================================================
-- 7. Change primary keys
-- ============================================================

ALTER TABLE "tokens"
  DROP CONSTRAINT "tokens_pkey";

ALTER TABLE "tokens"
  ADD CONSTRAINT "tokens_pkey"
  PRIMARY KEY ("chain_id", "address");

ALTER TABLE "trades"
  DROP CONSTRAINT IF EXISTS "trades_pkey";

ALTER TABLE "holders"
  DROP CONSTRAINT "holders_pkey";

ALTER TABLE "holders"
  ADD CONSTRAINT "holders_pkey"
  PRIMARY KEY ("chain_id", "token_address", "wallet_address");

ALTER TABLE "indexed_events"
  DROP CONSTRAINT "indexed_events_pkey";

ALTER TABLE "indexed_events"
  ADD CONSTRAINT "indexed_events_pkey"
  PRIMARY KEY ("chain_id", "transaction_hash", "log_index");

ALTER TABLE "liquidity_pools"
  DROP CONSTRAINT "liquidity_pools_pkey";

ALTER TABLE "liquidity_pools"
  ADD CONSTRAINT "liquidity_pools_pkey"
  PRIMARY KEY ("chain_id", "address");

ALTER TABLE "candles_1m"
  DROP CONSTRAINT "candles_1m_pkey";

ALTER TABLE "candles_1m"
  ADD CONSTRAINT "candles_1m_pkey"
  PRIMARY KEY ("chain_id", "token_address", "open_time");

ALTER TABLE "candles_5m"
  DROP CONSTRAINT "candles_5m_pkey";

ALTER TABLE "candles_5m"
  ADD CONSTRAINT "candles_5m_pkey"
  PRIMARY KEY ("chain_id", "token_address", "open_time");

ALTER TABLE "candles_1h"
  DROP CONSTRAINT "candles_1h_pkey";

ALTER TABLE "candles_1h"
  ADD CONSTRAINT "candles_1h_pkey"
  PRIMARY KEY ("chain_id", "token_address", "open_time");

-- ============================================================
-- 8. Create new indexes
-- ============================================================

CREATE INDEX "candles_1h_chain_id_open_time_idx"
  ON "candles_1h"("chain_id", "open_time");

CREATE INDEX "candles_1m_chain_id_open_time_idx"
  ON "candles_1m"("chain_id", "open_time");

CREATE INDEX "candles_5m_chain_id_open_time_idx"
  ON "candles_5m"("chain_id", "open_time");

CREATE INDEX "fee_history_chain_id_token_address_block_timestamp_idx"
  ON "fee_history"("chain_id", "token_address", "block_timestamp" DESC);

CREATE INDEX "fee_history_chain_id_payer_address_block_timestamp_idx"
  ON "fee_history"("chain_id", "payer_address", "block_timestamp" DESC);

CREATE INDEX "fee_history_chain_id_type_block_timestamp_idx"
  ON "fee_history"("chain_id", "type", "block_timestamp" DESC);

CREATE INDEX "fee_history_chain_id_block_number_idx"
  ON "fee_history"("chain_id", "block_number");

CREATE UNIQUE INDEX "fee_history_chain_id_transaction_hash_log_index_key"
  ON "fee_history"("chain_id", "transaction_hash", "log_index");

CREATE INDEX "holders_chain_id_token_address_balance_idx"
  ON "holders"("chain_id", "token_address", "balance" DESC);

CREATE INDEX "holders_chain_id_wallet_address_last_updated_at_idx"
  ON "holders"("chain_id", "wallet_address", "last_updated_at" DESC);

CREATE INDEX "indexed_events_chain_id_block_number_idx"
  ON "indexed_events"("chain_id", "block_number");

CREATE INDEX "liquidity_pools_chain_id_status_liquidity_idx"
  ON "liquidity_pools"("chain_id", "status", "liquidity" DESC);

CREATE UNIQUE INDEX "liquidity_pools_chain_id_tokenAddress_key"
  ON "liquidity_pools"("chain_id", "tokenAddress");

CREATE UNIQUE INDEX "liquidity_pools_chain_id_graduation_tx_hash_key"
  ON "liquidity_pools"("chain_id", "graduation_tx_hash");

CREATE INDEX "tokens_chain_id_creator_address_created_at_idx"
  ON "tokens"("chain_id", "creator_address", "created_at" DESC);

CREATE INDEX "tokens_chain_id_status_created_at_idx"
  ON "tokens"("chain_id", "status", "created_at" DESC);

CREATE INDEX "tokens_chain_id_status_volume_24h_idx"
  ON "tokens"("chain_id", "status", "volume_24h" DESC);

CREATE INDEX "tokens_chain_id_status_market_cap_idx"
  ON "tokens"("chain_id", "status", "market_cap" DESC);

CREATE INDEX "tokens_chain_id_graduated_at_idx"
  ON "tokens"("chain_id", "graduated_at" DESC);

CREATE INDEX "tokens_chain_id_symbol_idx"
  ON "tokens"("chain_id", "symbol");

CREATE UNIQUE INDEX "tokens_chain_id_creation_tx_hash_key"
  ON "tokens"("chain_id", "creation_tx_hash");

CREATE INDEX "trades_chain_id_token_address_block_timestamp_idx"
  ON "trades"("chain_id", "token_address", "block_timestamp" DESC);

CREATE INDEX "trades_chain_id_token_address_side_block_timestamp_idx"
  ON "trades"("chain_id", "token_address", "side", "block_timestamp" DESC);

CREATE INDEX "trades_chain_id_wallet_address_block_timestamp_idx"
  ON "trades"("chain_id", "wallet_address", "block_timestamp" DESC);

CREATE INDEX "trades_chain_id_block_number_idx"
  ON "trades"("chain_id", "block_number");

CREATE UNIQUE INDEX "trades_chain_id_transaction_hash_log_index_key"
  ON "trades"("chain_id", "transaction_hash", "log_index");

-- ============================================================
-- 9. New foreign keys
-- ============================================================

ALTER TABLE "trades"
  ADD CONSTRAINT "trades_chain_id_token_address_fkey"
  FOREIGN KEY ("chain_id", "token_address")
  REFERENCES "tokens"("chain_id", "address")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "holders"
  ADD CONSTRAINT "holders_chain_id_token_address_fkey"
  FOREIGN KEY ("chain_id", "token_address")
  REFERENCES "tokens"("chain_id", "address")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "liquidity_pools"
  ADD CONSTRAINT "liquidity_pools_chain_id_tokenAddress_fkey"
  FOREIGN KEY ("chain_id", "tokenAddress")
  REFERENCES "tokens"("chain_id", "address")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "candles_1m"
  ADD CONSTRAINT "candles_1m_chain_id_token_address_fkey"
  FOREIGN KEY ("chain_id", "token_address")
  REFERENCES "tokens"("chain_id", "address")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "candles_5m"
  ADD CONSTRAINT "candles_5m_chain_id_token_address_fkey"
  FOREIGN KEY ("chain_id", "token_address")
  REFERENCES "tokens"("chain_id", "address")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "candles_1h"
  ADD CONSTRAINT "candles_1h_chain_id_token_address_fkey"
  FOREIGN KEY ("chain_id", "token_address")
  REFERENCES "tokens"("chain_id", "address")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "fee_history"
  ADD CONSTRAINT "fee_history_chain_id_token_address_fkey"
  FOREIGN KEY ("chain_id", "token_address")
  REFERENCES "tokens"("chain_id", "address")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

COMMIT;