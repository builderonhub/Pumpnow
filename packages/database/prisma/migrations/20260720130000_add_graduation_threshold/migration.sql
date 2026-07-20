ALTER TABLE "tokens"
ADD COLUMN "graduation_threshold" DECIMAL(78,0) NOT NULL DEFAULT 1;

ALTER TABLE "tokens"
ALTER COLUMN "graduation_threshold" DROP DEFAULT;
