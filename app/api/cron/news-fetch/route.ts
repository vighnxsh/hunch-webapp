import { NextRequest, NextResponse } from 'next/server';
import { aggregateNews, getCustomRSSFeeds } from '@/app/lib/newsAggregator';
import { processNewsArticles, validateArticle } from '@/app/lib/newsProcessor';

/**
 * QStash cron job to fetch news from all sources
 * Runs every 3 hours
 */
export async function POST(req: NextRequest) {
  try {
    // Verify QStash signature (optional but recommended)
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[News Fetch Job] Starting news aggregation...');

    // Get custom RSS feeds from environment
    const customFeeds = getCustomRSSFeeds();

    // Aggregate news from all sources
    const rawArticles = await aggregateNews({
      limit: 200, // Fetch up to 200 articles per run
      sources: customFeeds.length > 0 ? customFeeds : undefined,
    });

    console.log(`[News Fetch Job] Fetched ${rawArticles.length} articles from sources`);

    // Filter and validate articles
    const validArticles = rawArticles.filter(validateArticle);

    console.log(`[News Fetch Job] ${validArticles.length} valid articles after filtering`);

    // Process and store articles
    const result = await processNewsArticles(validArticles, {
      skipDuplicates: true,
      generateEmbeddings: false, // Embeddings will be generated in matching job
    });

    console.log(`[News Fetch Job] Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors}`);

    return NextResponse.json({
      success: true,
      fetched: rawArticles.length,
      valid: validArticles.length,
      processed: result.processed,
      skipped: result.skipped,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[News Fetch Job] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch news',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Allow GET for manual testing
export async function GET(req: NextRequest) {
  return POST(req);
}

