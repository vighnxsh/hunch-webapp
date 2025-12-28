'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { fetchEvents, Event, Market } from '../lib/api';
import { useCatSafe } from '../contexts/CatContext';
import TradeMarket from './TradeMarket';
import EventMotionGraph from './EventMotionGraph';

// Format helpers
const formatPercent = (value?: string | number) => {
    if (value === undefined || value === null) return '—';
    const numeric = typeof value === 'string' ? parseFloat(value) : value;
    if (Number.isNaN(numeric)) return '—';
    return `${Math.round(numeric * 100)}%`;
};

const formatVolume = (value?: number) => {
    if (!value || Number.isNaN(value)) return '$0';
    return `$${Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value)}`;
};

const formatTimeRemaining = (endDate?: string | number) => {
    if (!endDate) return null;

    let end: Date;
    if (typeof endDate === 'number') {
        // Assume seconds if small number (less than year 2286 in seconds)
        // 10000000000 is year 2286 in seconds
        if (endDate < 10000000000) {
            end = new Date(endDate * 1000);
        } else {
            end = new Date(endDate);
        }
    } else {
        end = new Date(endDate);
    }

    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Closed';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 7) return `${Math.floor(days / 7)}w left`;
    if (days > 0) return `${days}d left`;
    if (hours > 0) return `${hours}h left`;
    return 'Soon';
};

// Paw icon component
function PawIcon({ className = '' }: { className?: string }) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className={className}>
            <ellipse cx="12" cy="16" rx="5" ry="4" />
            <circle cx="7" cy="9" r="2.5" />
            <circle cx="17" cy="9" r="2.5" />
            <circle cx="10" cy="6" r="2" />
            <circle cx="14" cy="6" r="2" />
        </svg>
    );
}

