'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchEvents, Event } from '../lib/api';
import NewsArticleCard from '../components/NewsArticleCard';

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  url: string;
  source: string;
  publishedAt: Date | string;
  imageUrl: string | null;
  author: string | null;
  category: string | null;
  description: string | null;
  matches?: Array<{
    id: string;
    eventTicker: string | null;
    marketTicker: string | null;
    relevanceScore: number;
    matchedAt: Date | string;
  }>;
}

export default function NewsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ticker = searchParams.get('ticker');
  
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingNews, setLoadingNews] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState<number | null>(null);

  // Load events on mount
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        const response = await fetchEvents(50, {
          status: 'active',
          withNestedMarkets: true,
        });

        const activeEvents = (response.events || []).filter((event) => {
          if (event.markets && event.markets.length > 0) {
            return event.markets.some(
              (market: any) => market.status === 'active'
            );
          }
          return true;
        });

        setEvents(activeEvents);

        // If ticker is in URL, find and select that event
        if (ticker) {
          const event = activeEvents.find((e) => e.ticker === ticker);
          if (event) {
            setSelectedEvent(event);
            loadNewsForEvent(event);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load events');
        console.error('Error loading events:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [ticker]);

  const loadNewsForEvent = async (event: Event) => {
    try {
      setLoadingNews(true);
      setError(null);

      const response = await fetch(`/api/news/events/${encodeURIComponent(event.ticker)}?limit=20`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch news');
      }

      const data = await response.json();
      setNews(data.articles || []);
      setTotalResults(data.count || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load news');
      console.error('Error loading news:', err);
      setNews([]);
    } finally {
      setLoadingNews(false);
    }
  };

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    router.push(`/news?ticker=${encodeURIComponent(event.ticker)}`);
    loadNewsForEvent(event);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--text-secondary)] text-sm">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            News Feed
          </h1>
          <p className="text-[var(--text-secondary)]">
            Stay updated with the latest news for prediction markets
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Events Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-6">
              <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border)] p-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                  Select Event
                </h2>
                <div className="space-y-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
                  {events.map((event) => (
                    <button
                      key={event.ticker}
                      onClick={() => handleEventSelect(event)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedEvent?.ticker === event.ticker
                          ? 'bg-yellow-500/20 border border-yellow-500/50'
                          : 'bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--hover-background)]'
                      }`}
                    >
                      <h3 className="font-medium text-[var(--text-primary)] text-sm line-clamp-2 mb-1">
                        {event.title}
                      </h3>
                      {event.subtitle && (
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-1">
                          {event.subtitle}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* News Content */}
          <section className="lg:col-span-2">
            {!selectedEvent ? (
              <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border)] p-8 text-center">
                <p className="text-[var(--text-secondary)]">
                  Select an event from the sidebar to view related news
                </p>
              </div>
            ) : (
              <div>
                {/* Selected Event Header */}
                <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border)] p-6 mb-6">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                    {selectedEvent.title}
                  </h2>
                  {selectedEvent.subtitle && (
                    <p className="text-[var(--text-secondary)] mb-4">
                      {selectedEvent.subtitle}
                    </p>
                  )}
                  {totalResults !== null && (
                    <p className="text-sm text-[var(--text-secondary)]">
                      Found {totalResults} article{totalResults !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Loading News */}
                {loadingNews && (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-[var(--text-secondary)] text-sm">
                        Loading news...
                      </p>
                    </div>
                  </div>
                )}

                {/* News Articles */}
                {!loadingNews && news.length === 0 && (
                  <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border)] p-8 text-center">
                    <p className="text-[var(--text-secondary)]">
                      No news articles found for this event.
                    </p>
                  </div>
                )}

                {!loadingNews && news.length > 0 && (
                  <div className="space-y-4">
                    {news.map((article) => (
                      <NewsArticleCard
                        key={article.id}
                        article={article}
                        showMatches={true}
                        compact={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

