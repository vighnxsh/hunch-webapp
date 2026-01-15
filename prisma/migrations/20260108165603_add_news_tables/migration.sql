-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "imageUrl" TEXT,
    "author" TEXT,
    "category" TEXT,
    "description" TEXT,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsMarketMatch" (
    "id" TEXT NOT NULL,
    "newsArticleId" TEXT NOT NULL,
    "eventTicker" TEXT,
    "marketTicker" TEXT,
    "relevanceScore" DOUBLE PRECISION NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsMarketMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_url_key" ON "NewsArticle"("url");

-- CreateIndex
CREATE INDEX "NewsArticle_publishedAt_idx" ON "NewsArticle"("publishedAt");

-- CreateIndex
CREATE INDEX "NewsArticle_source_idx" ON "NewsArticle"("source");

-- CreateIndex
CREATE INDEX "NewsArticle_category_idx" ON "NewsArticle"("category");

-- CreateIndex
CREATE INDEX "NewsArticle_createdAt_idx" ON "NewsArticle"("createdAt");

-- CreateIndex for vector similarity search (using HNSW for better performance)
CREATE INDEX "NewsArticle_embedding_idx" ON "NewsArticle" USING hnsw ("embedding" vector_cosine_ops);

-- CreateIndex
CREATE INDEX "NewsMarketMatch_newsArticleId_idx" ON "NewsMarketMatch"("newsArticleId");

-- CreateIndex
CREATE INDEX "NewsMarketMatch_eventTicker_idx" ON "NewsMarketMatch"("eventTicker");

-- CreateIndex
CREATE INDEX "NewsMarketMatch_marketTicker_idx" ON "NewsMarketMatch"("marketTicker");

-- CreateIndex
CREATE INDEX "NewsMarketMatch_relevanceScore_idx" ON "NewsMarketMatch"("relevanceScore");

-- CreateIndex
CREATE INDEX "NewsMarketMatch_matchedAt_idx" ON "NewsMarketMatch"("matchedAt");

-- AddForeignKey
ALTER TABLE "NewsMarketMatch" ADD CONSTRAINT "NewsMarketMatch_newsArticleId_fkey" FOREIGN KEY ("newsArticleId") REFERENCES "NewsArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

