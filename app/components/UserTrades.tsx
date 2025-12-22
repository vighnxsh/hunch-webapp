'use client';

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { fetchMarkets, Market, filterOutcomeMints, fetchMarketsBatch } from '../lib/api';
import { formatMarketTitle } from '../lib/marketUtils';

interface Trade {
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

interface Position {
  mint: string;
  balance: number;
  decimals: number;
  position: 'YES' | 'NO' | 'UNKNOWN';
  market: Market | null;
}

interface UserTradesProps {
  userId: string;
  walletAddress?: string | null;
}

export default function UserTrades({ userId, walletAddress }: UserTradesProps) {
  const { ready, authenticated } = usePrivy();
  const [activeTab, setActiveTab] = useState<'active' | 'previous'>('active');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [markets, setMarkets] = useState<Map<string, Market>>(new Map());
  const [loading, setLoading] = useState(true);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  useEffect(() => {
    loadTrades();
  }, [userId]);

  useEffect(() => {
    if (ready && authenticated && walletAddress) {
      loadPositions();
    } else {
      setPositions([]);
    }
  }, [ready, authenticated, walletAddress]);

  useEffect(() => {
    if (trades.length > 0 || positions.length > 0) {
      loadMarkets();
    }
  }, [trades, positions]);

  const loadTrades = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/trades?userId=${userId}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setTrades(data);
      } else {
        setError('Failed to load trades');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load trades');
      console.error('Error loading trades:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPositions = async () => {
    if (!walletAddress) return;

    setPositionsLoading(true);
    try {
      const publicKey = new PublicKey(walletAddress);
      
      // Fetch token accounts from both programs
      const [tokenAccounts2022, tokenAccountsLegacy] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: TOKEN_2022_PROGRAM_ID,
        }).catch(() => ({ value: [] })),
        connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: TOKEN_PROGRAM_ID,
        }).catch(() => ({ value: [] })),
      ]);

      const allTokenAccounts = [
        ...tokenAccounts2022.value,
        ...tokenAccountsLegacy.value,
      ];

      const userTokens = allTokenAccounts
        .map(({ account }) => {
          const info = account.data.parsed.info;
          return {
            mint: info.mint,
            balance: info.tokenAmount.uiAmount || 0,
            decimals: info.tokenAmount.decimals,
            rawBalance: info.tokenAmount.amount,
          };
        })
        .filter((token) => token.balance > 0);

      if (userTokens.length === 0) {
        setPositions([]);
        setPositionsLoading(false);
        return;
      }

      // Filter for prediction market tokens
      const allMintAddresses = userTokens.map((token) => token.mint);
      const outcomeMints = await filterOutcomeMints(allMintAddresses);

      if (outcomeMints.length === 0) {
        setPositions([]);
        setPositionsLoading(false);
        return;
      }

      // Fetch market details
      const marketsData = await fetchMarketsBatch(outcomeMints);

      // Create market map
      const marketsByMint = new Map<string, Market>();
      marketsData.forEach((market) => {
        if (market.accounts) {
          Object.values(market.accounts).forEach((account: any) => {
            if (account.yesMint) marketsByMint.set(account.yesMint, market);
            if (account.noMint) marketsByMint.set(account.noMint, market);
            if (account.marketLedger) marketsByMint.set(account.marketLedger, market);
          });
        }
        if (market.yesMint) marketsByMint.set(market.yesMint, market);
        if (market.noMint) marketsByMint.set(market.noMint, market);
      });

      // Map tokens to positions
      const userPositions: Position[] = userTokens
        .filter((token) => outcomeMints.includes(token.mint))
        .map((token) => {
          const marketData = marketsByMint.get(token.mint);
          if (!marketData) {
            return {
              mint: token.mint,
              balance: token.balance,
              decimals: token.decimals,
              position: 'UNKNOWN',
              market: null,
            };
          }

          const isYesToken = marketData.accounts
            ? Object.values(marketData.accounts).some(
                (account: any) => account.yesMint === token.mint
              )
            : marketData.yesMint === token.mint;

          const isNoToken = marketData.accounts
            ? Object.values(marketData.accounts).some(
                (account: any) => account.noMint === token.mint
              )
            : marketData.noMint === token.mint;

          return {
            mint: token.mint,
            balance: token.balance,
            decimals: token.decimals,
            position: isYesToken ? 'YES' : isNoToken ? 'NO' : 'UNKNOWN',
            market: marketData,
          };
        })
        .filter((pos) => pos.market && pos.market.status === 'active'); // Only active positions

      setPositions(userPositions);
    } catch (err: any) {
      console.error('Error loading positions:', err);
    } finally {
      setPositionsLoading(false);
    }
  };

  const loadMarkets = async () => {
    try {
      // Get unique market tickers from trades and positions
      const tradeTickers = Array.from(new Set(trades.map(t => t.marketTicker)));
      const positionTickers = Array.from(new Set(
        positions.map(p => p.market?.ticker).filter(Boolean) as string[]
      ));
      const allTickers = [...tradeTickers, ...positionTickers];
      
      // Fetch all markets to get their status
      const allMarkets = await fetchMarkets(200);
      const marketMap = new Map<string, Market>();
      
      allMarkets.forEach(market => {
        if (allTickers.includes(market.ticker)) {
          marketMap.set(market.ticker, market);
        }
      });
      
      // Also add markets from positions
      positions.forEach(pos => {
        if (pos.market) {
          marketMap.set(pos.market.ticker, pos.market);
        }
      });
      
      setMarkets(marketMap);
    } catch (err) {
      console.error('Error loading markets:', err);
    }
  };

  const isMarketActive = (marketTicker: string): boolean => {
    const market = markets.get(marketTicker);
    if (!market) return false; // If market not found, assume inactive
    
    return market.status === 'active';
  };

  const activeTrades = trades.filter(trade => isMarketActive(trade.marketTicker));
  const previousTrades = trades.filter(trade => !isMarketActive(trade.marketTicker));
  
  // Combine active trades with positions for the active tab
  const activeItems = activeTab === 'active' 
    ? [
        ...activeTrades.map(trade => ({ type: 'trade' as const, data: trade })),
        ...positions.map(pos => ({ type: 'position' as const, data: pos }))
      ]
    : previousTrades.map(trade => ({ type: 'trade' as const, data: trade }));

  // Log active trades for debugging
  useEffect(() => {
    if (trades.length > 0 && markets.size > 0) {
      const active = trades.filter(trade => isMarketActive(trade.marketTicker));
      const previous = trades.filter(trade => !isMarketActive(trade.marketTicker));
      console.log('Active trades fetched:', {
        total: trades.length,
        active: active.length,
        previous: previous.length,
      });
    }
  }, [trades, markets]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (amount: string) => {
    // Amount is stored in smallest units (USDC has 6 decimals)
    const num = parseFloat(amount) / 1_000_000; // Convert from smallest units to USDC
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`;
    }
    if (num >= 1000) {
      return `$${(num / 1000).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
  };

  if (loading || positionsLoading) {
    return (
      <div className="bg-[var(--surface)]/50 backdrop-blur-sm border border-[var(--border-color)] rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="backdrop-blur-sm border rounded-2xl p-6">
        <p className="text-red-400 text-center py-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-sm rounded-2xl p-6">
      
      {/* Tabs */}
     
      <div className="flex gap-2 mb-6 border-b border-[var(--border-color)]">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-xl font-bold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'active'
              ? 'border-[var(--text-primary)] text-[var(--text-primary)]'
              : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          ACTIVE
          {(activeTrades.length > 0 || positions.length > 0) && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === 'active'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-[var(--surface-hover)] text-[var(--text-tertiary)]'
            }`}>
              {activeTrades.length + positions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('previous')}
          className={`px-4 py-2 font-bold text-xl transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'previous'
              ? 'border-red-400 text-red-400'
              : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          PREVIOUS
          {previousTrades.length > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === 'previous'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-[var(--surface-hover)] text-[var(--text-tertiary)]'
            }`}>
              {previousTrades.length}
            </span>
          )}
        </button>
      </div>

      {/* Trades and Positions List */}
      {activeItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--text-tertiary)]">
            No {activeTab === 'active' ? 'active' : 'previous'} trades found
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeItems.map((item, index) => {
            if (item.type === 'trade') {
              const trade = item.data;
              const market = markets.get(trade.marketTicker);
              const marketTitle = market?.title 
                ? formatMarketTitle(market.title, trade.marketTicker)
                : trade.marketTicker;

              return (
                <div
                  key={trade.id}
                  className="bg-[var(--card-bg)]/30 border border-[var(--border-color)] rounded-xl p-4 hover:border-cyan-500/30 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-lg ${
                            trade.side === 'yes'
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                          }`}
                        >
                          {trade.side.toUpperCase()}
                        </span>
                        {market && (
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-lg ${
                              market.status === 'active'
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'bg-[var(--surface-hover)] text-[var(--text-tertiary)] border border-[var(--border-color)]'
                            }`}
                          >
                            {market.status}
                          </span>
                        )}
                      </div>
                      <h4 className="text-[var(--text-primary)] font-semibold mb-1">{marketTitle}</h4>
                      <p className="text-[var(--text-tertiary)] text-xs font-mono mb-2">{trade.marketTicker}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-[var(--text-secondary)]">
                          Amount: <span className="text-[var(--text-primary)] font-semibold font-number">{formatAmount(trade.amount)}</span>
                        </span>
                        <span className="text-[var(--text-secondary)]">
                          {formatDate(trade.createdAt)}
                        </span>
                      </div>
                    </div>
                    <a
                      href={`https://solscan.io/tx/${trade.transactionSig}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 p-2 text-[var(--text-tertiary)] hover:text-cyan-400 transition-colors"
                      title="View on Solscan"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              );
            } else {
              const position = item.data;
              const market = position.market;
              const marketTitle = market?.title 
                ? formatMarketTitle(market.title, market.ticker)
                : market?.ticker || 'Unknown Market';

              return (
                <div
                  key={position.mint}
                  className="bg-[var(--card-bg)]/30 border border-[var(--border-color)] rounded-xl p-4 hover:border-cyan-500/30 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-lg ${
                            position.position === 'YES'
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : position.position === 'NO'
                              ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                              : 'bg-[var(--surface-hover)] text-[var(--text-tertiary)] border border-[var(--border-color)]'
                          }`}
                        >
                          {position.position}
                        </span>
                        {market && (
                          <span className="px-2 py-1 text-xs font-medium rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            {market.status}
                          </span>
                        )}
                      </div>
                      <h4 className="text-[var(--text-primary)] font-semibold mb-1">{marketTitle}</h4>
                      {market?.ticker && (
                        <p className="text-[var(--text-tertiary)] text-xs font-mono mb-2">{market.ticker}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-[var(--text-secondary)]">
                          Balance: <span className="text-[var(--text-primary)] font-semibold font-number">{position.balance.toLocaleString()}</span> tokens
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
