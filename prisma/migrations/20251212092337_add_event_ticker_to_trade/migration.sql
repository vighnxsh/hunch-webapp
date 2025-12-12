-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "eventTicker" TEXT;

-- CreateIndex
CREATE INDEX "Trade_eventTicker_idx" ON "Trade"("eventTicker");
