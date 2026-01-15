'use client';

import Link from 'next/link';

interface NewsMarketBadgeProps {
  eventTicker?: string;
  marketTicker?: string;
  relevanceScore: number;
  compact?: boolean;
}

export default function NewsMarketBadge({
  eventTicker,
  marketTicker,
  relevanceScore,
  compact = false,
}: NewsMarketBadgeProps) {
  const ticker = marketTicker || eventTicker;
  const href = marketTicker ? `/market/${marketTicker}` : `/event/${eventTicker}`;

  const getRelevanceColor = (score: number) => {
    if (score >= 0.85) return 'bg-green-500/20 border-green-500/50 text-green-400';
    if (score >= 0.75) return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
    return 'bg-orange-500/20 border-orange-500/50 text-orange-400';
  };

  if (!ticker) return null;

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded border transition-colors hover:opacity-80 ${
        compact ? 'text-xs' : 'text-sm'
      } ${getRelevanceColor(relevanceScore)}`}
    >
      <span className="font-medium">{ticker}</span>
      <span className="opacity-70">
        {Math.round(relevanceScore * 100)}%
      </span>
    </Link>
  );
}

