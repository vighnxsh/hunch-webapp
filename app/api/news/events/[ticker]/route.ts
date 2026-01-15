import { NextRequest, NextResponse } from 'next/server';
import { getNewsForEvent } from '@/app/lib/newsService';

/**
 * GET /api/news/events/:ticker
 * Get news articles for a specific event
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const articles = await getNewsForEvent(params.ticker, Math.min(limit, 50));

    return NextResponse.json({
      eventTicker: params.ticker,
      articles,
      count: articles.length,
    });
  } catch (error: any) {
    console.error('Error fetching news for event:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch news for event' },
      { status: 500 }
    );
  }
}

