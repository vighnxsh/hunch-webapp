'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { formatMarketTitle } from '../lib/marketUtils';
import { getCachedUserId, syncUserOnLogin, needsSync } from '../lib/authSync';

interface FeedItem {
  id: string;
  userId: string;
  marketTicker: string;
  side: string;
  amount: string;
  transactionSig: string;
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
      className="bg-[var(--surface-hover)]/60 backdrop-blur-sm rounded-xl p-4 border border-[var(--border-color)] flex items-center justify-between transition-all duration-200 hover:bg-[var(--surface-hover)] hover:border-violet-500/20 hover:shadow-lg hover:shadow-violet-500/5 cursor-pointer group"
    >
      <div className="flex items-center gap-3">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={displayName}
            className="w-11 h-11 rounded-full border-2 border-violet-500/30 shadow-lg transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center border-2 border-violet-500/30 shadow-lg transition-transform group-hover:scale-105">
            <span className="text-white text-sm font-bold">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[var(--text-primary)] text-sm font-semibold group-hover:text-violet-400 transition-colors">{displayName}</p>
            <svg className="w-4 h-4 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <p className="text-[var(--text-tertiary)] text-xs font-mono opacity-70">{user.walletAddress.slice(0, 8)}...</p>
          {user._count && (
            <p className="text-[var(--text-tertiary)] text-xs mt-0.5">
              <span className="text-violet-400">{user._count.followers}</span> followers • <span className="text-violet-400">{user._count.trades}</span> trades
            </p>
          )}
        </div>
      </div>
      <button
        onClick={handleFollowClick}
        disabled={followLoading || !currentUserId || currentUserId === user.id}
        className={`px-5 py-2.5 text-xs font-semibold rounded-xl transition-all duration-200 ${isFollowing
          ? 'bg-[var(--surface-hover)] hover:bg-red-500/10 hover:text-red-400 text-[var(--text-secondary)] border border-[var(--border-color)]'
          : 'bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white shadow-lg shadow-violet-500/25'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {followLoading ? (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          </span>
        ) : isFollowing ? 'Unfollow' : 'Follow'}
      </button>
    </div>
  );
}

export default function SocialFeed() {
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

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount) / 1_000_000; // Convert from smallest unit
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
      {/* Search Section */}
      <div className={`bg-gradient-to-b from-[var(--card-bg)]/50 to-[var(--card-bg)]/30 rounded-2xl p-6 border transition-all duration-300 ${isSearchFocused ? 'border-violet-500/40 shadow-lg shadow-violet-500/10' : 'border-[var(--border-color)]'
        }`}>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-5">Discover Users</h2>

        {/* Search Input - No Button */}
        <div className="relative">
          {/* Search Icon */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            {searching ? (
              <svg className="w-5 h-5 text-violet-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            placeholder="Search by name..."
            className="w-full pl-12 pr-12 py-4 border border-[var(--border-color)] rounded-xl bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all duration-200 text-sm"
          />

          {/* Clear button */}
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
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

        {/* No results message */}
        {searchQuery.trim() && !searching && searchResults.length === 0 && (
          <div className="mt-4 text-center py-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--surface-hover)] flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">No users found</p>
            <p className="text-[var(--text-tertiary)] text-xs mt-1">Try a different search term</p>
          </div>
        )}
      </div>

      {/* Feed Section */}
      <div className="bg-gradient-to-b from-[var(--card-bg)]/50 to-[var(--card-bg)]/30 rounded-2xl p-6 border border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
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
          <div className="space-y-4">
            {feedItems.map((item) => {
              const displayTitle = formatMarketTitle('', item.marketTicker);
              const displayName = item.user.displayName || truncateAddress(item.user.walletAddress);

              return (
                <div
                  key={item.id}
                  className="bg-[var(--surface-hover)]/60 backdrop-blur-sm rounded-xl p-4 border border-[var(--border-color)] hover:border-violet-500/20 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-200"
                >
                  <div className="flex items-start gap-4">
                    {/* User Avatar */}
                    {item.user.avatarUrl ? (
                      <img
                        src={item.user.avatarUrl}
                        alt={displayName}
                        className="w-11 h-11 rounded-full border-2 border-violet-500/30 shadow-lg"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center border-2 border-violet-500/30 shadow-lg">
                        <span className="text-white text-sm font-bold">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Trade Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[var(--text-primary)] font-semibold">{displayName}</span>
                        <span className="text-[var(--text-tertiary)]">•</span>
                        <span className="text-[var(--text-secondary)] text-sm">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                      </div>

                      <div className="mb-2">
                        <p className="text-[var(--text-secondary)] text-sm mb-1">
                          Traded{' '}
                          <span
                            className={`font-semibold ${item.side === 'yes' ? 'text-green-400' : 'text-red-400'
                              }`}
                          >
                            {item.side.toUpperCase()}
                          </span>{' '}
                          on{' '}
                          <span className="text-[var(--text-primary)] font-medium">{displayTitle}</span>
                        </p>
                        <p className="text-[var(--text-tertiary)] text-xs font-mono mb-1">
                          {item.marketTicker}
                        </p>
                        <p className="text-[var(--text-secondary)] text-xs">
                          Amount: {formatAmount(item.amount)} USDC
                        </p>
                      </div>

                      {/* Transaction Link */}
                      <a
                        href={`https://solscan.io/tx/${item.transactionSig}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300 text-xs transition-colors"
                      >
                        View on Solscan
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    </div>

                    {/* Side Badge */}
                    <div
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${item.side === 'yes'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                    >
                      {item.side.toUpperCase()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
