import { RawNewsArticle } from './newsAggregator';
import { articleExists, upsertNewsArticle, NewsArticleInput } from './newsService';

/**
 * Clean and normalize article content
 */
export function cleanArticleContent(content: string): string {
  // Remove HTML tags
  let cleaned = content.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Truncate to reasonable length (8000 tokens ≈ 6000 words)
  const maxLength = 32000; // ~8000 tokens * 4 chars per token
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength) + '...';
  }
  
  return cleaned;
}

/**
 * Extract category from article (simple keyword-based)
 */
export function extractCategory(article: RawNewsArticle): string | undefined {
  const title = article.title.toLowerCase();
  const content = article.content.toLowerCase();
  const text = `${title} ${content}`;

  const categories: Record<string, string[]> = {
    crypto: ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'blockchain', 'defi', 'nft', 'solana', 'token'],
    politics: ['election', 'president', 'congress', 'senate', 'vote', 'government', 'trump', 'biden', 'democrat', 'republican'],
    sports: ['football', 'basketball', 'soccer', 'nfl', 'nba', 'mlb', 'nhl', 'tennis', 'golf', 'ufc', 'olympics'],
    tech: ['apple', 'google', 'microsoft', 'ai', 'artificial intelligence', 'tech', 'technology', 'software', 'startup'],
    finance: ['stock', 'market', 'trading', 'economy', 'inflation', 'fed', 'federal reserve', 'dollar', 'currency'],
    entertainment: ['movie', 'film', 'music', 'celebrity', 'awards', 'oscar', 'grammy', 'netflix', 'disney'],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return category;
    }
  }

  return undefined;
}

/**
 * Process and store news articles
 */
export async function processNewsArticles(
  articles: RawNewsArticle[],
  options: {
    skipDuplicates?: boolean;
    generateEmbeddings?: boolean;
  } = {}
): Promise<{ processed: number; skipped: number; errors: number }> {
  const { skipDuplicates = true, generateEmbeddings = false } = options;

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const article of articles) {
    try {
      // Check for duplicates
      if (skipDuplicates && (await articleExists(article.url))) {
        skipped++;
        continue;
      }

      // Clean content
      const cleanedContent = cleanArticleContent(article.content || article.description || '');
      
      if (!cleanedContent || cleanedContent.length < 50) {
        skipped++;
        continue; // Skip articles with too little content
      }

      // Extract category
      const category = extractCategory(article);

      // Prepare article data
      const articleData: NewsArticleInput = {
        title: article.title.trim(),
        content: cleanedContent,
        url: article.url,
        source: article.source,
        publishedAt: article.publishedAt,
        imageUrl: article.imageUrl,
        author: article.author,
        category,
        description: article.description ? cleanArticleContent(article.description) : undefined,
      };

      // Store article (embedding will be added later if needed)
      await upsertNewsArticle(articleData);
      processed++;
    } catch (error) {
      console.error(`Error processing article ${article.url}:`, error);
      errors++;
    }
  }

  return { processed, skipped, errors };
}

/**
 * Validate article before processing
 */
export function validateArticle(article: RawNewsArticle): boolean {
  return !!(
    article.title &&
    article.title.length > 10 &&
    article.url &&
    article.url.startsWith('http') &&
    article.source &&
    article.publishedAt
  );
}

