import { prisma } from './db';

export interface NewsArticleInput {
  title: string;
  content: string;
  url: string;
  source: string;
  publishedAt: Date;
  imageUrl?: string;
  author?: string;
  category?: string;
  description?: string;
  embedding?: number[];
}

export interface NewsArticleWithMatches {
  id: string;
  title: string;
  content: string;
  url: string;
  source: string;
  publishedAt: Date;
  imageUrl: string | null;
  author: string | null;
  category: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  matches: Array<{
    id: string;
    eventTicker: string | null;
    marketTicker: string | null;
    relevanceScore: number;
    matchedAt: Date;
  }>;
}

/**
 * Create or update a news article
 */
export async function upsertNewsArticle(data: NewsArticleInput): Promise<string> {
  // Use raw SQL for pgvector support
  if (data.embedding) {
    const embeddingStr = `[${data.embedding.join(',')}]`;
    await prisma.$executeRawUnsafe(`
      INSERT INTO "NewsArticle" (
        id, title, content, url, source, "publishedAt", "imageUrl", 
        author, category, description, embedding, "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text,
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, NOW(), NOW()
      )
      ON CONFLICT (url) 
      DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        "imageUrl" = EXCLUDED."imageUrl",
        author = EXCLUDED.author,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        embedding = EXCLUDED.embedding,
        "updatedAt" = NOW()
    `, 
      data.title,
      data.content,
      data.url,
      data.source,
      data.publishedAt,
      data.imageUrl || null,
      data.author || null,
      data.category || null,
      data.description || null,
      embeddingStr
    );
  } else {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "NewsArticle" (
        id, title, content, url, source, "publishedAt", "imageUrl", 
        author, category, description, "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text,
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      )
      ON CONFLICT (url) 
      DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        "imageUrl" = EXCLUDED."imageUrl",
        author = EXCLUDED.author,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        "updatedAt" = NOW()
    `, 
      data.title,
      data.content,
      data.url,
      data.source,
      data.publishedAt,
      data.imageUrl || null,
      data.author || null,
      data.category || null,
      data.description || null
    );
  }

  // Get the ID from the result
  const article = await prisma.newsArticle.findUnique({
    where: { url: data.url },
    select: { id: true },
  });

  return article?.id || '';
}

/**
 * Get news article by ID
 */
export async function getNewsArticleById(id: string): Promise<NewsArticleWithMatches | null> {
  return prisma.newsArticle.findUnique({
    where: { id },
    include: {
      matches: {
        orderBy: { relevanceScore: 'desc' },
      },
    },
  }) as Promise<NewsArticleWithMatches | null>;
}

/**
 * Get news articles with pagination
 */
export async function getNewsArticles(options: {
  limit?: number;
  offset?: number;
  source?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const { limit = 50, offset = 0, source, category, startDate, endDate } = options;

  const where: any = {};
  if (source) where.source = source;
  if (category) where.category = category;
  if (startDate || endDate) {
    where.publishedAt = {};
    if (startDate) where.publishedAt.gte = startDate;
    if (endDate) where.publishedAt.lte = endDate;
  }

  const [articles, total] = await Promise.all([
    prisma.newsArticle.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        matches: {
          orderBy: { relevanceScore: 'desc' },
          take: 5, // Top 5 matches
        },
      },
    }),
    prisma.newsArticle.count({ where }),
  ]);

  return { articles, total, limit, offset };
}

/**
 * Create a news-market match
 */
export async function createNewsMatch(data: {
  newsArticleId: string;
  eventTicker?: string;
  marketTicker?: string;
  relevanceScore: number;
}) {
  return prisma.newsMarketMatch.create({
    data,
  });
}

/**
 * Delete old matches for an article and create new ones
 */
export async function replaceNewsMatches(
  newsArticleId: string,
  matches: Array<{
    eventTicker?: string;
    marketTicker?: string;
    relevanceScore: number;
  }>
) {
  // Delete existing matches
  await prisma.newsMarketMatch.deleteMany({
    where: { newsArticleId },
  });

  // Create new matches
  if (matches.length > 0) {
    await prisma.newsMarketMatch.createMany({
      data: matches.map((match) => ({
        newsArticleId,
        eventTicker: match.eventTicker || null,
        marketTicker: match.marketTicker || null,
        relevanceScore: match.relevanceScore,
      })),
    });
  }
}

/**
 * Get news articles for a specific event
 */
export async function getNewsForEvent(eventTicker: string, limit = 10) {
  const matches = await prisma.newsMarketMatch.findMany({
    where: { eventTicker },
    orderBy: { relevanceScore: 'desc' },
    take: limit,
    include: {
      newsArticle: true,
    },
  });

  return matches.map((match) => ({
    ...match.newsArticle,
    relevanceScore: match.relevanceScore,
  }));
}

/**
 * Get news articles for a specific market
 */
export async function getNewsForMarket(marketTicker: string, limit = 10) {
  const matches = await prisma.newsMarketMatch.findMany({
    where: { marketTicker },
    orderBy: { relevanceScore: 'desc' },
    take: limit,
    include: {
      newsArticle: true,
    },
  });

  return matches.map((match) => ({
    ...match.newsArticle,
    relevanceScore: match.relevanceScore,
  }));
}

/**
 * Check if article URL already exists
 */
export async function articleExists(url: string): Promise<boolean> {
  const count = await prisma.newsArticle.count({
    where: { url },
  });
  return count > 0;
}

/**
 * Get articles without embeddings
 */
export async function getArticlesWithoutEmbeddings(limit = 100) {
  return prisma.$queryRawUnsafe<Array<{ id: string; title: string; content: string }>>(`
    SELECT id, title, content
    FROM "NewsArticle"
    WHERE embedding IS NULL
    ORDER BY "publishedAt" DESC
    LIMIT $1
  `, limit);
}

/**
 * Update article embedding
 */
export async function updateArticleEmbedding(id: string, embedding: number[]) {
  const embeddingStr = `[${embedding.join(',')}]`;
  await prisma.$executeRawUnsafe(`
    UPDATE "NewsArticle"
    SET embedding = $1::vector, "updatedAt" = NOW()
    WHERE id = $2
  `, embeddingStr, id);
}

