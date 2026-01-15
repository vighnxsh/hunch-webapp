import { fetchEvents, Event, Market } from './api';
import { 
  createEventText, 
  createMarketText, 
  generateEmbedding,
  getCachedEmbedding,
  cacheEmbedding,
  createArticleText,
} from './newsEmbeddings';
import { 
  getArticlesWithoutEmbeddings, 
  updateArticleEmbedding,
  replaceNewsMatches,
  getNewsArticles,
} from './newsService';
import { prisma } from './db';

const SIMILARITY_THRESHOLD = 0.7;
const MAX_MATCHES_PER_ARTICLE = 10;

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Get or generate embedding for event
 */
async function getEventEmbedding(event: Event): Promise<number[]> {
  const cacheKey = `event:${event.ticker}`;
  
  // Try cache first
  let embedding = await getCachedEmbedding(cacheKey);
  
  if (!embedding) {
    // Generate embedding
    const eventText = createEventText(event);
    embedding = await generateEmbedding(eventText);
    
    // Cache it
    await cacheEmbedding(cacheKey, embedding);
  }
  
  return embedding;
}

/**
 * Get or generate embedding for market
 */
async function getMarketEmbedding(market: Market): Promise<number[]> {
  const cacheKey = `market:${market.ticker}`;
  
  // Try cache first
  let embedding = await getCachedEmbedding(cacheKey);
  
  if (!embedding) {
    // Generate embedding
    const marketText = createMarketText(market);
    embedding = await generateEmbedding(marketText);
    
    // Cache it
    await cacheEmbedding(cacheKey, embedding);
  }
  
  return embedding;
}

/**
 * Match article to events and markets using vector similarity
 */
export async function matchArticleToMarkets(
  articleId: string,
  articleEmbedding: number[]
): Promise<{ eventTicker?: string; marketTicker?: string; relevanceScore: number }[]> {
  try {
    // Fetch all active events with markets
    const eventsResponse = await fetchEvents(500, {
      status: 'active',
      withNestedMarkets: true,
    });

    const allMatches: Array<{
      eventTicker?: string;
      marketTicker?: string;
      relevanceScore: number;
    }> = [];

    // Match against events
    for (const event of eventsResponse.events || []) {
      try {
        const eventEmbedding = await getEventEmbedding(event);
        const similarity = cosineSimilarity(articleEmbedding, eventEmbedding);

        if (similarity >= SIMILARITY_THRESHOLD) {
          allMatches.push({
            eventTicker: event.ticker,
            relevanceScore: similarity,
          });
        }

        // Also match against individual markets in the event
        if (event.markets && event.markets.length > 0) {
          for (const market of event.markets) {
            if (market.status === 'active') {
              try {
                const marketEmbedding = await getMarketEmbedding(market);
                const marketSimilarity = cosineSimilarity(articleEmbedding, marketEmbedding);

                if (marketSimilarity >= SIMILARITY_THRESHOLD) {
                  allMatches.push({
                    eventTicker: event.ticker,
                    marketTicker: market.ticker,
                    relevanceScore: marketSimilarity,
                  });
                }
              } catch (error) {
                console.error(`Error matching market ${market.ticker}:`, error);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error matching event ${event.ticker}:`, error);
      }
    }

    // Sort by relevance score and take top matches
    allMatches.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return allMatches.slice(0, MAX_MATCHES_PER_ARTICLE);
  } catch (error) {
    console.error('Error matching article to markets:', error);
    return [];
  }
}

/**
 * Process articles without embeddings and match them
 */
export async function processAndMatchArticles(limit = 50): Promise<{
  processed: number;
  matched: number;
  errors: number;
}> {
  let processed = 0;
  let matched = 0;
  let errors = 0;

  try {
    // Get articles without embeddings
    const articles = await getArticlesWithoutEmbeddings(limit);

    for (const article of articles) {
      try {
        // Generate embedding for article
        const articleText = createArticleText({
          title: article.title,
          content: article.content,
        });
        
        const embedding = await generateEmbedding(articleText);
        
        // Update article with embedding
        await updateArticleEmbedding(article.id, embedding);
        processed++;

        // Match to markets
        const matches = await matchArticleToMarkets(article.id, embedding);
        
        if (matches.length > 0) {
          await replaceNewsMatches(article.id, matches);
          matched++;
        }
      } catch (error) {
        console.error(`Error processing article ${article.id}:`, error);
        errors++;
      }
    }
  } catch (error) {
    console.error('Error processing articles:', error);
    errors++;
  }

  return { processed, matched, errors };
}

/**
 * Re-match existing articles (for when new markets are added)
 */
export async function rematchArticles(articleIds?: string[]): Promise<{
  processed: number;
  matched: number;
  errors: number;
}> {
  let processed = 0;
  let matched = 0;
  let errors = 0;

  try {
    let articles;
    
    if (articleIds && articleIds.length > 0) {
      // Get specific articles
      articles = await Promise.all(
        articleIds.map(async (id) => {
          const article = await prisma.newsArticle.findUnique({
            where: { id },
            select: { id: true, title: true, content: true },
          });
          return article;
        })
      );
      articles = articles.filter((a) => a !== null) as Array<{ id: string; title: string; content: string }>;
    } else {
      // Get recent articles (last 100)
      const result = await getNewsArticles({ limit: 100 });
      articles = result.articles.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
      }));
    }

    for (const article of articles) {
      try {
        // Get embedding from database
        const articleWithEmbedding = await prisma.$queryRawUnsafe<Array<{ embedding: number[] }>>(
          `SELECT embedding FROM "NewsArticle" WHERE id = $1`,
          article.id
        );

        if (!articleWithEmbedding[0]?.embedding) {
          // Generate embedding if missing
          const articleText = createArticleText({
            title: article.title,
            content: article.content,
          });
          const embedding = await generateEmbedding(articleText);
          await updateArticleEmbedding(article.id, embedding);

          // Match to markets
          const matches = await matchArticleToMarkets(article.id, embedding);
          if (matches.length > 0) {
            await replaceNewsMatches(article.id, matches);
            matched++;
          }
        } else {
          // Use existing embedding
          const embedding = articleWithEmbedding[0].embedding;
          const matches = await matchArticleToMarkets(article.id, embedding);
          if (matches.length > 0) {
            await replaceNewsMatches(article.id, matches);
            matched++;
          }
        }

        processed++;
      } catch (error) {
        console.error(`Error re-matching article ${article.id}:`, error);
        errors++;
      }
    }
  } catch (error) {
    console.error('Error re-matching articles:', error);
    errors++;
  }

  return { processed, matched, errors };
}

