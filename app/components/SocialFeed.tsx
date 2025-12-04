'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { formatMarketTitle } from '../lib/marketUtils';

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

  const handleFollowClick = async () => {
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

  const displayName = user.displayName || `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}`;

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={displayName}
            className="w-10 h-10 rounded-full border border-violet-500/30"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center border border-violet-500/30">
            <span className="text-white text-sm font-bold">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div>
          <p className="text-white text-sm font-medium">{displayName}</p>
          <p className="text-gray-500 text-xs font-mono">{user.walletAddress.slice(0, 8)}...</p>
          {user._count && (
            <p className="text-gray-500 text-xs mt-1">
              {user._count.followers} followers • {user._count.trades} trades
            </p>
          )}
        </div>
      </div>
      <button
        onClick={handleFollowClick}
        disabled={followLoading || !currentUserId || currentUserId === user.id}
        className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
          isFollowing
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            : 'bg-violet-600 hover:bg-violet-500 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {followLoading ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
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
  const [searchType, setSearchType] = useState<'displayName' | 'walletAddress'>('walletAddress');

  // Sync user and get user ID
  useEffect(() => {
    if (!ready || !authenticated || !user) {
      setCurrentUserId(null);
      return;
    }

    const syncAndGetUserId = async () => {
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
        const syncResponse = await fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privyId: user.id,
            walletAddress: walletAddress,
            displayName: user.twitter?.username 
              ? `@${user.twitter.username}` 
              : user.google?.email?.split('@')[0] || null,
            avatarUrl: user.twitter?.profilePictureUrl || null,
          }),
        });

        if (syncResponse.ok) {
          const syncedUser = await syncResponse.json();
          setCurrentUserId(syncedUser.id);
        }
      } catch (error) {
        console.error('Error syncing user:', error);
      }
    };

    syncAndGetUserId();
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

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentUserId) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}&type=${searchType}`);
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
  };


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
      <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/50">
        <h2 className="text-2xl font-bold text-white mb-4">Discover Users</h2>
        
        {/* Search Type Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSearchType('walletAddress')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              searchType === 'walletAddress'
                ? 'bg-violet-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Wallet Address
          </button>
          <button
            onClick={() => setSearchType('displayName')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              searchType === 'displayName'
                ? 'bg-violet-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Display Name
          </button>
        </div>

        {/* Search Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            placeholder={
              searchType === 'walletAddress'
                ? 'Search by wallet address (e.g., 7xKXtg...)'
                : 'Search by display name'
            }
            className="flex-1 px-4 py-3 border border-gray-700 rounded-xl bg-gray-800 text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim() || !currentUserId}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
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
                  handleSearch();
                  loadFeed();
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Feed Section */}
      <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Trades from Followed Users</h2>
          <button
            onClick={loadFeed}
            disabled={loading || !currentUserId}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {loading ? 'Loading...' : 'Refresh'}
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
            <p className="text-gray-400 text-sm">Loading feed...</p>
          </div>
        ) : feedItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700/50 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-500"
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
            <p className="text-gray-400 text-lg mb-2">No trades yet</p>
            <p className="text-gray-500 text-sm">
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
                  className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30 hover:border-gray-600/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* User Avatar */}
                    {item.user.avatarUrl ? (
                      <img
                        src={item.user.avatarUrl}
                        alt={displayName}
                        className="w-10 h-10 rounded-full border-2 border-violet-500/30"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center border-2 border-violet-500/30">
                        <span className="text-white text-sm font-bold">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Trade Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-semibold">{displayName}</span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-400 text-sm">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                      </div>

                      <div className="mb-2">
                        <p className="text-gray-300 text-sm mb-1">
                          Traded{' '}
                          <span
                            className={`font-semibold ${
                              item.side === 'yes' ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {item.side.toUpperCase()}
                          </span>{' '}
                          on{' '}
                          <span className="text-white font-medium">{displayTitle}</span>
                        </p>
                        <p className="text-gray-500 text-xs font-mono mb-1">
                          {item.marketTicker}
                        </p>
                        <p className="text-gray-400 text-xs">
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
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        item.side === 'yes'
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
