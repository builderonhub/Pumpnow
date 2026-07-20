-- CreateEnum
CREATE TYPE "LiquidityPoolStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('TOKEN_CREATION', 'TRADE', 'GRADUATION');

-- AlterEnum
ALTER TYPE "TokenStatus" ADD VALUE 'GRADUATING';

-- DropIndex
DROP INDEX "tokens_creator_address_idx";

-- DropIndex
DROP INDEX "tokens_status_created_at_idx";

-- DropIndex
DROP INDEX "trades_token_address_block_timestamp_idx";

-- DropIndex
DROP INDEX "trades_wallet_address_block_timestamp_idx";

-- AlterTable
ALTER TABLE "tokens" ADD COLUMN     "bonding_curve_progress" DECIMAL(7,4) NOT NULL DEFAULT 0,
ADD COLUMN     "circulating_supply" DECIMAL(78,0) NOT NULL DEFAULT 0,
ADD COLUMN     "creation_block_number" BIGINT NOT NULL,
ADD COLUMN     "creation_tx_hash" VARCHAR(66) NOT NULL,
ADD COLUMN     "decimals" SMALLINT NOT NULL DEFAULT 18,
ADD COLUMN     "holder_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "market_cap" DECIMAL(38,18) NOT NULL DEFAULT 0,
ADD COLUMN     "price" DECIMAL(38,18) NOT NULL DEFAULT 0,
ADD COLUMN     "telegram_url" TEXT,
ADD COLUMN     "total_supply" DECIMAL(78,0) NOT NULL,
ADD COLUMN     "total_volume" DECIMAL(38,18) NOT NULL DEFAULT 0,
ADD COLUMN     "trade_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "volume_24h" DECIMAL(38,18) NOT NULL DEFAULT 0,
ADD COLUMN     "website_url" TEXT,
ADD COLUMN     "x_url" TEXT,
ALTER COLUMN "created_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "trades" DROP CONSTRAINT "trades_pkey",
ADD COLUMN     "fee_amount" DECIMAL(78,0) NOT NULL DEFAULT 0,
ADD COLUMN     "market_cap" DECIMAL(38,18) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" BIGSERIAL NOT NULL,
ADD CONSTRAINT "trades_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "holders" (
    "token_address" VARCHAR(42) NOT NULL,
    "wallet_address" VARCHAR(42) NOT NULL,
    "balance" DECIMAL(78,0) NOT NULL,
    "ownership_bps" INTEGER NOT NULL DEFAULT 0,
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holders_pkey" PRIMARY KEY ("token_address","wallet_address")
);

