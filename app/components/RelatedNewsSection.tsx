'use client';

import { useState, useEffect } from 'react';
import NewsArticleCard from './NewsArticleCard';

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  url: string;
  source: string;
  publishedAt: Date;
  imageUrl: string | null;
  author: string | null;
  category: string | null;
  description: string | null;
  relevanceScore?: number;
}

interface RelatedNewsSectionProps {
  eventTicker?: string;
  marketTicker?: string;
  limit?: number;
  title?: string;
}

export default function RelatedNewsSection({
  eventTicker,
  marketTicker,
  limit = 5,
  title = 'Related News',
}: RelatedNewsSectionProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        setError(null);

        let url = '';
        if (marketTicker) {
          url = `/api/news/markets/${encodeURIComponent(marketTicker)}?limit=${limit}`;
        } else if (eventTicker) {
          url = `/api/news/events/${encodeURIComponent(eventTicker)}?limit=${limit}`;
        } else {
          setLoading(false);
          return;
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch news');
        }

        const data = await response.json();
        setArticles(data.articles || []);
      } catch (err: any) {
        console.error('Error fetching related news:', err);
        setError(err.message || 'Failed to load news');
      } finally {
        setLoading(false);
      }
    };

    if (eventTicker || marketTicker) {
      fetchNews();
    }
  }, [eventTicker, marketTicker, limit]);

  if (loading) {
    return (
      <div className="mt-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">{title}</h2>
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">{title}</h2>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return null; // Don't show section if no news
  }

  return (
    <div className="mt-6">
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">{title}</h2>
      <div className="space-y-4">
        {articles.map((article) => (
          <NewsArticleCard
            key={article.id}
            article={article}
            showMatches={false}
            compact={true}
          />
        ))}
      </div>
    </div>
  );
}

