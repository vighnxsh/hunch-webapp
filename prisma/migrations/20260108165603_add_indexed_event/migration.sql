-- CreateTable
CREATE TABLE IF NOT EXISTS "IndexedEvent" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndexedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IndexedEvent_ticker_key" ON "IndexedEvent"("ticker");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IndexedEvent_ticker_idx" ON "IndexedEvent"("ticker");

