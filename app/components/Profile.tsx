'use client';

import { useState, useEffect, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCreateWallet } from '@privy-io/react-auth/solana';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import UserPositions from './UserPositions';
import UserTrades from './UserTrades';
import CreditCard from './CreditCard';
import { useTheme } from './ThemeProvider';
import FollowersFollowingModal from './FollowersFollowingModal';
import {
  getCachedUserId,
  getCachedUserCounts,
  syncUserOnLogin,
  fetchUserCounts,
  needsSync,
  updateCachedCounts,
} from '../lib/authSync';

export default function Profile() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { theme } = useTheme();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [tradesCount, setTradesCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'followers' | 'following'>('followers');

  // Check if HTTPS is available (required for embedded wallets)
  const isHttpsAvailable = () => {
    if (typeof window === 'undefined') return false;
    return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
  };

  // Get wallet address from multiple sources with polling
  useEffect(() => {
    if (!authenticated || !user) {
      setWalletAddress(null);
      return;
    }

    const checkForWallet = () => {
      // First, try to get from wallets array
      const solanaWallets = wallets.filter((wallet) => {
        if (wallet.walletClientType === 'privy') return true;
        if (wallet.address && !wallet.address.startsWith('0x') && wallet.address.length >= 32) {
          return true;
        }
        return false;
      });

      const solanaWallet = solanaWallets.find(
        (wallet) => wallet.walletClientType === 'privy'
      ) || solanaWallets[0];

      if (solanaWallet?.address) {
        setWalletAddress(solanaWallet.address);
        return true;
      }

      // Fallback: try to get from user's linked accounts
      if (user?.linkedAccounts) {
        const embeddedWallet = user.linkedAccounts.find(
          (account) => account.type === 'wallet' &&
            'walletClientType' in account &&
            account.walletClientType === 'privy' &&
            'address' in account
        ) as any;

        if (embeddedWallet?.address) {
          setWalletAddress(embeddedWallet.address);
          return true;
        }

        // Last resort: check all linked accounts for Solana addresses
        const solanaAccount = user.linkedAccounts.find(
          (account) => account.type === 'wallet' &&
            'address' in account &&
            account.address &&
            typeof account.address === 'string' &&
            !account.address.startsWith('0x') &&
            account.address.length >= 32
        ) as any;

        if (solanaAccount?.address) {
          setWalletAddress(solanaAccount.address);
          return true;
        }
      }

      return false;
    };

    // Check immediately
    if (checkForWallet()) {
      return;
    }

    // Poll for wallet creation (check every 2 seconds for up to 30 seconds)
    let pollCount = 0;
    const maxPolls = 15;

    const pollInterval = setInterval(() => {
      pollCount++;
      if (checkForWallet() || pollCount >= maxPolls) {
        clearInterval(pollInterval);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [authenticated, user, wallets]);

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  // Track if user has been synced in this session to avoid redundant syncs
  const hasSyncedRef = useRef(false);

  // Initialize from cache immediately for instant display
  useEffect(() => {
    const cachedUserId = getCachedUserId();
    const cachedCounts = getCachedUserCounts();

    if (cachedUserId) {
      setCurrentUserId(cachedUserId);
    }

    if (cachedCounts) {
      setFollowersCount(cachedCounts.followerCount);
      setFollowingCount(cachedCounts.followingCount);
    }
  }, []);

  // Sync user ONLY if needed (on first login or user change)
  useEffect(() => {
    if (!ready || !authenticated || !user || !walletAddress) {
      setCurrentUserId(null);
      hasSyncedRef.current = false;
      return;
    }

    // Check if sync is needed
    if (!needsSync(user.id)) {
      // Already synced, just use cached data
      const cachedUserId = getCachedUserId();
      if (cachedUserId) {
        setCurrentUserId(cachedUserId);
        hasSyncedRef.current = true;
      }
      return;
    }

    // Skip if already synced in this session
    if (hasSyncedRef.current) {
      return;
    }

    const performSync = async () => {
      try {
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
          setFollowersCount(result.counts.followerCount);
          setFollowingCount(result.counts.followingCount);
          hasSyncedRef.current = true;
        }
      } catch (error) {
        console.error('Error syncing user:', error);
      }
    };

    performSync();
  }, [ready, authenticated, user, walletAddress]);

  // Fetch follower/following counts and trades count in background (non-blocking)
  useEffect(() => {
    if (currentUserId) {
      fetchProfileStats();
    }
  }, [currentUserId]);

  // Fetch SOL price
  useEffect(() => {
    fetchSolPrice();
    // Refresh price every 5 minutes
    const priceInterval = setInterval(fetchSolPrice, 5 * 60 * 1000);
    return () => clearInterval(priceInterval);
  }, []);

  // Fetch SOL balance
  useEffect(() => {
    if (walletAddress && authenticated) {
      fetchBalance();
    }
  }, [walletAddress, authenticated]);

  const fetchSolPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      if (response.ok) {
        const data = await response.json();
        setSolPrice(data.solana?.usd || null);
      }
    } catch (err) {
      console.error('Error fetching SOL price:', err);
    }
  };

  const fetchProfileStats = async (skipCache: boolean = false) => {
    if (!currentUserId) return;

    try {
      // Fetch user profile with denormalized counts (instant display)
      const fetchOptions: RequestInit = {};
      if (skipCache) {
        fetchOptions.cache = 'no-store';
        fetchOptions.headers = { 'cache-control': 'no-cache' };
      }

      const [userRes, tradesRes] = await Promise.all([
        fetch(`/api/users/${currentUserId}`, fetchOptions),
        fetch(`/api/trades?userId=${currentUserId}&limit=1`, skipCache ? { cache: 'no-store' } : {}),
      ]);

      if (userRes.ok) {
        const userProfile = await userRes.json();
        // Use denormalized counts from User model (instant, no counting needed)
        console.log('Fetched profile stats:', {
          followerCount: userProfile.followerCount,
          followingCount: userProfile.followingCount,
        });
        const followerCount = userProfile.followerCount || 0;
        const followingCount = userProfile.followingCount || 0;
        setFollowersCount(followerCount);
        setFollowingCount(followingCount);

        // Update cache with fresh data
        updateCachedCounts({ followerCount, followingCount });
      }

      if (tradesRes.ok) {
        const trades = await tradesRes.json();
        setTradesCount(trades.length);
      }
    } catch (error) {
      console.error('Error fetching profile stats:', error);
    }
  };

  // Optimistic count update callback for follow/unfollow actions
  const handleFollowChange = (isFollowing: boolean) => {
    if (!currentUserId) return;

    // Optimistically update following count immediately
    if (isFollowing) {
      setFollowingCount((prev) => prev + 1);
      updateCachedCounts({ followingCount: followingCount + 1 });
    } else {
      setFollowingCount((prev) => Math.max(0, prev - 1));
      updateCachedCounts({ followingCount: Math.max(0, followingCount - 1) });
    }

    // Refresh from server to sync after a delay to ensure DB update and cache invalidation complete
    // Skip cache to get fresh data after follow/unfollow
    setTimeout(() => {
      fetchProfileStats(true); // Skip cache to get fresh counts
    }, 800);

    // Do a second refresh to ensure consistency (in case of race conditions)
    setTimeout(() => {
      fetchProfileStats(true);
    }, 2000);
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      // Search by wallet address (exact match) or display name (partial match)
      const response = await fetch(`/api/users/search?walletAddress=${encodeURIComponent(searchQuery.trim())}`);
      if (response.ok) {
        const users = await response.json();
        setSearchResults(users);
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

  const fetchBalance = async () => {
    if (!walletAddress) return;

    setLoading(true);
    setError(null);

    try {
      const publicKey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(publicKey);
      setSolBalance(balance / LAMPORTS_PER_SOL);
    } catch (err: any) {
      setError('Failed to fetch balance');
      console.error('Error fetching balance:', err);
    } finally {
      setLoading(false);
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const getUserDisplayName = () => {
    if (user?.twitter?.username) {
      return `@${user.twitter.username}`;
    }
    if (user?.google?.email) {
      return user.google.email.split('@')[0];
    }
    return 'User';
  };

  const getUserAvatar = () => {
    if (user?.twitter?.profilePictureUrl) {
      return user.twitter.profilePictureUrl;
    }
    return null;
  };

  const getUserEmail = () => {
    if (user?.google?.email) {
      return user.google.email;
    }
    // Twitter doesn't provide email in Privy
    return null;
  };

  if (!ready || !authenticated) {
    return null;
  }

  return (
    <div className="bg-[var(--surface)]/50 backdrop-blur-sm   rounded-2xl p-6">


      {/* User Info Section */}
      <div className="mb-6 pb-6 border-b border-[var(--border-color)]">
        <div className="flex items-start gap-4">
          {getUserAvatar() ? (
            <img
              src={getUserAvatar()!}
              alt="Profile"
              className="w-16 h-16 rounded-full border-2 border-violet-500/30"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center border-2 border-violet-500/30">
              <span className="text-white text-xl font-bold">
                {getUserDisplayName().charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
              {getUserDisplayName()}
            </h3>
            {getUserEmail() && (
              <p className="text-[var(--text-secondary)] text-sm mb-2">{getUserEmail()}</p>
            )}
            {/* Followers/Following Counts - Clickable */}
            <div className="flex items-center gap-4 mt-4">
              <button
                onClick={() => {
                  setModalType('followers');
                  setModalOpen(true);
                }}
                className="flex flex-col hover:bg-[var(--surface-hover)] px-3 py-2 rounded-lg transition-all cursor-pointer group"
              >
                <span className="text-xl font-bold text-[var(--text-primary)] group-hover:text-violet-400 transition-colors">{followersCount}</span>
                <span className="text-[var(--text-tertiary)] text-md group-hover:text-[var(--text-secondary)] transition-colors">Followers</span>
              </button>
              <button
                onClick={() => {
                  setModalType('following');
                  setModalOpen(true);
                }}
                className="flex flex-col hover:bg-[var(--surface-hover)] px-3 py-2 rounded-lg transition-all cursor-pointer group"
              >
                <span className="text-xl font-bold text-[var(--text-primary)] group-hover:text-violet-400 transition-colors">{followingCount}</span>
                <span className="text-[var(--text-tertiary)] text-md group-hover:text-[var(--text-secondary)] transition-colors">Following</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Creation Section (only shown if no wallet) */}
      {!walletAddress && (
        <div className="mb-6 pb-6 border-b border-[var(--border-color)]">
          <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">
            Solana Wallet
          </h4>
          <div className="bg-[var(--card-bg)]/30 rounded-xl p-6 border border-[var(--border-color)]">
            {creatingWallet ? (
              <div className="flex flex-col items-center justify-center gap-4 py-4">
                <svg className="w-8 h-8 text-violet-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-violet-300 text-sm font-medium">
                  Creating your wallet...
                </p>
                <p className="text-[var(--text-tertiary)] text-xs text-center max-w-sm">
                  This usually takes just a few seconds. Please wait...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-4">
                <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center mb-2">
                  <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-[var(--text-secondary)] text-sm text-center mb-1">
                  No wallet found
                </p>
                <p className="text-[var(--text-tertiary)] text-xs text-center max-w-sm mb-4">
                  Create a Solana wallet to start trading on prediction markets
                </p>
                <button
                  onClick={async () => {
                    setCreatingWallet(true);
                    setError(null);

                    // Check if HTTPS is available
                    if (!isHttpsAvailable()) {
                      setError('Embedded wallets require HTTPS. Please use HTTPS or deploy to a staging environment.');
                      setCreatingWallet(false);
                      return;
                    }

                    try {
                      await createWallet();
                      // Wait a moment and check again
                      setTimeout(() => {
                        setCreatingWallet(false);
                      }, 5000);
                    } catch (err: any) {
                      const errorMessage = err?.message || 'Failed to create wallet';
                      if (errorMessage.includes('HTTPS') || errorMessage.includes('https')) {
                        setError('Embedded wallets require HTTPS. Please use HTTPS or deploy to a staging environment.');
                      } else {
                        setError(errorMessage);
                      }
                      setCreatingWallet(false);
                      console.error('Wallet creation error:', err);
                    }
                  }}
                  disabled={creatingWallet}
                  className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingWallet ? 'Creating...' : 'Create Solana Wallet'}
                </button>
                {error && (
                  <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-xs text-center">{error}</p>
                    {error.includes('HTTPS') && (
                      <p className="text-red-300/70 text-xs text-center mt-2">
                        For local development, you can use tools like{' '}
                        <a
                          href="https://github.com/FiloSottile/mkcert"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-red-200"
                        >
                          mkcert
                        </a>
                        {' '}to enable HTTPS on localhost.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Credit Card Style Stats */}
      <CreditCard
        theme={theme}
        loading={loading}
        error={error}
        solBalance={solBalance}
        solPrice={solPrice}
        tradesCount={tradesCount}
        username={getUserDisplayName()}
        walletAddress={walletAddress || undefined}
      />



      {/* User Trades Section */}
      {currentUserId && (
        <div className="mb-6">
          <UserTrades userId={currentUserId} />
        </div>
      )}

      {/* User Discovery Section */}

      {/* Followers/Following Modal */}
      <FollowersFollowingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={currentUserId || ''}
        type={modalType}
        currentUserId={currentUserId}
      />
    </div>
  );
}

// User Search Result Component
function UserSearchResult({
  user,
  currentUserId,
  onFollowChange,
}: {
  user: any;
  currentUserId: string | null;
  onFollowChange: (isFollowing: boolean) => void;
}) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!currentUserId || currentUserId === user.id) {
      setChecking(false);
      return;
    }

    const checkFollowing = async () => {
      try {
        const followingRes = await fetch(`/api/follow/following?userId=${currentUserId}`);
        if (followingRes.ok) {
          const following = await followingRes.json();
          const followingIds = following.map((f: any) => f.following.id);
          setIsFollowing(followingIds.includes(user.id));
        }
      } catch (error) {
        console.error('Error checking follow status:', error);
      } finally {
        setChecking(false);
      }
    };

    checkFollowing();
  }, [currentUserId, user.id]);

  const handleFollow = async () => {
    if (!currentUserId || currentUserId === user.id || loading) return;

    const wasFollowing = isFollowing;

    // Optimistic UI update
    setIsFollowing(!wasFollowing);

    setLoading(true);
    try {
      if (wasFollowing) {
        await fetch('/api/follow', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            followerId: currentUserId,
            followingId: user.id,
          }),
        });
      } else {
        await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            followerId: currentUserId,
            followingId: user.id,
          }),
        });
      }
      // Call optimistic count update callback
      onFollowChange(!wasFollowing);
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      // Rollback optimistic update on error
      setIsFollowing(wasFollowing);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="bg-[var(--card-bg)]/30 rounded-lg p-3 border border-[var(--border-color)]">
        <div className="h-4 w-24 bg-[var(--surface-hover)] rounded animate-pulse" />
      </div>
    );
  }

  if (currentUserId === user.id) {
    return null; // Don't show self in search results
  }

  const displayName = user.displayName || `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}`;

  return (
    <div className="bg-[var(--card-bg)]/30 rounded-lg p-3 border border-[var(--border-color)] flex items-center justify-between">
      <div className="flex items-center gap-3">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full border border-violet-500/30"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center border border-violet-500/30">
            <span className="text-white text-xs font-bold">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div>
          <p className="text-[var(--text-primary)] text-sm font-medium">{displayName}</p>
          <p className="text-[var(--text-tertiary)] text-xs font-mono">{user.walletAddress.slice(0, 8)}...</p>
        </div>
      </div>
      <button
        onClick={handleFollow}
        disabled={loading}
        className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${isFollowing
          ? 'bg-[var(--surface-hover)] hover:bg-[var(--input-bg)] text-[var(--text-secondary)]'
          : 'bg-violet-600 hover:bg-violet-500 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
      </button>
    </div>
  );
}