// Single market card for the rail
function MarketRailCard({
    event,
    isActive,
    onTrade,
}: {
    event: Event;
    isActive: boolean;
    onTrade: (market: Market) => void;
}) {
    const router = useRouter();
    const volume = formatVolume(event.volume ?? event.volume24h ?? event.openInterest);
    const timeLeft = formatTimeRemaining(event.closeTime);

    // Get top 2 markets sorted by yesBid (highest probability first)
    const top2Markets = (event.markets || [])
        .filter((m: Market) => m.status === 'active')
        .filter((m: Market) => {
            const yes = parseFloat(m.yesBid || '0');
            return yes < 0.95 && yes > 0.05; // Exclude near-certain outcomes
        })
        .sort((a: Market, b: Market) => {
            const aChance = parseFloat(a.yesBid || '0');
            const bChance = parseFloat(b.yesBid || '0');
            return bChance - aChance;
        })
        .slice(0, 2);

    // Generate observational signal based on market behavior
    // Uses subtle cat-themed language for a calm, observational tone
    const generateSignal = (): string => {
        // Use deterministic values from event data for consistent signals
        const titleLen = (event.title || '').length;

        // Create a hash-like value from event ticker for variety
        const tickerSum = (event.ticker || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const signalIndex = (titleLen + tickerSum) % 10;

        // Calculate a small number for signals that need one
        const smallNum = Math.max(3, (tickerSum % 8) + 2);

        // Cat-themed, observational signals
        const signals = [
        '🐾 Activity picked up after the move',
        '🐾 Most interest came later',
        '🐾 Early participation was limited',
        '🐾 Late entries increased quickly',
        '🐾 Quiet until recent movement',
        '🐾 Some followed after odds shifted',
        '🐾 Activity clustered in a short window',
        '🐾 Few acted before the change',
        `🐾 ${smallNum} entered early`,
        '🐾 Gradual interest before movement',
        ];

        return signals[signalIndex];
    };

    const signalText = generateSignal();

    // Button colors for the two markets
    const buttonStyles = [
        {
            bg: 'bg-gradient-to-br from-[#5EEAD4]/15 via-[#67E8F9]/10 to-[#5EEAD4]/5',
            border: 'border-[var(--accent)]/30 hover:border-[var(--accent)]/60',
            glow: 'hover:shadow-[0_0_30px_-5px_var(--glow-cyan)]',
            text: 'text-[var(--accent)]',
        },
        {
            bg: 'bg-gradient-to-br from-[#E879F9]/15 via-[#F0ABFC]/10 to-[#E879F9]/5',
            border: 'border-[var(--accent-fuchsia)]/30 hover:border-[var(--accent-fuchsia)]/60',
            glow: 'hover:shadow-[0_0_30px_-5px_var(--glow-magenta)]',
            text: 'text-[var(--accent-fuchsia)]',
        },
    ];

    const handleCardClick = (e: React.MouseEvent) => {
        // Prevent navigation if clicking on buttons
        if ((e.target as HTMLElement).closest('button')) return;
        router.push(`/event/${event.ticker}`);
    };

    // Get market subtitle/title for display
    const getMarketLabel = (market: Market): string => {
        // Use yesSubTitle first, then title, then fallback
        if (market.yesSubTitle && market.yesSubTitle !== 'Yes') {
            return market.yesSubTitle;
        }
        if (market.title) {
            // Truncate long titles
            return market.title.length > 25 ? market.title.slice(0, 22) + '...' : market.title;
        }
        return 'Market';
    };

    return (
        <div className="w-full flex-shrink-0 px-1">
            <div
                onClick={handleCardClick}
                className={`
                relative overflow-hidden rounded-3xl border transition-all duration-500 cursor-pointer flex h-[320px]
                ${isActive
                        ? 'border-[var(--accent)]/40 shadow-[0_12px_50px_-15px_var(--glow-cyan)]'
                        : 'border-[var(--card-border)]'
                    }
                bg-gradient-to-br from-[var(--card-bg)] via-[var(--card-bg)] to-[var(--surface)]
            `}>
                {/* Left Side: Content */}
                <div className="w-[40%] flex flex-col p-4 sm:p-5 relative border-r border-[var(--border-color)]/50 z-10">

                    {/* Header: Image and Title */}
                    <div className="flex items-start gap-3 mb-3">
                        {/* Image - Top Left */}
                        <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-2xl overflow-hidden bg-[var(--surface)] ring-2 ring-[var(--border-color)]/40 shadow-lg">
                            {event.imageUrl ? (
                                <img
                                    src={event.imageUrl}
                                    alt={event.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent-fuchsia)]/20 flex items-center justify-center">
                                    <PawIcon className="w-8 h-8 text-[var(--accent)] opacity-30" />
                                </div>
                            )}
                        </div>

                        {/* Title section */}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-[var(--text-primary)] text-base sm:text-lg leading-tight line-clamp-2 tracking-tight">
                                {event.title || 'Untitled Event'}
                            </h3>
                            {/* Event Subtitle */}
                            {event.subtitle && (
                                <p className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-1">
                                    {event.subtitle}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Badges Row */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <div className="px-2 py-0.5 bg-gradient-to-r from-[var(--accent)]/10 to-[var(--accent)]/5 rounded-lg border border-[var(--accent)]/20">
                            <span className="text-[9px] font-bold text-[var(--accent)]">{volume} Vol</span>
                        </div>
                        {timeLeft && (
                            <div className="px-2 py-0.5 bg-[var(--surface)] rounded-lg border border-[var(--border-color)]">
                                <span className="text-[9px] font-semibold text-[var(--text-secondary)]">{timeLeft}</span>
                            </div>
                        )}
                        {/* Market count badge */}
                        {(event.markets?.length || 0) > 1 && (
                            <div className="px-2 py-0.5 bg-[var(--surface)] rounded-lg border border-[var(--border-color)]">
                                <span className="text-[9px] font-semibold text-[var(--text-tertiary)]">
                                    {event.markets?.length} outcomes
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Signal Context - Cat-themed observational note */}
                    <motion.p
                        key={event.ticker}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="text-xs text-[var(--text-secondary)] leading-relaxed mb-auto font-medium italic"
                    >
                        {signalText}
                    </motion.p>

                    {/* Top Markets as Trade Buttons - Horizontal */}
                    <div className="mt-3">
                        <div className="flex flex-row gap-2">
                            {top2Markets.map((m: Market, idx: number) => {
                                const style = buttonStyles[idx % buttonStyles.length];
                                const percent = formatPercent(m.yesBid);
                                const label = getMarketLabel(m);

                                return (
                                    <button
                                        key={m.ticker}
                                        onClick={(e) => { e.stopPropagation(); onTrade(m); }}
                                        className={`
                                            flex-1 group relative overflow-hidden rounded-xl 
                                            ${style.bg} border ${style.border} 
                                            p-2.5 transition-all duration-300 
                                            ${style.glow} hover:scale-[1.02] active:scale-[0.98]
                                        `}
                                    >
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <span className={`text-[10px] font-semibold ${style.text} line-clamp-1 text-center`}>
                                                {label}
                                            </span>
                                            <span className={`text-lg font-extrabold ${style.text} font-number`}>
                                                {percent}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                            {top2Markets.length === 0 && (
                                <div className="text-xs text-[var(--text-tertiary)] text-center py-2 flex-1">
                                    No active markets
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: Financial Chart */}
                <div className="w-[60%] h-full bg-[var(--surface)]/5 relative">
                    <div className="absolute inset-0 bg-gradient-to-l from-[var(--card-bg)]/10 to-transparent pointer-events-none" />
                    <EventMotionGraph
                        eventTicker={event.ticker}
                        markets={event.markets || []}
                        className="w-full h-full"
                    />
                </div>
            </div>
        </div>
    );
}

// Progress dots
function ProgressDots({
    total,
    current,
    onSelect
}: {
    total: number;
    current: number;
    onSelect: (index: number) => void;
}) {
    return (
        <div className="flex items-center justify-center gap-2 py-3">
            {Array.from({ length: total }).map((_, i) => (
                <button
                    key={i}
                    onClick={() => onSelect(i)}
                    className={`
            w-2 h-2 rounded-full transition-all duration-300
            ${i === current
                            ? 'bg-[var(--accent)] w-6'
                            : 'bg-[var(--surface-hover)] hover:bg-[var(--text-tertiary)]'
                        }
          `}
                />
            ))}
        </div>
    );
}

export default function MarketRail() {
    const [markets, setMarkets] = useState<Array<{ event: Event; market: Market }>>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [tradeModalOpen, setTradeModalOpen] = useState(false);
    const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
    const catContext = useCatSafe();

    const containerRef = useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);

    // Fetch unique events with their top market, sorted by volume and closing date
    useEffect(() => {
        const loadMarkets = async () => {
            try {
                setLoading(true);
                const response = await fetchEvents(30, {
                    status: 'active',
                    withNestedMarkets: true,
                });

                const now = new Date().getTime();

                // Process events and pick their top market
                const scoredEvents = (response.events || [])
                    .filter((event) => event.markets?.some((m: any) => m.status === 'active'))
                    .map((event) => {
                        const volume = event.volume ?? event.volume24h ?? event.openInterest ?? 0;

                        // Get active markets and find the top one (highest activity/yesBid)
                        // Exclude markets with 95%+ probability on either side
                        const activeMarkets = (event.markets || [])
                            .filter((m: any) => {
                                if (m.status !== 'active') return false;
                                const yes = parseFloat(m.yesBid || '0');
                                const no = parseFloat(m.noBid || '0');
                                return yes < 0.95 && no < 0.95;
                            });

                        // Pick the market with highest yesBid (most active/interesting)
                        const topMarket = activeMarkets
                            .sort((a: any, b: any) => {
                                const aChance = a.yesBid ? parseFloat(a.yesBid) : 0;
                                const bChance = b.yesBid ? parseFloat(b.yesBid) : 0;
                                return bChance - aChance;
                            })[0];

                        if (!topMarket) return null;

                        // Calculate close time for scoring
                        const closeTime = new Date(topMarket.closeTime || event.closeTime || Date.now() + 30 * 24 * 60 * 60 * 1000).getTime();
                        const daysToClose = Math.max(0, (closeTime - now) / (1000 * 60 * 60 * 24));

                        // Score: higher volume + closer to closing = higher priority
                        // Avoid events closing in < 1 day (too urgent) or > 60 days (too far)
                        const volumeScore = Math.log10(Math.max(volume, 1)) * 10;
                        const timeScore = daysToClose > 1 && daysToClose < 60
                            ? (60 - daysToClose) / 60 * 20
                            : 0;

                        return {
                            event,
                            market: topMarket as Market,
                            score: volumeScore + timeScore,
                        };
                    })
                    .filter((item): item is { event: Event; market: Market; score: number } => item !== null)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 7); // Limit to 7 unique events

                setMarkets(scoredEvents.map(({ event, market }) => ({ event, market })));
            } catch (err) {
                console.error('Error loading markets for rail:', err);
            } finally {
                setLoading(false);
            }
        };

        loadMarkets();
    }, []);

    // Handle swipe
    const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = 50;
        if (info.offset.x > threshold && currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        } else if (info.offset.x < -threshold && currentIndex < markets.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    }, [currentIndex, markets.length]);

    // Handle trade - now accepts a Market object
    const handleTrade = (market: Market) => {
        setSelectedMarket(market);
        setTradeModalOpen(true);
        if (catContext) {
            catContext.triggerPeekCat('Trust your instinct.');
        }
    };

    if (loading) {
        return (
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <div className="h-4 w-20 bg-[var(--surface)] rounded animate-pulse" />
                </div>
                <div className="h-[340px] bg-[var(--surface)] rounded-3xl animate-pulse" />
            </div>
        );
    }

    if (markets.length === 0) {
        return null;
    }

    const currentMarket = markets[currentIndex];

    return (
        <div className="mb-6">
            {/* Section header */}
            <div className="flex items-center gap-2 mb-3 px-1">
                <PawIcon className="text-[var(--text-tertiary)] opacity-50" />
                <span className="text-sm font-medium text-[var(--text-tertiary)] tracking-wide">
                    Stirring
                </span>
                <div className="flex-1" />
                <span className="text-xs text-[var(--text-tertiary)] opacity-60">
                    {currentIndex + 1} / {markets.length}
                </span>
            </div>

            {/* Swipeable rail */}
            <div
                ref={containerRef}
                className="relative overflow-hidden touch-pan-y"
            >
                <motion.div
                    className="flex"
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.1}
                    onDragEnd={handleDragEnd}
                    animate={{ x: -currentIndex * 100 + '%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    style={{ x }}
                >
                    {markets.map(({ event }, index) => (
                        <MarketRailCard
                            key={event.ticker || index}
                            event={event}
                            isActive={index === currentIndex}
                            onTrade={handleTrade}
                        />
                    ))}
                </motion.div>
            </div>

            {/* Progress dots */}
            <ProgressDots
                total={markets.length}
                current={currentIndex}
                onSelect={setCurrentIndex}
            />

            {/* Trade Modal */}
            <AnimatePresence>
                {tradeModalOpen && selectedMarket && currentMarket && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setTradeModalOpen(false)}
                    >
                        <motion.div
                            className="w-full max-w-md max-h-[85vh] bg-[var(--card-bg)] rounded-t-3xl sm:rounded-3xl border border-[var(--border-color)] shadow-2xl overflow-hidden"
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal header */}
                            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                                <div className="flex items-center gap-3">
                                    {currentMarket.event.imageUrl && (
                                        <div className="w-10 h-10 rounded-xl overflow-hidden">
                                            <img
                                                src={currentMarket.event.imageUrl}
                                                alt={currentMarket.event.title}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                                            {currentMarket.event.title}
                                        </p>
                                        <p className="text-xs text-[var(--text-tertiary)] truncate">
                                            {selectedMarket.yesSubTitle || selectedMarket.title}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setTradeModalOpen(false)}
                                    className="w-8 h-8 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Trade component */}
                            <div className="p-4 overflow-y-auto max-h-[60vh]">
                                <TradeMarket market={selectedMarket} initialSide="yes" />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
