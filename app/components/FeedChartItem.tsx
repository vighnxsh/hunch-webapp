'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { fetchCandlesticksByMint, fetchMarketDetails, fetchEventDetails, Market, EventDetails, CandlestickData } from '../lib/api';
import SocialPriceChart, { TradeEntry } from './SocialPriceChart';

interface FeedChartItemProps {
    trade: TradeEntry; // Single trade
    marketTicker: string;
    quote?: string | null; // Optional quote/comment from trader
}

// Helper to format time ago
function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
}

// Format amount from smallest unit
function formatAmount(amount: string) {
    const num = parseFloat(amount) / 1_000_000;
    if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toFixed(2);
}

// Helper to extract mint from market accounts
function getMintFromAccounts(market: Market, side: 'yes' | 'no'): string | null {
    // Determine which mint to retrieve based on the trade side
    const mintKey = side === 'yes' ? 'yesMint' : 'noMint';

    // First, check if the mint exists directly on the market object
    if (side === 'yes' && market.yesMint) {
        console.log(`[getMintFromAccounts] Using direct market.yesMint: ${market.yesMint}`);
        return market.yesMint;
    }
    if (side === 'no' && market.noMint) {
        console.log(`[getMintFromAccounts] Using direct market.noMint: ${market.noMint}`);
        return market.noMint;
    }

    // Fall back to checking the accounts structure
    const accounts = market.accounts;
    if (!accounts) {
        console.warn(`No ${mintKey} found on market and no accounts structure`, market);
        return null;
    }

    if (typeof accounts === 'object') {
        // Check direct structure first (accounts.yesMint or accounts.noMint)
        if (mintKey in accounts && typeof (accounts as any)[mintKey] === 'string') {
            console.log(`[getMintFromAccounts] Using accounts.${mintKey}: ${(accounts as any)[mintKey]}`);
            return (accounts as any)[mintKey];
        }

        // Iterate through nested collateral entries (e.g., CASH, USDC)
        // Each collateral type has its own yesMint and noMint
        const collateralKeys = Object.keys(accounts);
        for (const collateralKey of collateralKeys) {
            const entry = (accounts as any)[collateralKey];
            if (entry && typeof entry === 'object') {
                // Check if this entry has the specific mint we're looking for
                if (mintKey in entry && typeof entry[mintKey] === 'string') {
                    const mintValue = entry[mintKey];
                    console.log(`[getMintFromAccounts] Found ${mintKey} in collateral ${collateralKey}: ${mintValue}`);
                    return mintValue;
                }
            }
        }
    }

    console.warn(`Could not find ${mintKey} in market for side ${side}`, {
        yesMint: market.yesMint,
        noMint: market.noMint,
        accounts
    });
    return null;
}

