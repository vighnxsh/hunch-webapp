import { NextRequest, NextResponse } from 'next/server';
import { processAndMatchArticles, rematchArticles } from '@/app/lib/newsMatcher';

/**
 * QStash cron job to match news articles to markets/events
 * Runs every 2 hours
 */
export async function POST(req: NextRequest) {
  try {
    // Verify QStash signature (optional but recommended)
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { rematch = false, articleIds } = body;

    console.log('[News Match Job] Starting matching process...', { rematch, articleIds });

    let result;

    if (rematch && articleIds && Array.isArray(articleIds)) {
      // Re-match specific articles
      result = await rematchArticles(articleIds);
      console.log(`[News Match Job] Re-matched ${articleIds.length} articles`);
    } else if (rematch) {
      // Re-match recent articles
      result = await rematchArticles();
      console.log('[News Match Job] Re-matched recent articles');
    } else {
      // Process new articles without embeddings
      result = await processAndMatchArticles(50); // Process 50 articles per run
      console.log('[News Match Job] Processed new articles');
    }

    console.log(`[News Match Job] Processed: ${result.processed}, Matched: ${result.matched}, Errors: ${result.errors}`);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      matched: result.matched,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[News Match Job] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to match news',
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

