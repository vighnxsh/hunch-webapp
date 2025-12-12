'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { formatMarketTitle } from '../lib/marketUtils';
import { getCachedUserId, syncUserOnLogin, needsSync } from '../lib/authSync';
import { fetchMarketDetails, fetchEventDetails, Market, EventDetails } from '../lib/api';

// Market data cache for feed items
interface MarketData {
  market: Market | null;
  event: EventDetails | null;
  loading: boolean;
  error: string | null;
}

interface FeedItem {
  id: string;
  userId: string;
  marketTicker: string;
  eventTicker: string | null;
  side: string;
  amount: string;
  transactionSig: string;
  quote: string | null;
  isDummy: boolean;
  createdAt: string;
  user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    walletAddress: string;
  };
}

interface SearchResult {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  walletAddress: string;
  _count?: {
    trades: number;
    followers: number;
    following: number;
  };
}

// User Search Result Item Component - Defined before main component to avoid hook order issues
function UserSearchResultItem({
  user,
  currentUserId,
  onFollowChange,
}: {
  user: SearchResult;
  currentUserId: string | null;
  onFollowChange: () => void;
}) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    const checkFollowing = async () => {
      if (!currentUserId) return;
      try {
        const followingRes = await fetch(`/api/follow/following?userId=${currentUserId}`);
        if (followingRes.ok) {
          const following = await followingRes.json();
          setIsFollowing(following.some((f: any) => f.following.id === user.id));
        }
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };
    checkFollowing();
  }, [currentUserId, user.id]);

  const handleFollowClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click navigation
    if (!currentUserId || currentUserId === user.id || followLoading) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await fetch('/api/follow', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            followerId: currentUserId,
            followingId: user.id,
          }),
        });
        setIsFollowing(false);
      } else {
        await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            followerId: currentUserId,
            followingId: user.id,
          }),
        });
        setIsFollowing(true);
      }
      onFollowChange();
    } catch (error) {
      console.error('Error following/unfollowing:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleCardClick = () => {
    router.push(`/user/${user.id}`);
  };

  const displayName = user.displayName || `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}`;

  return (
    <div
      onClick={handleCardClick}
      className="flex items-center justify-between py-2.5 px-2 hover:bg-[var(--surface-hover)]/40 rounded-lg cursor-pointer group transition-colors"
    >
      <div className="flex items-center gap-3">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={displayName}
            className="w-9 h-9 rounded-full"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <span className="text-white text-sm font-bold">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span className="text-[var(--text-primary)] text-sm font-medium group-hover:text-violet-400 transition-colors">
          {displayName}
        </span>
      </div>
      <button
        onClick={handleFollowClick}
        disabled={followLoading || !currentUserId || currentUserId === user.id}
        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${isFollowing
          ? 'bg-[var(--surface-hover)] hover:bg-red-500/10 hover:text-red-400 text-[var(--text-secondary)]'
          : 'bg-violet-600 hover:bg-violet-500 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {followLoading ? (
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
        ) : isFollowing ? 'Unfollow' : 'Follow'}
      </button>
    </div>
  );
}

