'use client';

import { useState, useEffect } from 'react';
import { fetchMarkets, Market } from '../lib/api';
import TradeMarket from './TradeMarket';
import { parseMarketTicker, formatMarketTitle } from '../lib/marketUtils';

export default function MarketsList() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);

  useEffect(() => {
    const loadMarkets = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchMarkets(200);
        // Filter out finalized/resolved/closed markets
        const activeMarkets = data.filter(
          (market) =>
            market.status !== 'finalized' &&
            market.status !== 'resolved' &&
            market.status !== 'closed'
        );
        setMarkets(activeMarkets);
      } catch (err: any) {
        setError(err.message || 'Failed to load markets');
        console.error('Error loading markets:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMarkets();
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Markets
        </h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Markets
        </h2>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Markets ({markets.length})
      </h2>
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {markets.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">
            No markets found
          </p>
        ) : (
          markets.map((market, index) => {
            const dateInfo = parseMarketTicker(market.ticker);
            const displayTitle = formatMarketTitle(market.title || 'Untitled Market', market.ticker);
            
            return (
            <div
              key={market.ticker || index}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {displayTitle}
                  </h3>
                  {dateInfo.formattedDate && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                      📅 {dateInfo.formattedDate}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {market.ticker}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    market.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : market.status === 'resolved'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {market.status || 'unknown'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                {market.volume !== undefined && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Volume: </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {market.volume.toLocaleString()}
                    </span>
                  </div>
                )}
                {market.yesMint && (
                  <div className="truncate">
                    <span className="text-gray-600 dark:text-gray-400">Yes Mint: </span>
                    <span className="font-mono text-xs text-gray-900 dark:text-white">
                      {market.yesMint.slice(0, 8)}...
                    </span>
                  </div>
                )}
                {market.noMint && (
                  <div className="truncate">
                    <span className="text-gray-600 dark:text-gray-400">No Mint: </span>
                    <span className="font-mono text-xs text-gray-900 dark:text-white">
                      {market.noMint.slice(0, 8)}...
                    </span>
                  </div>
                )}
              </div>
              {market.status === 'active' && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setSelectedMarket(selectedMarket?.ticker === market.ticker ? null : market)}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  >
                    {selectedMarket?.ticker === market.ticker ? 'Hide Trading' : 'Trade This Market'}
                  </button>
                  {selectedMarket?.ticker === market.ticker && (
                    <div className="mt-4">
                      <TradeMarket market={market} />
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}

