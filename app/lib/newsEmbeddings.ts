import { OpenAIEmbeddings } from '@langchain/openai';
import redis from './redis';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY not configured - embeddings will not work');
}

// Initialize OpenAI embeddings with text-embedding-3-small model
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: OPENAI_API_KEY,
  modelName: 'text-embedding-3-small',
  dimensions: 1536,
});

/**
 * Generate embedding for text (with caching)
 */
export async function generateEmbedding(text: string, cacheKey?: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Check cache if key provided
  if (cacheKey) {
    const cached = await getCachedEmbedding(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    // Use LangChain embeddings
    const embedding = await embeddings.embedQuery(text);
    
    // Cache if key provided
    if (cacheKey) {
      await cacheEmbedding(cacheKey, embedding);
    }
    
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  try {
    // Batch embeddings for efficiency
    const result = await embeddings.embedDocuments(texts);
    return result;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

/**
 * Create text representation for news article
 */
export function createArticleText(article: {
  title: string;
  content: string;
  description?: string;
}): string {
  const parts = [article.title];
  
  if (article.description) {
    parts.push(article.description);
  }
  
  // Add first part of content (truncated)
  const contentPreview = article.content.substring(0, 2000);
  parts.push(contentPreview);
  
  return parts.join('\n\n');
}

/**
 * Create text representation for event
 */
export function createEventText(event: {
  ticker: string;
  title: string;
  subtitle?: string;
}): string {
  const parts = [event.title];
  
  if (event.subtitle) {
    parts.push(event.subtitle);
  }
  
  return parts.join(' - ');
}

/**
 * Create text representation for market
 */
export function createMarketText(market: {
  ticker: string;
  title: string;
  subtitle?: string;
  yesSubTitle?: string;
  noSubTitle?: string;
}): string {
  const parts = [market.title];
  
  if (market.subtitle) {
    parts.push(market.subtitle);
  }
  
  if (market.yesSubTitle) {
    parts.push(`Yes: ${market.yesSubTitle}`);
  }
  
  if (market.noSubTitle) {
    parts.push(`No: ${market.noSubTitle}`);
  }
  
  return parts.join(' - ');
}

/**
 * Cache embedding in Redis
 */
export async function cacheEmbedding(key: string, embedding: number[]): Promise<void> {
  try {
    await redis.setex(`embedding:${key}`, 86400 * 7, JSON.stringify(embedding)); // 7 days
  } catch (error) {
    console.error('Error caching embedding:', error);
  }
}

/**
 * Get cached embedding from Redis
 */
export async function getCachedEmbedding(key: string): Promise<number[] | null> {
  try {
    const cached = await redis.get<string>(`embedding:${key}`);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('Error getting cached embedding:', error);
    return null;
  }
}