export default function SocialFeed() {
  const router = useRouter();
  const { ready, authenticated, user } = usePrivy();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Market data cache for displaying event cards
  const [marketDataCache, setMarketDataCache] = useState<Map<string, MarketData>>(new Map());
  const loadedTickersRef = useRef<Set<string>>(new Set());

  // Initialize from cache immediately
  useEffect(() => {
    const cachedUserId = getCachedUserId();
    if (cachedUserId) {
      setCurrentUserId(cachedUserId);
    }
  }, []);

  // Sync user ONLY if needed (on first login or user change)
  useEffect(() => {
    if (!ready || !authenticated || !user) {
      setCurrentUserId(null);
      return;
    }

    // Check if sync is needed
    if (!needsSync(user.id)) {
      // Already synced, just use cached data
      const cachedUserId = getCachedUserId();
      if (cachedUserId) {
        setCurrentUserId(cachedUserId);
      }
      return;
    }

    const performSync = async () => {
      try {
        // Get wallet address
        const walletAccount = user.linkedAccounts?.find(
          (account) => account.type === 'wallet' &&
            'address' in account &&
            account.address &&
            typeof account.address === 'string' &&
            !account.address.startsWith('0x') &&
            account.address.length >= 32
        ) as any;

        const walletAddress = walletAccount?.address as string | undefined;

        if (!walletAddress) {
          return;
        }

        // Sync user
        const result = await syncUserOnLogin(
          user.id,
          walletAddress,
          user.twitter?.username
            ? `@${user.twitter.username}`
            : user.google?.email?.split('@')[0] || null,
          user.twitter?.profilePictureUrl || null
        );

        if (result) {
          setCurrentUserId(result.userId);
        }
      } catch (error) {
        console.error('Error syncing user:', error);
      }
    };

    performSync();
  }, [ready, authenticated, user]);

  // Load feed
  useEffect(() => {
    if (currentUserId) {
      loadFeed();
    } else {
      setFeedItems([]);
    }
  }, [currentUserId]);

  const loadFeed = async () => {
    if (!currentUserId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/feed?userId=${currentUserId}&limit=50`);

      if (!response.ok) {
        throw new Error('Failed to load feed');
      }

      const data = await response.json();
      // Feed is already sorted by most recent (newest first) from the API
      setFeedItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load feed');
      console.error('Error loading feed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch market and event data for feed items
  useEffect(() => {
    const fetchMarketData = async (marketTicker: string) => {
      // Skip if already loaded or loading
      if (loadedTickersRef.current.has(marketTicker)) return;
      loadedTickersRef.current.add(marketTicker);

      // Set loading state
      setMarketDataCache(prev => {
        const newCache = new Map(prev);
        newCache.set(marketTicker, { market: null, event: null, loading: true, error: null });
        return newCache;
      });

      try {
        // 1. Fetch market details
        const market = await fetchMarketDetails(marketTicker);

        let eventData: EventDetails | null = null;

        // 2. If market has eventTicker, fetch event details
        if (market.eventTicker) {
          try {
            eventData = await fetchEventDetails(market.eventTicker);
          } catch (eventError) {
            console.error('Error fetching event details:', eventError);
          }
        }

        setMarketDataCache(prev => {
          const newCache = new Map(prev);
          newCache.set(marketTicker, { market, event: eventData, loading: false, error: null });
          return newCache;
        });
      } catch (error: any) {
        console.error('Error fetching market data:', error);
        setMarketDataCache(prev => {
          const newCache = new Map(prev);
          newCache.set(marketTicker, { market: null, event: null, loading: false, error: error.message });
          return newCache;
        });
      }
    };

    // Fetch data for all feed items
    feedItems.forEach(item => {
      fetchMarketData(item.marketTicker);
    });
  }, [feedItems]);

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || !currentUserId) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}&type=displayName`);
      if (response.ok) {
        const users = await response.json();
        // Filter out current user
        const filtered = users.filter((u: SearchResult) => u.id !== currentUserId);
        setSearchResults(filtered);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [currentUserId]);

  // Handle search input change with debounce
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If empty, clear results immediately
    if (!value.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    // Show searching indicator
    setSearching(true);

    // Debounce the search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300); // 300ms debounce
  }, [performSearch]);



  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);


  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
  };

  const formatAmount = (amount: string, isDummy: boolean) => {
    // For dummy trades, display amount as-is; for real trades, convert from smallest unit
    if (isDummy) {
      const num = parseFloat(amount);
      return num.toFixed(2);
    }
    const num = parseFloat(amount) / 1_000_000; // Convert from smallest unit for real trades
    return num.toFixed(2);
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!ready || !authenticated) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Minimal Search Bar - Centered, Expandable */}
      {/* Minimal Search Bar - Left aligned, Expandable */}
      <div className="mb-4">
        <div className={`relative transition-all duration-300 ease-out ${isSearchFocused || searchQuery ? 'w-72' : 'w-48'}`}>
          {/* Search Icon */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {searching ? (
              <svg className="w-4 h-4 text-violet-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search friends..."
            className={`w-full pl-9 pr-9 py-2.5 rounded-full bg-[var(--surface-hover)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm transition-all duration-300 outline-none ${isSearchFocused ? 'ring-2 ring-violet-500/50 bg-[var(--card-bg)]' : 'hover:bg-[var(--card-bg)]'}`}
          />

          {/* Clear button */}
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Search Results - Compact */}
      {searchResults.length > 0 && (
        <div className="space-y-2 mb-4">
          {searchResults.map((result) => (
            <UserSearchResultItem
              key={result.id}
              user={result}
              currentUserId={currentUserId}
              onFollowChange={() => {
                performSearch(searchQuery);
                loadFeed();
              }}
            />
          ))}
        </div>
      )}

      {/* No results - Minimal */}
      {searchQuery.trim() && !searching && searchResults.length === 0 && (
        <div className="text-center py-4 mb-4">
          <p className="text-[var(--text-tertiary)] text-sm">No users found</p>
        </div>
      )}

      {/* Feed Section */}
      <div className="bg-gradient-to-b from-[var(--card-bg)]/50 to-[var(--card-bg)]/30 rounded-2xl p-6 border border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {/* <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div> */}
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Activity Feed</h2>
          </div>
          <button
            onClick={loadFeed}
            disabled={loading || !currentUserId}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-hover)] hover:bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium border border-[var(--border-color)]"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {loading && feedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[var(--text-secondary)] text-sm">Loading feed...</p>
          </div>
        ) : feedItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--surface-hover)] flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[var(--text-tertiary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <p className="text-[var(--text-secondary)] text-lg mb-2">No trades yet</p>
            <p className="text-[var(--text-tertiary)] text-sm">
              Follow users to see their trades in your feed
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedItems.map((item) => {
              const displayName = item.user.displayName || truncateAddress(item.user.walletAddress);
              const hasQuote = item.quote && item.quote.trim().length > 0;
              const marketData = marketDataCache.get(item.marketTicker);
              const isLoadingMarket = !marketData || marketData.loading;
              const eventImage = marketData?.event?.imageUrl;
              const marketTitle = marketData?.market?.title || formatMarketTitle('', item.marketTicker);
              const eventTicker = marketData?.market?.eventTicker || item.eventTicker;

              // Calculate probability from yesBid if available
              const yesBid = marketData?.market?.yesBid;
              const probability = yesBid ? Math.round(parseFloat(yesBid) * 100) : null;

              return (
                <div key={item.id} className="border-b border-[var(--border-color)] pb-3 last:border-b-0">
                  {/* Header: Avatar + Name + Action + Time - all inline */}
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => router.push(`/user/${item.user.id}`)}
                      className="flex items-center gap-2 focus:outline-none hover:opacity-80"
                    >
                      {item.user.avatarUrl ? (
                        <img
                          src={item.user.avatarUrl}
                          alt={displayName}
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                          <span className="text-white text-[10px] font-bold">
                            {displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="font-semibold text-[var(--text-primary)] text-sm hover:text-violet-400">
                        {displayName}
                      </span>
                    </button>
                    <span className="text-[var(--text-secondary)] text-sm">
                      Bought <span className="font-semibold">${formatAmount(item.amount, item.isDummy)}</span>
                      {' '}
                      <span className={`font-semibold ${item.side === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                        {item.side.toUpperCase()}
                      </span>
                    </span>
                    <span className="text-[var(--text-tertiary)] text-xs ml-auto">
                      {formatTimeAgo(item.createdAt)}
                    </span>
                  </div>

                  {/* Quote if present - HIGHLIGHTED with special styling */}
                  {hasQuote && (
                    <div className="ml-8 my-3 px-4 py-3 bg-gradient-to-r from-violet-500/10 to-transparent border-l-4 border-violet-500 rounded-r-lg">
                      <p className="text-[var(--text-primary)] text-base font-medium">
                        {item.quote}
                      </p>
                    </div>
                  )}

                  {/* Horizontal Market Card: Image Left, Content Right - Same indent as quote */}
                  <button
                    onClick={() => eventTicker && router.push(`/event/${encodeURIComponent(eventTicker)}`)}
                    className="ml-8 w-[calc(100%-2rem)] text-left focus:outline-none group"
                    disabled={!eventTicker}
                  >
                    <div className="flex rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--card-bg)]/40 hover:bg-[var(--surface-hover)]/50 hover:border-violet-500/30 transition-all">
                      {/* Image - Left */}
                      <div className="flex-shrink-0 w-28 h-20 relative overflow-hidden">
                        {isLoadingMarket ? (
                          <div className="w-full h-full bg-[var(--surface-hover)] animate-pulse" />
                        ) : eventImage ? (
                          <img
                            src={eventImage}
                            alt={marketTitle}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 flex items-center justify-center">
                            <svg className="w-6 h-6 text-violet-400/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Content - Right */}
                      <div className="flex-1 p-3 min-w-0 flex flex-col justify-center">
                        <h3 className="text-[var(--text-primary)] text-sm font-medium line-clamp-2 leading-snug group-hover:text-violet-400 transition-colors">
                          {marketTitle}
                        </h3>
                        {probability !== null && (
                          <span className={`mt-1 text-xs font-semibold ${probability >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                            {probability}% chance
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
