-- DropIndex
DROP INDEX "Trade_transactionSig_key";

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "isDummy" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "quote" TEXT;

-- CreateIndex
CREATE INDEX "Trade_isDummy_idx" ON "Trade"("isDummy");
