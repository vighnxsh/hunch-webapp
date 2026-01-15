import { NextRequest, NextResponse } from 'next/server';
import { getNewsForMarket } from '@/app/lib/newsService';

/**
 * GET /api/news/markets/:ticker
 * Get news articles for a specific market
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const articles = await getNewsForMarket(params.ticker, Math.min(limit, 50));

    return NextResponse.json({
      marketTicker: params.ticker,
      articles,
      count: articles.length,
    });
  } catch (error: any) {
    console.error('Error fetching news for market:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch news for market' },
      { status: 500 }
    );
  }
}

