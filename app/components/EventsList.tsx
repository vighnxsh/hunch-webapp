'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchEvents, fetchTagsByCategories, Event, TagsByCategories } from '../lib/api';

// Topic filters with gradient colors
const TOPIC_FILTERS = [
  { id: 'all', label: 'All', icon: '🌐', keywords: [], color: 'cyan' },
  { id: 'crypto', label: 'Crypto', icon: '₿', keywords: ['crypto', 'bitcoin', 'btc', 'eth', 'ethereum', 'solana', 'sol', 'token', 'defi', 'nft', 'blockchain', 'web3', 'memecoin', 'altcoin', 'stablecoin', 'usdc', 'usdt'], color: 'orange' },
  { id: 'politics', label: 'Politics', icon: '🏛️', keywords: ['election', 'president', 'congress', 'senate', 'vote', 'government', 'trump', 'biden', 'democrat', 'republican', 'political', 'governor', 'mayor', 'impeach', 'cabinet', 'white house', 'electoral'], color: 'blue' },
  { id: 'sports', label: 'Sports', icon: '⚽', keywords: ['football', 'basketball', 'soccer', 'nfl', 'nba', 'mlb', 'nhl', 'tennis', 'golf', 'ufc', 'mma', 'boxing', 'f1', 'formula 1', 'racing', 'olympics', 'world cup', 'championship', 'playoff', 'super bowl', 'world series', 'finals', 'mvp', 'team', 'player'], color: 'green' },
  { id: 'entertainment', label: 'Fun', icon: '🎬', keywords: ['movie', 'film', 'music', 'celebrity', 'awards', 'oscar', 'grammy', 'emmy', 'tv show', 'streaming', 'netflix', 'disney', 'spotify', 'concert', 'album', 'box office', 'actor', 'actress', 'singer', 'rapper'], color: 'pink' },
  { id: 'tech', label: 'Tech', icon: '💻', keywords: ['ai ', ' ai', 'artificial intelligence', 'openai', 'chatgpt', 'gpt-', 'llm', 'machine learning', 'robotics', 'autonomous', 'iphone', 'android', 'software', 'app launch', 'product launch', 'tech company', 'silicon valley', 'semiconductor', 'chip', 'nvidia'], color: 'indigo' },
  { id: 'finance', label: 'Finance', icon: '📈', keywords: ['stock', 'fed ', 'federal reserve', 'interest rate', 'inflation', 'gdp', 'recession', 'economy', 'wall street', 's&p 500', 'nasdaq', 'dow jones', 'treasury', 'bond', 'yield', 'earnings', 'quarterly'], color: 'teal' },
];

const EVENTS_PER_PAGE = 20;

// Format helpers for the card UI
const formatPercent = (value?: string | number) => {
  if (value === undefined || value === null) return '—';
  const numeric = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(numeric)) return '—';
  return `${Math.round(numeric * 100)}%`;
};

const formatVolume = (value?: number) => {
  if (!value || Number.isNaN(value)) return '$—';
  return `$${Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)}`;
};

