'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchEvents, fetchTagsByCategories, Event, TagsByCategories } from '../lib/api';

// Define topic filters with icons and keywords for matching
const TOPIC_FILTERS = [
  { id: 'all', label: 'All', icon: '🌐', keywords: [] },
  { id: 'crypto', label: 'Crypto', icon: '₿', keywords: ['crypto', 'bitcoin', 'btc', 'eth', 'ethereum', 'solana', 'sol', 'token', 'defi', 'nft', 'blockchain', 'web3', 'memecoin', 'altcoin', 'stablecoin', 'usdc', 'usdt'] },
  { id: 'politics', label: 'Politics', icon: '🏛️', keywords: ['election', 'president', 'congress', 'senate', 'vote', 'government', 'trump', 'biden', 'democrat', 'republican', 'political', 'governor', 'mayor', 'impeach', 'cabinet', 'white house', 'electoral'] },
  { id: 'sports', label: 'Sports', icon: '⚽', keywords: ['football', 'basketball', 'soccer', 'nfl', 'nba', 'mlb', 'nhl', 'tennis', 'golf', 'ufc', 'mma', 'boxing', 'f1', 'formula 1', 'racing', 'olympics', 'world cup', 'championship', 'playoff', 'super bowl', 'world series', 'finals', 'mvp', 'team', 'player'] },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', keywords: ['movie', 'film', 'music', 'celebrity', 'awards', 'oscar', 'grammy', 'emmy', 'tv show', 'streaming', 'netflix', 'disney', 'spotify', 'concert', 'album', 'box office', 'actor', 'actress', 'singer', 'rapper'] },
  { id: 'tech', label: 'Tech', icon: '💻', keywords: ['ai ', ' ai', 'artificial intelligence', 'openai', 'chatgpt', 'gpt-', 'llm', 'machine learning', 'robotics', 'autonomous', 'iphone', 'android', 'software', 'app launch', 'product launch', 'tech company', 'silicon valley', 'semiconductor', 'chip', 'nvidia'] },
  { id: 'finance', label: 'Finance', icon: '📈', keywords: ['stock', 'fed ', 'federal reserve', 'interest rate', 'inflation', 'gdp', 'recession', 'economy', 'wall street', 's&p 500', 'nasdaq', 'dow jones', 'treasury', 'bond', 'yield', 'earnings', 'quarterly'] },
];

export default function EventsList() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [apiCategories, setApiCategories] = useState<TagsByCategories>({});

  // Fetch categories from API (for future use)
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

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch events with nested markets and filter by active status
        const data = await fetchEvents(200, {
          status: 'active',
          withNestedMarkets: true,
        });
        // Additional client-side filtering for safety
        const activeEvents = data.filter((event) => {
          // Check if event has markets and filter by market status
          if (event.markets && event.markets.length > 0) {
            // Keep event if it has at least one active market
            return event.markets.some(
              (market: any) =>
                market.status !== 'finalized' &&
                market.status !== 'resolved' &&
                market.status !== 'closed' &&
                market.status === 'active'
            );
          }
          // If no markets info, include the event (will be filtered when details load)
          return true;
        });
        setEvents(activeEvents);
        setFilteredEvents(activeEvents);
      } catch (err: any) {
        setError(err.message || 'Failed to load events');
        console.error('Error loading events:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  // Filter events when topic changes
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

  const handleTopicChange = (topicId: string) => {
    setSelectedTopic(topicId);
  };

  if (loading) {
    return (
      <div className="bg-[var(--surface)]/50 backdrop-blur-sm border border-[var(--border-color)] rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-6 text-[var(--text-primary)]">
          Events
        </h2>
        {/* Topic Filter Skeleton */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-10 w-24 bg-[var(--surface-hover)] rounded-full animate-pulse flex-shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-36 bg-[var(--surface-hover)] rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--surface)]/50 backdrop-blur-sm border border-[var(--border-color)] rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-6 text-[var(--text-primary)]">
          Events
        </h2>
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-[var(--surface)]/50 backdrop-blur-sm border border-[var(--border-color)] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">
            Events
          </h2>
          <span className="px-3 py-1 bg-fuchsia-500/20 text-fuchsia-400 text-sm font-medium rounded-lg border border-fuchsia-500/30">
            {filteredEvents.length} active
          </span>
        </div>

        {/* Topic Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {TOPIC_FILTERS.map((topic) => (
            <button
              key={topic.id}
              onClick={() => handleTopicChange(topic.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all duration-200 flex-shrink-0 ${
                selectedTopic === topic.id
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                  : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-color)]'
              }`}
            >
              <span className="text-base">{topic.icon}</span>
              <span>{topic.label}</span>
              {selectedTopic === topic.id && topic.id !== 'all' && (
                <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                  {filteredEvents.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-[var(--surface-hover)] rounded-2xl flex items-center justify-center">
                <span className="text-3xl">
                  {TOPIC_FILTERS.find(t => t.id === selectedTopic)?.icon || '🔍'}
                </span>
              </div>
              <p className="text-[var(--text-tertiary)] mb-2">
                No {selectedTopic !== 'all' ? TOPIC_FILTERS.find(t => t.id === selectedTopic)?.label : ''} events found
              </p>
              {selectedTopic !== 'all' && (
                <button
                  onClick={() => setSelectedTopic('all')}
                  className="text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors"
                >
                  View all events →
                </button>
              )}
            </div>
          ) : (
            filteredEvents.map((event, index) => (
              <div
                key={event.ticker || index}
                onClick={() => handleEventClick(event.ticker)}
                className="group p-5 bg-[var(--card-bg)]/30 border border-[var(--border-color)] rounded-xl hover:border-violet-500/50 hover:bg-[var(--surface-hover)] transition-all duration-300 cursor-pointer"
              >
                <div className="mb-3">
                  <p className="text-xs font-mono text-[var(--text-tertiary)] mb-2">
                    {event.ticker}
                  </p>
                  <h3 className="font-semibold text-lg text-[var(--text-primary)] mb-2 group-hover:text-violet-400 transition-colors">
                    {event.title || 'Untitled Event'}
                  </h3>
                  {event.subtitle && (
                    <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                      {event.subtitle}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-color)]">
                  <span className="text-xs text-[var(--text-tertiary)] group-hover:text-violet-400 transition-colors">
                    Click to view details
                  </span>
                  <svg className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-violet-400 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
