import { NextRequest, NextResponse } from 'next/server';

const NEWS_API_KEY = process.env.NEWS_API_KEY || 'your_api_key_here';
const NEWS_API_URL = 'https://newsapi.org/v2/everything';

interface EventPayload {
  ticker?: string;
  title?: string;
  subtitle?: string;
  competition?: string;
}

function createSearchQuery(event: EventPayload): string {
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const events: EventPayload[] | undefined = body?.events;

    if (!events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'Events array is required' },
        { status: 400 }
      );
    }

    const newsPromises = events.map(async (event) => {
      try {
        const searchQuery = createSearchQuery(event);

        const params = new URLSearchParams({
          q: searchQuery,
          sortBy: 'publishedAt',
          language: 'en',
          pageSize: '5',
          apiKey: NEWS_API_KEY,
        });

        const response = await fetch(`${NEWS_API_URL}?${params.toString()}`);

        if (!response.ok) {
          const text = await response.text();
          console.error(
            'NewsAPI error for event',
            event.ticker,
            response.status,
            text
          );
          return {
            event: {
              ticker: event.ticker,
              title: event.title,
              subtitle: event.subtitle,
            },
            news: [],
            error: 'Failed to fetch news from provider',
          };
        }

        const data = await response.json();

        return {
          event: {
            ticker: event.ticker,
            title: event.title,
            subtitle: event.subtitle,
          },
          news: (data.articles || []).slice(0, 5).map((article: any) => ({
            title: article.title,
            description: article.description,
            url: article.url,
            source: article.source?.name,
            publishedAt: article.publishedAt,
          })),
          totalResults: data.totalResults,
        };
      } catch (error: any) {
        console.error('Error fetching news for event:', event, error);
        return {
          event: {
            ticker: event.ticker,
            title: event.title,
            subtitle: event.subtitle,
          },
          news: [],
          error: error?.message ?? 'Unknown error',
        };
      }
    });

    const results = await Promise.all(newsPromises);

    return NextResponse.json({
      results,
      count: results.length,
    });
  } catch (error: any) {
    console.error('Error fetching news (multiple events):', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch news',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 }
    );
  }
}