export default function FeedChartItem({ trade, marketTicker, quote }: FeedChartItemProps) {
    const router = useRouter();
    const [market, setMarket] = useState<Market | null>(null);
    const [event, setEvent] = useState<EventDetails | null>(null);
    const [candlesticks, setCandlesticks] = useState<CandlestickData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch market, event, and candlestick data based on trade side
    useEffect(() => {
        let mounted = true;

        async function loadData() {
            try {
                setLoading(true);
                setError(null);

                // 1. Fetch market details
                const marketData = await fetchMarketDetails(marketTicker);
                if (!mounted) return;
                setMarket(marketData);

                // 2. Fetch event details if available
                if (marketData.eventTicker) {
                    try {
                        const eventData = await fetchEventDetails(marketData.eventTicker);
                        if (mounted) setEvent(eventData);
                    } catch (e) {
                        console.warn('Failed to fetch event details:', e);
                    }
                }

                // 3. Use the correct mint based on trade side
                const tradeSide = trade.side as 'yes' | 'no';
                const mint = getMintFromAccounts(marketData, tradeSide);

                console.log(`[FeedChartItem] Trade side: ${tradeSide}, Mint: ${mint}`);

                if (mint) {
                    // Get last 7 days of data with hourly intervals for smooth chart
                    const now = Math.floor(Date.now() / 1000);
                    const oneWeekAgo = now - 7 * 24 * 60 * 60;

                    const candleData = await fetchCandlesticksByMint(mint, {
                        startTs: oneWeekAgo,
                        endTs: now,
                        periodInterval: 60, // Hourly intervals for smooth chart
                    });

                    if (mounted && candleData.candlesticks) {
                        setCandlesticks(candleData.candlesticks);
                    }
                } else {
                    console.error(`[FeedChartItem] No mint found for trade side: ${tradeSide}`);
                }


                setLoading(false);
            } catch (err: any) {
                console.error('Error loading feed chart data:', err);
                if (mounted) {
                    setError(err.message || 'Failed to load data');
                    setLoading(false);
                }
            }
        }

        loadData();
        return () => { mounted = false; };
    }, [marketTicker, trade.side]);

    // Display name for trader
    const displayName = trade.user.displayName ||
        `${trade.user.walletAddress.slice(0, 4)}...${trade.user.walletAddress.slice(-4)}`;

    // Get contextual market labels
    // yesSubTitle/noSubTitle are what the user "predicted" (e.g., "Los Angeles R")
    const predictionLabel = trade.side === 'yes'
        ? (market?.yesSubTitle || 'Yes')
        : (market?.noSubTitle || 'No');
    // Event title for the chart card header (e.g., "Pro Football Championship")
    const eventTitle = event?.title || market?.title || marketTicker;
    const eventImage = event?.imageUrl;

    // Calculate current price from last candlestick
    const currentPrice = candlesticks.length > 0
        ? candlesticks[candlesticks.length - 1].price.close
        : null;

    // Handle click to navigate to event
    const handleClick = () => {
        if (market?.eventTicker) {
            router.push(`/event/${encodeURIComponent(market.eventTicker)}`);
        }
    };

    // Navigate to user profile
    const handleUserClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        router.push(`/user/${trade.userId}`);
    };

    // Loading state
    if (loading) {
        return (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)]/60 overflow-hidden">
                <div className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--surface-hover)] animate-pulse" />
                    <div className="flex-1">
                        <div className="h-4 w-2/3 bg-[var(--surface-hover)] rounded animate-pulse mb-2" />
                        <div className="h-3 w-1/3 bg-[var(--surface-hover)] rounded animate-pulse" />
                    </div>
                </div>
                <div className="h-[140px] bg-[var(--surface-hover)]/50 animate-pulse mx-4 rounded-xl" />
                <div className="p-4 flex gap-4">
                    <div className="h-8 w-16 bg-[var(--surface-hover)] rounded animate-pulse" />
                    <div className="h-8 w-16 bg-[var(--surface-hover)] rounded animate-pulse" />
                </div>
            </div>
        );
    }

    // Error state
    if (error || candlesticks.length === 0) {
        return null; // Silent fail for chart items without data
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)]/60 backdrop-blur-sm overflow-hidden"
        >
            {/* Header - Trade Action */}
            <div className="p-4 pb-3 flex items-center gap-3">
                {/* User Avatar */}
                <button
                    onClick={handleUserClick}
                    className="flex-shrink-0 hover:opacity-80 transition-opacity"
                >
                    <img
                        src={trade.user.avatarUrl || '/default.png'}
                        alt={displayName}
                        className="w-10 h-10 rounded-full"
                    />
                </button>

                {/* Trade Description - Subtle & Contextual */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)]">
                        <button
                            onClick={handleUserClick}
                            className="font-semibold hover:text-cyan-400 transition-colors"
                        >
                            {displayName}
                        </button>
                        <span className="text-[var(--text-secondary)]"> took </span>
                        <span className={`font-semibold ${trade.side === 'yes' ? 'text-cyan-400' : 'text-pink-400'}`}>
                            {trade.side.toUpperCase()}
                        </span>
                        <span className="text-[var(--text-secondary)]"> on </span>
                        <span className="font-medium text-[var(--text-primary)]">
                            {predictionLabel}
                        </span>
                    </p>
                </div>

                {/* Time */}
                <span className="flex-shrink-0 text-xs text-[var(--text-tertiary)]">
                    {formatTimeAgo(trade.createdAt)}
                </span>
            </div>

            {/* Quote Display - Highlighted */}
            {quote && quote.trim().length > 0 && (
                <div className="mx-4 mb-3 px-4 py-3 bg-gradient-to-r from-cyan-500/10 to-transparent border-l-3 border-cyan-400 rounded-r-lg">
                    <p className="text-[var(--text-primary)] text-sm font-medium italic">
                        "{quote}"
                    </p>
                </div>
            )}

            {/* Chart Card */}

            <div
                onClick={handleClick}
                className="mx-4 rounded-xl bg-transparent overflow-hidden cursor-pointer hover:bg-white/[0.02] transition-all group"
            >
                {/* Chart Header - Event & Market Context */}
                <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Event Image or Side Icon */}
                        {eventImage ? (
                            <img
                                src={eventImage}
                                alt=""
                                className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                            />
                        ) : (
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${trade.side === 'yes'
                                ? 'bg-gradient-to-br from-cyan-500/20 to-teal-500/20 text-cyan-400'
                                : 'bg-gradient-to-br from-pink-500/20 to-fuchsia-500/20 text-pink-400'
                                }`}>
                                {trade.side === 'yes' ? '✓' : '✗'}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-[var(--text-tertiary)] truncate">{eventTitle}</p>
                            <p className={`text-sm font-semibold truncate ${trade.side === 'yes' ? 'text-cyan-400' : 'text-pink-400'}`}>
                                {predictionLabel}
                            </p>
                        </div>
                    </div>

                    {/* Current Price */}
                    {currentPrice !== null && (
                        <div className="text-right flex-shrink-0 ml-2">
                            <p className="text-base font-bold text-[var(--text-primary)] font-number">
                                {currentPrice}¢
                            </p>
                            <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Current</p>
                        </div>
                    )}
                </div>

                {/* Probability Chart */}
                <div className="px-1 pb-2">
                    <SocialPriceChart
                        candlesticks={candlesticks}
                        trades={[trade]}
                        height={110}
                        lineColor="#5b8def"
                    />
                </div>
            </div>

            {/* Footer - Social Actions */}
            <div className="p-4 pt-3 flex items-center gap-6">
                {/* Comments placeholder */}
                <button className="flex items-center gap-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="text-xs font-medium">0</span>
                </button>

                {/* Volume */}
                <div className="flex items-center gap-1.5 text-[var(--text-tertiary)]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-xs font-medium font-number">${formatAmount(trade.amount)}</span>
                </div>

                {/* Share */}
                <button className="flex items-center gap-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                </button>
            </div>
        </motion.div>
    );
}