-- CreateTable
CREATE TABLE "liquidity_pools" (
    "address" VARCHAR(42) NOT NULL,
    "token_address" VARCHAR(42) NOT NULL,
    "quote_token_address" VARCHAR(42) NOT NULL,
    "dex" VARCHAR(50) NOT NULL,
    "status" "LiquidityPoolStatus" NOT NULL DEFAULT 'PENDING',
    "token_reserve" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "quote_reserve" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "liquidity" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "graduation_tx_hash" VARCHAR(66) NOT NULL,
    "graduation_block_number" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidity_pools_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "candles_1m" (
    "token_address" VARCHAR(42) NOT NULL,
    "open_time" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(38,18) NOT NULL,
    "high" DECIMAL(38,18) NOT NULL,
    "low" DECIMAL(38,18) NOT NULL,
    "close" DECIMAL(38,18) NOT NULL,
    "volume" DECIMAL(38,18) NOT NULL,
    "trade_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "candles_1m_pkey" PRIMARY KEY ("token_address","open_time")
);

-- CreateTable
CREATE TABLE "candles_5m" (
    "token_address" VARCHAR(42) NOT NULL,
    "open_time" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(38,18) NOT NULL,
    "high" DECIMAL(38,18) NOT NULL,
    "low" DECIMAL(38,18) NOT NULL,
    "close" DECIMAL(38,18) NOT NULL,
    "volume" DECIMAL(38,18) NOT NULL,
    "trade_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "candles_5m_pkey" PRIMARY KEY ("token_address","open_time")
);

-- CreateTable
CREATE TABLE "candles_1h" (
    "token_address" VARCHAR(42) NOT NULL,
    "open_time" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(38,18) NOT NULL,
    "high" DECIMAL(38,18) NOT NULL,
    "low" DECIMAL(38,18) NOT NULL,
    "close" DECIMAL(38,18) NOT NULL,
    "volume" DECIMAL(38,18) NOT NULL,
    "trade_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "candles_1h_pkey" PRIMARY KEY ("token_address","open_time")
);

-- CreateTable
CREATE TABLE "platform_stats" (
    "chain_id" BIGINT NOT NULL,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "bonding_tokens" INTEGER NOT NULL DEFAULT 0,
    "graduated_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_trades" BIGINT NOT NULL DEFAULT 0,
    "total_volume" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "volume_24h" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "total_fees" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "unique_traders" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_stats_pkey" PRIMARY KEY ("chain_id")
);

-- CreateTable
CREATE TABLE "fee_history" (
    "id" BIGSERIAL NOT NULL,
    "transaction_hash" VARCHAR(66) NOT NULL,
    "log_index" INTEGER NOT NULL,
    "token_address" VARCHAR(42),
    "payer_address" VARCHAR(42) NOT NULL,
    "type" "FeeType" NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "block_number" BIGINT NOT NULL,
    "block_timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holders_token_address_balance_idx" ON "holders"("token_address", "balance" DESC);

-- CreateIndex
CREATE INDEX "holders_wallet_address_last_updated_at_idx" ON "holders"("wallet_address", "last_updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "liquidity_pools_token_address_key" ON "liquidity_pools"("token_address");

-- CreateIndex
CREATE UNIQUE INDEX "liquidity_pools_graduation_tx_hash_key" ON "liquidity_pools"("graduation_tx_hash");

-- CreateIndex
CREATE INDEX "liquidity_pools_status_liquidity_idx" ON "liquidity_pools"("status", "liquidity" DESC);

-- CreateIndex
CREATE INDEX "candles_1m_open_time_idx" ON "candles_1m"("open_time");

-- CreateIndex
CREATE INDEX "candles_5m_open_time_idx" ON "candles_5m"("open_time");

-- CreateIndex
CREATE INDEX "candles_1h_open_time_idx" ON "candles_1h"("open_time");

-- CreateIndex
CREATE INDEX "fee_history_token_address_block_timestamp_idx" ON "fee_history"("token_address", "block_timestamp" DESC);

-- CreateIndex
CREATE INDEX "fee_history_payer_address_block_timestamp_idx" ON "fee_history"("payer_address", "block_timestamp" DESC);

-- CreateIndex
CREATE INDEX "fee_history_type_block_timestamp_idx" ON "fee_history"("type", "block_timestamp" DESC);

-- CreateIndex
CREATE INDEX "fee_history_block_number_idx" ON "fee_history"("block_number");

-- CreateIndex
CREATE UNIQUE INDEX "fee_history_transaction_hash_log_index_key" ON "fee_history"("transaction_hash", "log_index");

-- CreateIndex
CREATE INDEX "indexer_states_chain_id_idx" ON "indexer_states"("chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_creation_tx_hash_key" ON "tokens"("creation_tx_hash");

-- CreateIndex
CREATE INDEX "tokens_creator_address_created_at_idx" ON "tokens"("creator_address", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tokens_status_created_at_idx" ON "tokens"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tokens_status_volume_24h_idx" ON "tokens"("status", "volume_24h" DESC);

-- CreateIndex
CREATE INDEX "tokens_status_market_cap_idx" ON "tokens"("status", "market_cap" DESC);

-- CreateIndex
CREATE INDEX "tokens_graduated_at_idx" ON "tokens"("graduated_at" DESC);

-- CreateIndex
CREATE INDEX "tokens_symbol_idx" ON "tokens"("symbol");

-- CreateIndex
CREATE INDEX "trades_token_address_block_timestamp_idx" ON "trades"("token_address", "block_timestamp" DESC);

-- CreateIndex
CREATE INDEX "trades_token_address_side_block_timestamp_idx" ON "trades"("token_address", "side", "block_timestamp" DESC);

-- CreateIndex
CREATE INDEX "trades_wallet_address_block_timestamp_idx" ON "trades"("wallet_address", "block_timestamp" DESC);

-- CreateIndex
CREATE INDEX "trades_block_number_idx" ON "trades"("block_number");

-- AddForeignKey
ALTER TABLE "holders" ADD CONSTRAINT "holders_token_address_fkey" FOREIGN KEY ("token_address") REFERENCES "tokens"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holders" ADD CONSTRAINT "holders_wallet_address_fkey" FOREIGN KEY ("wallet_address") REFERENCES "wallets"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidity_pools" ADD CONSTRAINT "liquidity_pools_token_address_fkey" FOREIGN KEY ("token_address") REFERENCES "tokens"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candles_1m" ADD CONSTRAINT "candles_1m_token_address_fkey" FOREIGN KEY ("token_address") REFERENCES "tokens"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candles_5m" ADD CONSTRAINT "candles_5m_token_address_fkey" FOREIGN KEY ("token_address") REFERENCES "tokens"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candles_1h" ADD CONSTRAINT "candles_1h_token_address_fkey" FOREIGN KEY ("token_address") REFERENCES "tokens"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_history" ADD CONSTRAINT "fee_history_token_address_fkey" FOREIGN KEY ("token_address") REFERENCES "tokens"("address") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_history" ADD CONSTRAINT "fee_history_payer_address_fkey" FOREIGN KEY ("payer_address") REFERENCES "wallets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
