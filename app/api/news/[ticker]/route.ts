import { NextRequest, NextResponse } from 'next/server';

const NEWS_API_KEY = process.env.NEWS_API_KEY || 'your_api_key_here';
const NEWS_API_URL = 'https://newsapi.org/v2/everything';

interface EventQuery {
  title?: string | null;
  subtitle?: string | null;
  competition?: string | null;
}

function createSearchQuery(event: {
  title?: string | null;
  subtitle?: string | null;
  competition?: string | null;
}): string {
  const parts: string[] = [];

  if (event.title) {
    parts.push(event.title.replace(/\?/g, ''));
  }

  if (event.competition) {
    parts.push(event.competition);
  }

  if (event.subtitle) {
    const cleanSubtitle = event.subtitle
      .replace(/In \d{4}|On .+\d{4}/g, '')
      .trim();
    if (cleanSubtitle) parts.push(cleanSubtitle);
  }

  return parts.join(' ');
}

export async function GET(
  req: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const { ticker } = params;
    const { searchParams } = new URL(req.url);

    const query: EventQuery = {
      title: searchParams.get('title'),
      subtitle: searchParams.get('subtitle'),
      competition: searchParams.get('competition'),
    };

    if (!query.title) {
      return NextResponse.json(
        { error: 'Title query parameter is required' },
        { status: 400 }
      );
    }

    const searchQuery = createSearchQuery({
      title: query.title,
      subtitle: query.subtitle,
      competition: query.competition,
    });

    const paramsSearch = new URLSearchParams({
      q: searchQuery,
      sortBy: 'publishedAt',
      language: 'en',
      pageSize: '10',
      apiKey: NEWS_API_KEY,
    });

    const response = await fetch(
      `${NEWS_API_URL}?${paramsSearch.toString()}`
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('NewsAPI error response:', response.status, text);
      return NextResponse.json(
        { error: 'Failed to fetch news from provider' },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      ticker,
      title: query.title,
      news: (data.articles || []).map((article: any) => ({
        title: article.title,
        description: article.description,
        url: article.url,
        source: article.source?.name,
        publishedAt: article.publishedAt,
        urlToImage: article.urlToImage,
      })),
      totalResults: data.totalResults,
    });
  } catch (error: any) {
    console.error('Error fetching news (by ticker):', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch news',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 }
    );
  }
}


