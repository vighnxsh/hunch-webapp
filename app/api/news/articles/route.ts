import { NextRequest, NextResponse } from 'next/server';
import { getNewsArticles } from '@/app/lib/newsService';

/**
 * GET /api/news/articles
 * List news articles with pagination and filtering
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const source = searchParams.get('source') || undefined;
    const category = searchParams.get('category') || undefined;
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    const result = await getNewsArticles({
      limit: Math.min(limit, 100), // Max 100 per page
      offset,
      source,
      category,
      startDate,
      endDate,
    });

    return NextResponse.json({
      articles: result.articles,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.offset + result.limit < result.total,
      },
    });
  } catch (error: any) {
    console.error('Error fetching news articles:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch news articles' },
      { status: 500 }
    );
  }
}

