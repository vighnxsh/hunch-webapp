'use client';

import { useState, useEffect } from 'react';
import { fetchEventDetails, EventDetails, Market } from '../lib/api';
import TradeMarket from './TradeMarket';
import { parseMarketTicker, formatMarketTitle } from '../lib/marketUtils';

interface EventDetailsModalProps {
  eventTicker: string;
  onClose: () => void;
}

export default function EventDetailsModal({ eventTicker, onClose }: EventDetailsModalProps) {
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEventDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const details = await fetchEventDetails(eventTicker);
        setEventDetails(details);
      } catch (err: any) {
        setError(err.message || 'Failed to load event details');
        console.error('Error loading event details:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEventDetails();
  }, [eventTicker]);

  const getMintAddress = (market: Market, type: 'yes' | 'no'): string | undefined => {
    if (market.accounts) {
      return type === 'yes' ? market.accounts.yesMint : market.accounts.noMint;
    }
    return type === 'yes' ? market.yesMint : market.noMint;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Event Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400">Error: {error}</p>
            </div>
          ) : eventDetails ? (
            <div className="space-y-6">
              {/* Event Info */}
              <div>
                <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mb-2">
                  {eventDetails.ticker}
                </p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {eventDetails.title}
                </h3>
                {eventDetails.subtitle && (
                  <p className="text-gray-600 dark:text-gray-400">
                    {eventDetails.subtitle}
                  </p>
                )}
              </div>

              {/* Markets */}
              {eventDetails.markets && eventDetails.markets.length > 0 ? (
                <div>
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Related Markets ({eventDetails.markets.filter((m: Market) => 
                      m.status !== 'finalized' && 
                      m.status !== 'resolved' && 
                      m.status !== 'closed'
                    ).length})
                  </h4>
                  <div className="space-y-4">
                    {eventDetails.markets
                      .filter((market: Market) => 
                        market.status !== 'finalized' &&
                        market.status !== 'resolved' &&
                        market.status !== 'closed'
                      )
                      .map((market: Market, index: number) => {
                      const yesMint = getMintAddress(market, 'yes');
                      const noMint = getMintAddress(market, 'no');
                      const dateInfo = parseMarketTicker(market.ticker);
                      const displayTitle = formatMarketTitle(market.title || 'Untitled Market', market.ticker);

                      return (
                        <div
                          key={market.ticker || index}
                          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/30"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-900 dark:text-white mb-1">
                                {displayTitle}
                              </h5>
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
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {yesMint && (
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Yes Mint: </span>
                                <span className="font-mono text-xs text-gray-900 dark:text-white break-all">
                                  {yesMint}
                                </span>
                              </div>
                            )}
                            {noMint && (
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">No Mint: </span>
                                <span className="font-mono text-xs text-gray-900 dark:text-white break-all">
                                  {noMint}
                                </span>
                              </div>
                            )}
                            {market.volume !== undefined && (
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Volume: </span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {market.volume.toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Trading Component */}
                          {market.status === 'active' && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                              <TradeMarket market={market} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <p className="text-gray-600 dark:text-gray-400">
                    No markets found for this event.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

