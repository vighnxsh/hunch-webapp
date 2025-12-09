'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchEventDetails, fetchMarketDetails, EventDetails, Market } from '../../lib/api';
import TradeMarket from '../../components/TradeMarket';
import ShareBlink from '../../components/ShareBlink';
import MarketProbabilitiesDisplay from '../../components/MarketProbabilities';
import { parseMarketTicker, formatMarketTitle } from '../../lib/marketUtils';

export default function EventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params?.eventId as string;
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [detailedMarkets, setDetailedMarkets] = useState<Map<string, Market>>(new Map());
  const [loadingMarkets, setLoadingMarkets] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;

    const loadEventDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const details = await fetchEventDetails(eventId);
        setEventDetails(details);
        
        // Fetch detailed info for each market
        if (details.markets && details.markets.length > 0) {
          const activeMarkets = details.markets.filter(
            (m: Market) => m.status !== 'finalized' && m.status !== 'resolved' && m.status !== 'closed'
          );
          
          // Fetch detailed market info for each active market
          activeMarkets.forEach(async (market: Market) => {
            if (market.ticker) {
              setLoadingMarkets(prev => new Set(prev).add(market.ticker));
              try {
                const detailedMarket = await fetchMarketDetails(market.ticker);
                setDetailedMarkets(prev => {
                  const newMap = new Map(prev);
                  newMap.set(market.ticker, detailedMarket);
                  return newMap;
                });
              } catch (err) {
                console.error(`Failed to fetch details for market ${market.ticker}:`, err);
                // Keep the original market data if detailed fetch fails
                setDetailedMarkets(prev => {
                  const newMap = new Map(prev);
                  if (!newMap.has(market.ticker)) {
                    newMap.set(market.ticker, market);
                  }
                  return newMap;
                });
              } finally {
                setLoadingMarkets(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(market.ticker);
                  return newSet;
                });
              }
            }
          });
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load event details');
        console.error('Error loading event details:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEventDetails();
  }, [eventId]);

  const getMintAddress = (market: Market, type: 'yes' | 'no'): string | undefined => {
    if (market.accounts) {
      // Handle accounts as an object with string keys (like { "EPjF...": { yesMint: "...", ... } })
      if (typeof market.accounts === 'object' && !Array.isArray(market.accounts)) {
        // Check if accounts has direct yesMint/noMint (simple structure)
        if ('yesMint' in market.accounts && typeof (market.accounts as any).yesMint === 'string') {
          return type === 'yes' ? (market.accounts as any).yesMint : (market.accounts as any).noMint;
        }
        
        // Otherwise, iterate through account keys to find mints
        const accountKeys = Object.keys(market.accounts);
        for (const key of accountKeys) {
          const account = (market.accounts as any)[key];
          if (account && typeof account === 'object') {
            const mint = type === 'yes' ? account.yesMint : account.noMint;
            if (mint && typeof mint === 'string') {
              return mint;
            }
          }
        }
      }
    }
    return type === 'yes' ? market.yesMint : market.noMint;
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {/* Back Button */}
      

        {loading ? (
          <div className="space-y-4">
            <div className="h-8 bg-[var(--surface-hover)] rounded-lg animate-pulse" />
            <div className="h-4 bg-[var(--surface-hover)] rounded-lg animate-pulse w-3/4" />
            <div className="h-4 bg-[var(--surface-hover)] rounded-lg animate-pulse w-1/2" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400">Error: {error}</p>
          </div>
        ) : eventDetails ? (
          <div className="space-y-6">
            {/* Event Info */}
            <div className="bg-[var(--surface)]/50 backdrop-blur-sm border border-[var(--border-color)] rounded-2xl p-6 md:p-8">
              <p className="text-sm font-mono text-[var(--text-tertiary)] mb-2">
                {eventDetails.ticker}
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-2">
                {eventDetails.title}
              </h1>
              {eventDetails.subtitle && (
                <p className="text-[var(--text-secondary)] text-lg">
                  {eventDetails.subtitle}
                </p>
              )}
            </div>

            {/* Markets */}
            {eventDetails.markets && eventDetails.markets.length > 0 ? (
              <div className="bg-[var(--surface)]/50 backdrop-blur-sm border border-[var(--border-color)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                 
                  {/* <span className="px-3 py-1 bg-violet-500/20 text-violet-400 text-sm font-medium rounded-lg border border-violet-500/30">
                    {eventDetails.markets.filter((m: Market) => 
                      m.status !== 'finalized' && 
                      m.status !== 'resolved' && 
                      m.status !== 'closed'
                    ).length} active
                  </span> */}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {eventDetails.markets
                    .filter((market: Market) => 
                      market.status !== 'finalized' &&
                      market.status !== 'resolved' &&
                      market.status !== 'closed'
                    )
                    .map((market: Market, index: number) => {
                    // Use detailed market data if available, otherwise use basic market data
                    const detailedMarket = detailedMarkets.get(market.ticker) || market;
                    const marketData = detailedMarket;
                    const isLoadingDetails = loadingMarkets.has(market.ticker);
                    
                    const yesMint = getMintAddress(marketData, 'yes');
                    const noMint = getMintAddress(marketData, 'no');
                    
                    // Use subtitle instead of full title
                    const displayTitle = marketData.yesSubTitle || marketData.noSubTitle || marketData.subtitle || 'Market Option';
                    
                    // Calculate prices
                    const yesPrice = marketData.yesAsk ? Math.round(parseFloat(marketData.yesAsk) * 100) : null;
                    const noPrice = marketData.noAsk ? Math.round(parseFloat(marketData.noAsk) * 100) : null;

                    // Format dates
                    const formatDate = (timestamp?: number) => {
                      if (!timestamp) return null;
                      return new Date(timestamp * 1000).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      });
                    };

                    return (
                      <div
                        key={marketData.ticker || index}
                        className="p-4 bg-[var(--surface)] rounded-2xl hover:bg-[var(--surface-hover)] transition-all"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-[var(--text-primary)] text-lg leading-tight">
                              {displayTitle}
                            </h3>
                            {marketData.closeTime && (
                              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                Closes {formatDate(marketData.closeTime)}
                              </p>
                            )}
                          </div>
                          <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md flex-shrink-0 ${
                            marketData.status === 'active'
                              ? 'bg-green-500/15 text-green-400'
                              : 'bg-[var(--surface-hover)] text-[var(--text-tertiary)]'
                          }`}>
                            {marketData.status || 'unknown'}
                          </span>
                        </div>
                        
                        {/* Prices */}
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex-1 p-3 bg-green-500/10 rounded-xl text-center">
                            <div className="text-xs text-green-400 mb-1">Yes</div>
                            <div className="text-xl font-bold text-green-400">
                              {yesPrice !== null ? `${yesPrice}¢` : '—'}
                            </div>
                          </div>
                          <div className="flex-1 p-3 bg-red-500/10 rounded-xl text-center">
                            <div className="text-xs text-red-400 mb-1">No</div>
                            <div className="text-xl font-bold text-red-400">
                              {noPrice !== null ? `${noPrice}¢` : '—'}
                            </div>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)] mb-4">
                          {marketData.volume !== undefined && (
                            <div>
                              <span className="text-[var(--text-secondary)] font-medium">
                                ${(marketData.volume / 100).toLocaleString()}
                              </span>
                              {' '}vol
                            </div>
                          )}
                          {marketData.openInterest !== undefined && (
                            <div>
                              <span className="text-[var(--text-secondary)] font-medium">
                                ${(marketData.openInterest / 100).toLocaleString()}
                              </span>
                              {' '}open
                            </div>
                          )}
                        </div>

                        {isLoadingDetails && (
                          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-3">
                            <div className="h-3 w-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                            <span>Loading...</span>
                          </div>
                        )}
                       
                        {/* Trading Component and Share Blink */}
                        {marketData.status === 'active' && (
                          <div className="pt-3 border-t border-[var(--border-color)]/50 space-y-3">
                            <TradeMarket market={marketData} />
                            <ShareBlink market={marketData} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-[var(--surface)]/50 backdrop-blur-sm border border-[var(--border-color)] rounded-2xl p-6">
                <div className="p-6 bg-[var(--card-bg)]/30 border border-[var(--border-color)] rounded-xl text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-[var(--surface-hover)] rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-[var(--text-tertiary)]">
                    No markets found for this event.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}