'use client';

import { useState, useEffect } from 'react';
import { fetchMarkets, Market } from '../lib/api';
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

interface UserTradesProps {
  userId: string;
}

export default function UserTrades({ userId }: UserTradesProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'previous'>('active');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [markets, setMarkets] = useState<Map<string, Market>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrades();
  }, [userId]);

  useEffect(() => {
    if (trades.length > 0) {
      loadMarkets();
    }
  }, [trades]);

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

  const loadMarkets = async () => {
    try {
      // Get unique market tickers from trades
      const tickers = Array.from(new Set(trades.map(t => t.marketTicker)));
      
      // Fetch all markets to get their status
      const allMarkets = await fetchMarkets(200);
      const marketMap = new Map<string, Market>();
      
      allMarkets.forEach(market => {
        if (tickers.includes(market.ticker)) {
          marketMap.set(market.ticker, market);
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
    
    return (
      market.status === 'active' &&
      market.status !== 'finalized' &&
      market.status !== 'resolved' &&
      market.status !== 'closed' &&
      market.status !== 'determined'
    );
  };

  const activeTrades = trades.filter(trade => isMarketActive(trade.marketTicker));
  const previousTrades = trades.filter(trade => !isMarketActive(trade.marketTicker));

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

  const displayTrades = activeTab === 'active' ? activeTrades : previousTrades;

  if (loading) {
    return (
      <div className="bg-[var(--surface)]/50 backdrop-blur-sm border border-[var(--border-color)] rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
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
          className={`px-4 py-2 text-xl font-bold transition-colors border-b-2 ${
            activeTab === 'active'
              ? 'border-[var(--text-primary)] text-[var(--text-primary)]'
              : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
         ACTIVE 
        </button>
        <button
          onClick={() => setActiveTab('previous')}
          className={`px-4 py-2 font-bold text-xl transition-colors border-b-2 ${
            activeTab === 'previous'
              ? 'border-[var(--text-primary)] text-[var(--text-primary)]'
              : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          PREVIOUS 
        </button>
      </div>

      {/* Trades List */}
      {displayTrades.length === 0 ? (
        <div className="text-center py-12">
         
          <p className="text-[var(--text-tertiary)]">
            No {activeTab === 'active' ? 'active' : 'previous'} trades found
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayTrades.map((trade) => {
            const market = markets.get(trade.marketTicker);
            const marketTitle = market?.title 
              ? formatMarketTitle(market.title, trade.marketTicker)
              : trade.marketTicker;

            return (
              <div
                key={trade.id}
                className="bg-[var(--card-bg)]/30 border border-[var(--border-color)] rounded-xl p-4 hover:border-violet-500/30 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-lg ${
                          trade.side === 'yes'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {trade.side.toUpperCase()}
                      </span>
                      {market && (
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-lg ${
                            market.status === 'active'
                              ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
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
                        Amount: <span className="text-[var(--text-primary)] font-semibold">{formatAmount(trade.amount)}</span>
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
                    className="ml-4 p-2 text-[var(--text-tertiary)] hover:text-violet-400 transition-colors"
                    title="View on Solscan"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
