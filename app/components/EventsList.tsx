'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { fetchEvents, fetchTagsByCategories, Event, TagsByCategories, Market } from '../lib/api';
import TradeMarket from './TradeMarket';

// Topic filters with gradient colors
const TOPIC_FILTERS = [
  { id: 'all', label: 'All', keywords: [], color: 'cyan' },
  { id: 'crypto', label: 'Crypto', keywords: ['crypto', 'bitcoin', 'btc', 'eth', 'ethereum', 'solana', 'sol', 'token', 'defi', 'nft', 'blockchain', 'web3', 'memecoin', 'altcoin', 'stablecoin', 'usdc', 'usdt'], color: 'orange' },
  { id: 'politics', label: 'Politics', keywords: ['election', 'president', 'congress', 'senate', 'vote', 'government', 'trump', 'biden', 'democrat', 'republican', 'political', 'governor', 'mayor', 'impeach', 'cabinet', 'white house', 'electoral'], color: 'blue' },
  { id: 'sports', label: 'Sports', keywords: ['football', 'basketball', 'soccer', 'nfl', 'nba', 'mlb', 'nhl', 'tennis', 'golf', 'ufc', 'mma', 'boxing', 'f1', 'formula 1', 'racing', 'olympics', 'world cup', 'championship', 'playoff', 'super bowl', 'world series', 'finals', 'mvp', 'team', 'player'], color: 'green' },
  { id: 'entertainment', label: 'Fun', keywords: ['movie', 'film', 'music', 'celebrity', 'awards', 'oscar', 'grammy', 'emmy', 'tv show', 'streaming', 'netflix', 'disney', 'spotify', 'concert', 'album', 'box office', 'actor', 'actress', 'singer', 'rapper'], color: 'pink' },
  { id: 'tech', label: 'Tech', keywords: ['ai ', ' ai', 'artificial intelligence', 'openai', 'chatgpt', 'gpt-', 'llm', 'machine learning', 'robotics', 'autonomous', 'iphone', 'android', 'software', 'app launch', 'product launch', 'tech company', 'silicon valley', 'semiconductor', 'chip', 'nvidia'], color: 'indigo' },
  { id: 'finance', label: 'Finance', keywords: ['stock', 'fed ', 'federal reserve', 'interest rate', 'inflation', 'gdp', 'recession', 'economy', 'wall street', 's&p 500', 'nasdaq', 'dow jones', 'treasury', 'bond', 'yield', 'earnings', 'quarterly'], color: 'teal' },
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
function EventCard({
  event,
  onClick,
  onOpenTrade,
  isMobile,
}: {
  event: Event;
  onClick: () => void;
  onOpenTrade: (market: Market, side: 'yes' | 'no', event: Event) => void;
  isMobile: boolean;
}) {
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);

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

  // Calculate potential return for a $100 investment
  const calculateReturn = (price: string | undefined, investment: number = 100): number | null => {
    if (!price) return null;
    const priceNum = parseFloat(price);
    if (priceNum <= 0 || Number.isNaN(priceNum)) return null;
    return investment / priceNum;
  };

  const handleMarketButtonClick = (
    e: React.MouseEvent,
    market: any,
    side: 'yes' | 'no',
    key: string
  ) => {
    e.stopPropagation(); // Prevent card click

    // On mobile: skip in-card popup and open bottom drawer directly
    if (isMobile) {
      onOpenTrade(market as Market, side, event);
      return;
    }

    // On larger screens: toggle in-card popup
    setExpandedMarket(expandedMarket === key ? null : key);
  };

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col gap-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* Header (image + title) – always visible */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex-shrink-0">
          {event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl">
              📊
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--text-primary)] leading-snug text-xl sm:text-xl group-hover:text-cyan-500 transition-colors line-clamp-2">
            {event.title || 'Untitled Event'} 
          </h3>
        </div>
      </div>

      {/* Markets + footer – fade when a market is expanded */}
      <div
        className={
          expandedMarket ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }
      >
        {hotMarkets.length > 0 && (
          <div className="space-y-3 mt-3">
            {hotMarkets.map((market: any, idx: number) => {
              const label =
                market.yesSubTitle ||
                market.noSubTitle ||
                market.subtitle ||
                market.title ||
                `Option ${idx + 1}`;
              const yesPercent = formatPercent(market.yesAsk ?? market.yesBid);
              const key = market.ticker || idx.toString();
              const yesPrice = market.yesAsk
                ? parseFloat(market.yesAsk)
                : market.yesBid
                  ? parseFloat(market.yesBid)
                  : null;

              return (
                <div
                  key={key}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTrade(market as Market, 'yes', event);
                  }}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-2xl bg-[var(--surface)] cursor-pointer"
                >
                  <span className="text-xl text-[var(--text-primary)] truncate">
                    {label}
                  </span>
                  <div
                    className={`flex items-center gap-2 flex-shrink-0 ${isMobile ? 'cursor-pointer' : ''}`}
                    onClick={
                      isMobile
                        ? (e) => {
                            e.stopPropagation();
                            onOpenTrade(market as Market, 'yes', event);
                          }
                        : undefined
                    }
                  >
                    <span className="text-xl font-semibold text-[var(--text-primary)] font-number">
                      {yesPercent}
                    </span>
                    {yesPrice !== null && yesPrice < 1 && (
                      <svg
                        className="w-3 h-3 text-[var(--text-tertiary)]"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    {!isMobile && (
                      <>
                        <button
                          onClick={(e) => handleMarketButtonClick(e, market, 'yes', key)}
                          className="font-semibold px-3 py-1 text-md rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-300 text-black hover:bg-cyan-300 transition-colors shadow-sm"
                        >
                          Yes
                        </button>
                        <button
                          onClick={(e) => handleMarketButtonClick(e, market, 'no', key)}
                          className="text-md font-semibold px-3 py-1 rounded-xl bg-gradient-to-br from-pink-500 to-pink-400 text-white hover:bg-pink-400 transition-colors shadow-sm"
                        >
                          No
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hotMarkets.length === 0 && event.subtitle && (
          <div className="px-3 py-2 mt-3 rounded-2xl bg-[var(--surface-hover)] text-sm text-[var(--text-secondary)]">
            {event.subtitle}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-tertiary)] pt-1">
          <span className="font-number">
            {formatVolume(
              event.volume ?? event.volume24h ?? event.openInterest
            )}
          </span>
          {event.subtitle && (
            <p className="text-[12px] text-[var(--text-tertiary)] text-right line-clamp-2 max-w-[65%] px-2 py-1">
              {event.subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Full-card overlay when a market is expanded */}
      {expandedMarket && hotMarkets.length > 0 && (
        (() => {
          const idx = hotMarkets.findIndex(
            (m: any, i: number) =>
              m.ticker === expandedMarket || i.toString() === expandedMarket
          );
          if (idx === -1) return null;
          const market = hotMarkets[idx];

          const label =
            market.yesSubTitle ||
            market.noSubTitle ||
            market.subtitle ||
            market.title ||
            `Option ${idx + 1}`;

          const yesPercent = formatPercent(market.yesAsk ?? market.yesBid);
          const noPercent = formatPercent(market.noAsk ?? market.noBid);

          const yesReturn = calculateReturn(market.yesAsk, 100);
          const noReturn = calculateReturn(market.noAsk, 100);

          return (
            <div
              className="absolute left-0 right-0 bottom-0 top-16 rounded-b-3xl  backdrop-blur-sm flex items-center justify-center animate-fadeIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top-right back button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedMarket(null);
                }}
                className="absolute pb-12 top-2 right-2 inline-flex items-center justify-center w-7 h-7   text-[var(--text-primary)]  shadow-sm"
                aria-label="Back"
              >
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M11.5 5L7 9.5L11.5 14"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <div className="w-full">
                <div className="px-3 py-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--text-tertiary)] mb-0.5">
                        Market
                      </p>
                      <p className="text-sm text-[var(--text-primary)] line-clamp-2">
                        {label}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">

<span className="text-lg font-semibold text-[var(--text-primary)] font-number">
                                        {yesPercent}
                                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 px-4 py-3 rounded-2xl ">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTrade(market as Market, 'yes', event);
                        }}
                        className="inline-flex items-center px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 text-md mb-2 font-semibold shadow-sm hover:bg-cyan-500/20 transition-colors"
                      >
                        Yes
                      </button>
                      {yesReturn !== null ? (
<p className="text-sm text-[var(--text-tertiary)] font-number">
                                          $100 →{' '}
                                          <span className="text-emerald-400 font-semibold">
                                            ${Math.round(yesReturn)}
                                          </span>
                                        </p>
                      ) : (
                        <p className="text-xs text-[var(--text-tertiary)]">—</p>
                      )}
                    </div>
                    <div className="flex-1 px-4 py-3 rounded-2xl ">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTrade(market as Market, 'no', event);
                        }}
                        className="inline-flex mb-2 items-center px-3 py-1 rounded-lg bg-pink-500/10 text-pink-300 text-md font-semibold shadow-sm hover:bg-pink-500/20 transition-colors"
                      >
                        No
                      </button>
                      {noReturn !== null ? (
<p className="text-sm text-[var(--text-tertiary)] font-number">
                                          $100 →{' '}
                                          <span className="text-emerald-400 font-semibold">
                                            ${Math.round(noReturn)}
                                          </span>
                                        </p>
                      ) : (
                        <p className="text-xs text-[var(--text-tertiary)]">—</p>
                      )}
                    </div>
                  </div>


                </div>
              </div>
            </div>
          );
        })()
      )}
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [apiCategories, setApiCategories] = useState<TagsByCategories>({});
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [tradeModalMarket, setTradeModalMarket] = useState<Market | null>(null);
  const [tradeModalSide, setTradeModalSide] = useState<'yes' | 'no'>('yes');
  const [tradeModalEvent, setTradeModalEvent] = useState<Event | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport to control popup vs bottom drawer behaviour
  useEffect(() => {
    const updateIsMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 640); // Tailwind 'sm' breakpoint
      }
    };

    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  // Focus mobile search input when opening
  useEffect(() => {
    if (isMobileSearchOpen && mobileSearchInputRef.current) {
      mobileSearchInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

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
    let filtered = events;

    // Apply search filter first
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(event => {
        const searchText = `${event.title || ''} ${event.subtitle || ''} ${event.ticker || ''}`.toLowerCase();
        return searchText.includes(query);
      });
    }

    // Then apply topic filter
    if (selectedTopic !== 'all') {
      const topic = TOPIC_FILTERS.find(t => t.id === selectedTopic);
      if (topic && topic.keywords.length > 0) {
        filtered = filtered.filter(event => {
          const searchText = `${event.title || ''} ${event.subtitle || ''} ${event.ticker || ''}`.toLowerCase();
          return topic.keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
        });
      }
    }

    setFilteredEvents(filtered);
  }, [selectedTopic, searchQuery, events]);

  const handleEventClick = (eventTicker: string) => {
    router.push(`/event/${encodeURIComponent(eventTicker)}`);
  };

  const handleOpenTradeModal = (market: Market, side: 'yes' | 'no', event: Event) => {
    setTradeModalMarket(market);
    setTradeModalSide(side);
    setTradeModalEvent(event);
  };

  const handleCloseTradeModal = () => {
    setTradeModalMarket(null);
    setTradeModalEvent(null);
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
          className="px-4 py-2 bg-cyan-400 text-white text-sm font-medium rounded-xl"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Search Bar (keeps desktop search accessible) */}
      <div className="hidden md:block">
        <div className="relative max-w-2xl">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search markets..."
            className="w-full pl-12 pr-10 py-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Filters - Horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {TOPIC_FILTERS.map((topic) => {
          const isSelected = selectedTopic === topic.id;
          return (
            <button
              key={topic.id}
              onClick={() => setSelectedTopic(topic.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 flex-shrink-0 ${isSelected
                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
            >
              <span>{topic.label}</span>
              {isSelected && filteredEvents.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 bg-white/20 rounded-full text-[10px] font-bold font-number">
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
            <div className="w-16 h-16 mb-4 rounded-full bg-[var(--surface)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-[var(--text-secondary)] text-sm mb-3">
              {searchQuery ? `No markets found for "${searchQuery}"` : 'No events found'}
            </p>
            {(selectedTopic !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedTopic('all');
                  setSearchQuery('');
                }}
                className="text-cyan-400 text-sm font-medium"
              >
                Clear filters →
              </button>
            )}
          </div>
        ) : (
          filteredEvents.map((event, index) => (
            <EventCard
              key={event.ticker || index}
              event={event}
              onClick={() => handleEventClick(event.ticker)}
              onOpenTrade={handleOpenTradeModal}
              isMobile={isMobile}
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

      {/* Mobile Floating Search - single component expanding left */}
      <motion.div
        className="md:hidden fixed bottom-28 right-4 z-50 pointer-events-auto"
        animate={{
          width: isMobileSearchOpen ? '80vw' : '56px',
          maxWidth: isMobileSearchOpen ? 320 : 56,
          paddingLeft: isMobileSearchOpen ? 16 : 0,
          paddingRight: isMobileSearchOpen ? 16 : 0,
        }}
        transition={{ type: 'tween', duration: 0.22, ease: 'easeInOut' }}
      >
        <div className="flex items-center gap-2 w-full h-14 px-2 border border-[var(--border-color)] rounded-full shadow-2xl bg-[var(--surface)]/90 backdrop-blur-sm origin-right">
          <button
            onClick={() => setIsMobileSearchOpen((prev) => !prev)}
            aria-label="Toggle search"
            className="flex items-center justify-center w-10 h-10 rounded-full text-[var(--text-primary)] hover:text-cyan-400 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <motion.input
            ref={mobileSearchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search markets..."
            className="flex-1 min-w-0 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm outline-none"
            animate={{
              opacity: isMobileSearchOpen ? 1 : 0,
              x: isMobileSearchOpen ? 0 : 6,
              width: isMobileSearchOpen ? '100%' : '0%',
            }}
            transition={{ type: 'tween', duration: 0.18, ease: 'easeOut' }}
            style={{ pointerEvents: isMobileSearchOpen ? 'auto' : 'none' }}
          />

          <AnimatePresence mode="popLayout">
            {isMobileSearchOpen && searchQuery && (
              <motion.button
                key="clear"
                onClick={() => setSearchQuery('')}
                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Clear search"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>

          {isMobileSearchOpen && (
            <button
              onClick={() => setIsMobileSearchOpen(false)}
              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Close search"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </motion.div>

      {tradeModalMarket && (
        <div
          className={
            isMobile
              ? 'fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm px-0'
              : 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4'
          }
          onClick={handleCloseTradeModal}
        >
          <div
            className={
              isMobile
                ? 'w-full max-w-md max-h-[80vh] bg-black rounded-t-2xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col mb-2'
                : 'w-full max-w-lg bg-black border border-[var(--border-color)]/40 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn'
            }
            style={isMobile ? { animation: 'slideUp 160ms ease-out' } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 p-4 border-b border-[var(--border-color)]/50">
              {tradeModalEvent?.imageUrl ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-[var(--surface-hover)] flex-shrink-0">
                  <img
                    src={tradeModalEvent.imageUrl}
                    alt={tradeModalEvent.title || 'Event'}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📊</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                  {tradeModalEvent?.title || 'Event'}
                </p>
                <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2">
                  {tradeModalEvent?.subtitle}
                </p>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug mt-2">
                  {tradeModalMarket.yesSubTitle ||
                    tradeModalMarket.noSubTitle ||
                    tradeModalMarket.subtitle ||
                    tradeModalMarket.title ||
                    'Market Option'}
                </h3>
              </div>
              <button
                onClick={handleCloseTradeModal}
                className="w-8 h-8 rounded-full bg-[var(--surface-hover)] text-[var(--text-primary)] flex items-center justify-center hover:bg-[var(--surface)] transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4 pb-20 overflow-y-auto">
              <TradeMarket market={tradeModalMarket} initialSide={tradeModalSide} />
            </div>
          </div>
          {isMobile && (
            <style jsx>{`
              @keyframes slideUp {
                from {
                  transform: translateY(100%);
                }
                to {
                  transform: translateY(0);
                }
              }
            `}</style>
          )}
        </div>
      )}
    </div>
  );
}
