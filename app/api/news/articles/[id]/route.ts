import { NextRequest, NextResponse } from 'next/server';
import { getNewsArticleById } from '@/app/lib/newsService';
import { rematchArticles } from '@/app/lib/newsMatcher';

/**
 * GET /api/news/articles/:id
 * Get a single news article with its matches
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const article = await getNewsArticleById(params.id);

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(article);
  } catch (error: any) {
    console.error('Error fetching news article:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch article' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/news/articles/:id/rematch
 * Manually trigger re-matching for an article
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await rematchArticles([params.id]);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      matched: result.matched,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('Error re-matching article:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to re-match article' },
      { status: 500 }
    );
  }
}

