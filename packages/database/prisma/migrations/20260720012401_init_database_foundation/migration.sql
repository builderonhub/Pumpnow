-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('BONDING', 'GRADUATED');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "wallets" (
    "address" VARCHAR(42) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "tokens" (
    "address" VARCHAR(42) NOT NULL,
    "creator_address" VARCHAR(42) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "status" "TokenStatus" NOT NULL DEFAULT 'BONDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "graduated_at" TIMESTAMP(3),

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "transaction_hash" VARCHAR(66) NOT NULL,
    "log_index" INTEGER NOT NULL,
    "token_address" VARCHAR(42) NOT NULL,
    "wallet_address" VARCHAR(42) NOT NULL,
    "side" "TradeSide" NOT NULL,
    "token_amount" DECIMAL(78,0) NOT NULL,
    "quote_amount" DECIMAL(78,0) NOT NULL,
    "price" DECIMAL(38,18) NOT NULL,
    "block_number" BIGINT NOT NULL,
    "block_timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexer_states" (
    "key" VARCHAR(100) NOT NULL,
    "chain_id" BIGINT NOT NULL,
    "last_block_number" BIGINT NOT NULL,
    "last_block_hash" VARCHAR(66),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexer_states_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "tokens_creator_address_idx" ON "tokens"("creator_address");

-- CreateIndex
CREATE INDEX "tokens_status_created_at_idx" ON "tokens"("status", "created_at");

-- CreateIndex
CREATE INDEX "trades_token_address_block_timestamp_idx" ON "trades"("token_address", "block_timestamp");

-- CreateIndex
CREATE INDEX "trades_wallet_address_block_timestamp_idx" ON "trades"("wallet_address", "block_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "trades_transaction_hash_log_index_key" ON "trades"("transaction_hash", "log_index");

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_creator_address_fkey" FOREIGN KEY ("creator_address") REFERENCES "wallets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_token_address_fkey" FOREIGN KEY ("token_address") REFERENCES "tokens"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_wallet_address_fkey" FOREIGN KEY ("wallet_address") REFERENCES "wallets"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