// Event Card Component with layout matching the provided design
function EventCard({ event, onClick }: { event: Event; onClick: () => void }) {
  // Filter active markets and sort by chance (yesBid) descending, then take top 2
  const hotMarkets = (event.markets || [])
    .filter((m: any) => 
      m.status !== 'finalized' && 
      m.status !== 'resolved' && 
      m.status !== 'closed'
    )
    .sort((a: any, b: any) => {
      const aChance = a.yesBid ? parseFloat(a.yesBid) : 0;
      const bChance = b.yesBid ? parseFloat(b.yesBid) : 0;
      return bChance - aChance; // Descending order - highest chance first
    })
    .slice(0, 2);

  return (
    <div
      onClick={onClick}
      className="group flex flex-col gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex-shrink-0 border border-[var(--border)]">
          {event.imageUrl ? (
            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl">📊</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--text-primary)] leading-snug text-[16px] group-hover:text-green-500 transition-colors line-clamp-2">
            {event.title || 'Untitled Event'}
          </h3>
          {event.subtitle && (
            <p className="text-[13px] text-[var(--text-tertiary)] line-clamp-2 mt-1">
              {event.subtitle}
            </p>
          )}
        </div>
      </div>

      {hotMarkets.length > 0 && (
        <div className="space-y-3">
          {hotMarkets.map((market: any, idx: number) => {
            const label =
              market.yesSubTitle ||
              market.noSubTitle ||
              market.subtitle ||
              market.title ||
              `Option ${idx + 1}`;
            const yesPercent = formatPercent(market.yesAsk ?? market.yesBid);

            return (
              <div
                key={market.ticker || idx}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-2xl bg-[var(--surface-hover)]"
              >
                <span className="text-sm text-[var(--text-primary)] truncate">{label}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xl font-semibold text-[var(--text-primary)]">
                    {yesPercent}
                  </span>
                  <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-green-400 shadow-sm">
                    Yes 
                  </span>
                  <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-red-500 text-white shadow-sm">
                    No
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hotMarkets.length === 0 && event.subtitle && (
        <div className="px-3 py-2 rounded-2xl bg-[var(--surface-hover)] text-sm text-[var(--text-secondary)]">
          {event.subtitle}
        </div>
      )}

      <div className="flex items-center text-xs text-[var(--text-tertiary)] pt-1">
        <span>{formatVolume(event.volume ?? event.volume24h ?? event.openInterest)}</span>
      </div>
    </div>
  );
}


export default function EventsList() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [apiCategories, setApiCategories] = useState<TagsByCategories>({});
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categories = await fetchTagsByCategories();
        setApiCategories(categories);
      } catch (err) {
        console.error('Error loading categories:', err);
      }
    };
    loadCategories();
  }, []);

  const filterActiveEvents = (eventsList: Event[]) => {
    return eventsList.filter((event) => {
      if (event.markets && event.markets.length > 0) {
        return event.markets.some(
          (market: any) =>
            market.status !== 'finalized' &&
            market.status !== 'resolved' &&
            market.status !== 'closed' &&
            market.status === 'active'
        );
      }
      return true;
    });
  };

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchEvents(EVENTS_PER_PAGE, {
          status: 'active',
          withNestedMarkets: true,
        });

        const activeEvents = filterActiveEvents(response.events || []);
        setEvents(activeEvents);
        setFilteredEvents(activeEvents);
        setCursor(response.cursor);
        setHasMore(!!response.cursor);
      } catch (err: any) {
        setError(err.message || 'Failed to load events');
        console.error('Error loading events:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  const loadMoreEvents = useCallback(async () => {
    if (!cursor || loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const response = await fetchEvents(EVENTS_PER_PAGE, {
        status: 'active',
        withNestedMarkets: true,
        cursor,
      });

      const activeEvents = filterActiveEvents(response.events || []);
      setEvents(prev => [...prev, ...activeEvents]);
      setCursor(response.cursor);
      setHasMore(!!response.cursor);
    } catch (err: any) {
      console.error('Error loading more events:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, hasMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMoreEvents();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loadingMore, loadMoreEvents]);

  useEffect(() => {
    if (selectedTopic === 'all') {
      setFilteredEvents(events);
      return;
    }

    const topic = TOPIC_FILTERS.find(t => t.id === selectedTopic);
    if (!topic || topic.keywords.length === 0) {
      setFilteredEvents(events);
      return;
    }

    const filtered = events.filter(event => {
      const searchText = `${event.title || ''} ${event.subtitle || ''} ${event.ticker || ''}`.toLowerCase();
      return topic.keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
    });

    setFilteredEvents(filtered);
  }, [selectedTopic, events]);

  const handleEventClick = (eventTicker: string) => {
    router.push(`/event/${encodeURIComponent(eventTicker)}`);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        {/* Filter skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-9 w-20 bg-[var(--surface)] rounded-full animate-pulse flex-shrink-0" />
          ))}
        </div>

        {/* Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-36 bg-[var(--surface)] rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-14 h-14 mb-4 bg-red-500/10 rounded-2xl flex items-center justify-center">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-[var(--text-secondary)] text-sm mb-3">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-xl"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters - Horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {TOPIC_FILTERS.map((topic) => {
          const isSelected = selectedTopic === topic.id;
          return (
            <button
              key={topic.id}
              onClick={() => setSelectedTopic(topic.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 flex-shrink-0 ${isSelected
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/25'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
            >
              <span className="text-sm">{topic.icon}</span>
              <span>{topic.label}</span>
              {isSelected && filteredEvents.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 bg-white/20 rounded-full text-[10px] font-bold">
                  {filteredEvents.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Events Grid - 1 col mobile, 2 cols tablet, 3 cols desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEvents.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-[var(--surface)] flex items-center justify-center">
              <span className="text-3xl">{TOPIC_FILTERS.find(t => t.id === selectedTopic)?.icon || '🔍'}</span>
            </div>
            <p className="text-[var(--text-secondary)] text-sm mb-3">No events found</p>
            {selectedTopic !== 'all' && (
              <button
                onClick={() => setSelectedTopic('all')}
                className="text-cyan-400 text-sm font-medium"
              >
                View all →
              </button>
            )}
          </div>
        ) : (
          filteredEvents.map((event, index) => (
            <EventCard
              key={event.ticker || index}
              event={event}
              onClick={() => handleEventClick(event.ticker)}
            />
          ))
        )}
      </div>

      {/* Infinite scroll trigger */}
      {hasMore && (
        <div ref={observerTarget} className="flex justify-center py-6">
          {loadingMore && (
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      )}

      {/* End indicator */}
      {!hasMore && events.length > 0 && (
        <p className="text-center text-xs text-[var(--text-tertiary)] py-4">
          That's all for now
        </p>
      )}
    </div>
  );
}
