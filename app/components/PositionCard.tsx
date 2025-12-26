'use client';

import { useRouter } from 'next/navigation';
import type { AggregatedPosition } from '../lib/positionService';
import { formatMarketTitle } from '../lib/marketUtils';

interface PositionCardProps {
  position: AggregatedPosition;
}

export default function PositionCard({ position }: PositionCardProps) {
  const router = useRouter();

  const handleClick = () => {
    // Redirect to event page if eventTicker exists, otherwise to market page
    if (position.market?.eventTicker) {
      router.push(`/event/${position.market.eventTicker}`);
    } else if (position.market?.ticker) {
      router.push(`/market/${position.market.ticker}`);
    }
  };

  // Format currency
  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number | null) => {
    if (value === null) return 'N/A';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // Get P&L color class
  const getPLColorClass = () => {
    if (position.profitLoss === null) return 'text-[var(--text-secondary)]';
    if (position.profitLoss > 0) return 'text-green-500';
    if (position.profitLoss < 0) return 'text-red-500';
    return 'text-[var(--text-secondary)]';
  };

  // Get side badge color
  const getSideBadgeClass = () => {
    return position.side === 'yes'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const eventTitle = position.market?.title || formatMarketTitle('', position.marketTicker);
  const marketSubtitle = position.side === 'yes' 
    ? position.market?.yesSubTitle 
    : position.market?.noSubTitle;

  // Get border color based on P&L
  const getBorderColorClass = () => {
    if (position.profitLoss === null) return 'border-[var(--border-color)]';
    if (position.profitLoss > 0) return 'border-green-500/30 hover:border-green-500/50';
    if (position.profitLoss < 0) return 'border-red-500/30 hover:border-red-500/50';
    return 'border-[var(--border-color)]';
  };

  return (
    <div
      onClick={handleClick}
      className={`p-4 rounded-xl bg-[var(--card-bg)] border ${getBorderColorClass()} hover:shadow-lg transition-all cursor-pointer group`}
    >
      <div className="flex items-start gap-3">
        {/* Event Image */}
        <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-[var(--border-color)]">
          {position.eventImageUrl ? (
            <img
              src={position.eventImageUrl}
              alt={eventTitle}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              onError={(e) => {
                // Fallback to icon if image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-2xl">📊</div>';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">
              📊
            </div>
          )}
        </div>

        {/* Position Details */}
        <div className="flex-1 min-w-0">
          {/* Event Title */}
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 truncate group-hover:text-cyan-400 transition-colors">
            {eventTitle}
          </h3>

          {/* Market Subtitle */}
          {marketSubtitle && (
            <p className="text-xs text-[var(--text-secondary)] mb-2 line-clamp-2">
              {marketSubtitle}
            </p>
          )}

          {/* Position Side Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${getSideBadgeClass()}`}>
              {position.side.toUpperCase()}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {position.tradeCount} trade{position.tradeCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Current Valuation and P&L */}
          <div className="space-y-2">
            {/* Current Value */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Current Value</span>
              <span className="text-base font-bold text-[var(--text-primary)]">
                {formatCurrency(position.currentValue)}
              </span>
            </div>

            {/* Profit/Loss with Percentage */}
            {position.profitLoss !== null && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)]">Profit/Loss</span>
                <div className="flex items-center gap-2">
                  <span className={`text-base font-bold ${getPLColorClass()}`}>
                    {position.profitLoss >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(position.profitLoss))}
                  </span>
                  {position.profitLossPercentage !== null && (
                    <span className={`text-sm font-semibold ${getPLColorClass()}`}>
                      ({formatPercentage(position.profitLossPercentage)})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Current Price (small, subtle) */}
            {position.currentPrice !== null && (
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border-color)]/50">
                <span className="text-xs text-[var(--text-secondary)]">Current Price</span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {formatCurrency(position.currentPrice)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Market Status Indicator */}
      {position.market?.status && (
        <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)]">Market Status</span>
            <span className={`font-medium ${
              position.market.status === 'active' || position.market.status === 'open'
                ? 'text-green-400'
                : 'text-[var(--text-secondary)]'
            }`}>
              {position.market.status.charAt(0).toUpperCase() + position.market.status.slice(1)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

