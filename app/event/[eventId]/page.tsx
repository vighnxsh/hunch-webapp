'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchEventDetails, fetchMarketDetails, EventDetails, Market } from '../../lib/api';
import TradeMarket from '../../components/TradeMarket';
import ShareBlink from '../../components/ShareBlink';

export default function EventPage() {
    const params = useParams();
    const router = useRouter();
    const eventId = params?.eventId as string;
    const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
    const [detailedMarkets, setDetailedMarkets] = useState<Map<string, Market>>(new Map());
    const [loadingMarkets, setLoadingMarkets] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMarketTicker, setSelectedMarketTicker] = useState<string | null>(null);
    const [showAllMarkets, setShowAllMarkets] = useState(false);
    const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes');

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

                    // Set first market as selected by default
                    if (activeMarkets.length > 0 && activeMarkets[0].ticker) {
                        setSelectedMarketTicker(activeMarkets[0].ticker);
                    }

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

    // Get active markets and sort by chance (yesBid) descending
    const activeMarkets = (eventDetails?.markets?.filter(
        (m: Market) => m.status !== 'finalized' && m.status !== 'resolved' && m.status !== 'closed'
    ) || []).sort((a, b) => {
        const aChance = a.yesBid ? parseFloat(a.yesBid) : 0;
        const bChance = b.yesBid ? parseFloat(b.yesBid) : 0;
        return bChance - aChance; // Descending order
    });

    // Show only top 4 markets initially
    const displayedMarkets = showAllMarkets ? activeMarkets : activeMarkets.slice(0, 4);

    // Get selected market data
    const selectedMarket = selectedMarketTicker
        ? (detailedMarkets.get(selectedMarketTicker) || activeMarkets.find(m => m.ticker === selectedMarketTicker))
        : activeMarkets[0];

    const formatDate = (timestamp?: number) => {
        if (!timestamp) return null;
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--background)]">
                <main className="max-w-7xl mx-auto px-4 py-8 pb-24">
                    <div className="space-y-4">
                        <div className="h-24 bg-[var(--surface)] rounded-2xl animate-pulse" />
                        <div className="flex gap-6">
                            <div className="flex-1 space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-20 bg-[var(--surface)] rounded-xl animate-pulse" />
                                ))}
                            </div>
                            <div className="w-[35%]">
                                <div className="h-96 bg-[var(--surface)] rounded-2xl animate-pulse" />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-2xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <p className="text-[var(--text-secondary)] mb-4">{error}</p>
                    <button onClick={() => router.back()} className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-medium">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (!eventDetails) return null;

    return (
        <div className="min-h-screen bg-[var(--background)]">
            <main className="max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-8">
                {/* Back Button */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="text-sm font-medium">Back</span>
                </button>

                {/* Two Column Layout - Event Info + Markets on Left, Trade Card on Right */}
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left Column - Event Info + Markets List (65%) */}
                    <div className="flex-1 lg:w-[65%] space-y-4">
                        {/* Event Header - Image + Title */}
                        <div className="flex gap-4 p-4 bg-[var(--surface)] rounded-2xl">
                            {/* Image Thumbnail */}
                            {eventDetails.imageUrl ? (
                                <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden flex-shrink-0">
                                    <img
                                        src={eventDetails.imageUrl}
                                        alt={eventDetails.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ) : (
                                <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0">
                                    <span className="text-2xl">📊</span>
                                </div>
                            )}

                            {/* Event Info */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h1 className="text-lg md:text-xl font-bold text-[var(--text-primary)] leading-tight">
                                    {eventDetails.title}
                                </h1>
                                {eventDetails.subtitle && (
                                    <p className="text-[var(--text-secondary)] text-sm mt-1">{eventDetails.subtitle}</p>
                                )}
                            </div>
                        </div>

                        {/* Markets List */}
                        <div className="space-y-3">
                            <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wide px-1">
                                Markets ({activeMarkets.length})
                            </h2>

                            {displayedMarkets.length === 0 ? (
                                <div className="p-8 bg-[var(--surface)] rounded-2xl text-center">
                                    <p className="text-[var(--text-tertiary)]">No active markets</p>
                                </div>
                            ) : (
                                displayedMarkets.map((market: Market) => {
                                    const marketData = detailedMarkets.get(market.ticker) || market;
                                    const isSelected = selectedMarketTicker === market.ticker;
                                    const isLoading = loadingMarkets.has(market.ticker);
                                    const displayTitle = marketData.yesSubTitle || marketData.noSubTitle || marketData.subtitle || 'Market Option';
                                    const yesPrice = marketData.yesAsk ? Math.round(parseFloat(marketData.yesAsk) * 100) : null;
                                    const noPrice = marketData.noAsk ? Math.round(parseFloat(marketData.noAsk) * 100) : null;
                                    const chance = marketData.yesBid ? Math.round(parseFloat(marketData.yesBid) * 100) : null;

                                    return (
                                        <div
                                            key={market.ticker}
                                            onClick={() => setSelectedMarketTicker(market.ticker)}
                                            className="p-3 rounded-xl cursor-pointer transition-all duration-200 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-2 border-transparent"
                                        >
                                            {/* Mobile: Stacked layout, Desktop: Row layout */}
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                                {/* Title + Chance Row */}
                                                <div className="flex items-center justify-between sm:flex-1 gap-2">
                                                    {/* Title */}
                                                    <h3 className="font-medium text-sm text-[var(--text-primary)] flex-1 min-w-0 truncate">
                                                        {displayTitle}
                                                    </h3>

                                                    {/* Chance */}
                                                    <span className="text-lg sm:text-xl font-bold text-[var(--text-primary)] flex-shrink-0">
                                                        {chance !== null ? `${chance}%` : '—'}
                                                    </span>
                                                </div>

                                                {/* Yes/No Buttons Row */}
                                                <div className="flex items-center gap-2 sm:flex-shrink-0">
                                                    {/* Yes Button */}
                                                    <div
                                                        className="flex-1 sm:flex-none"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedMarketTicker(market.ticker);
                                                            setSelectedSide('yes');
                                                        }}
                                                    >
                                                        {isLoading ? (
                                                            <div className="h-10 bg-[var(--surface-hover)] rounded-lg animate-pulse" />
                                                        ) : (
                                                            <div className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:min-w-[100px] text-center transition-all cursor-pointer ${isSelected && selectedSide === 'yes'
                                                                    ? 'bg-green-500 border-2 border-green-400 shadow-lg shadow-green-500/25'
                                                                    : 'bg-green-500/15 border border-green-500/30 hover:bg-green-500/25'
                                                                }`}>
                                                                <span className={`font-bold text-xs sm:text-sm ${isSelected && selectedSide === 'yes' ? 'text-white' : 'text-green-400'
                                                                    }`}>
                                                                    Yes {yesPrice !== null ? `${yesPrice}¢` : '—'}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* No Button */}
                                                    <div
                                                        className="flex-1 sm:flex-none"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedMarketTicker(market.ticker);
                                                            setSelectedSide('no');
                                                        }}
                                                    >
                                                        {isLoading ? (
                                                            <div className="h-10 bg-[var(--surface-hover)] rounded-lg animate-pulse" />
                                                        ) : (
                                                            <div className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:min-w-[100px] text-center transition-all cursor-pointer ${isSelected && selectedSide === 'no'
                                                                    ? 'bg-red-500 border-2 border-red-400 shadow-lg shadow-red-500/25'
                                                                    : 'bg-red-500/15 border border-red-500/30 hover:bg-red-500/25'
                                                                }`}>
                                                                <span className={`font-bold text-xs sm:text-sm ${isSelected && selectedSide === 'no' ? 'text-white' : 'text-red-400'
                                                                    }`}>
                                                                    No {noPrice !== null ? `${noPrice}¢` : '—'}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* Show More Button */}
                            {!showAllMarkets && activeMarkets.length > 4 && (
                                <button
                                    onClick={() => setShowAllMarkets(true)}
                                    className="w-full p-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border-2 border-dashed border-[var(--border-color)] hover:border-cyan-500/30"
                                >
                                    Show {activeMarkets.length - 4} More Markets
                                </button>
                            )}

                            {/* Show Less Button */}
                            {showAllMarkets && activeMarkets.length > 4 && (
                                <button
                                    onClick={() => setShowAllMarkets(false)}
                                    className="w-full p-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                    Show Less
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Trade Card (Sticky, 35%) */}
                    <div className="lg:w-[35%] flex-shrink-0">
                        <div className="lg:sticky lg:top-6">
                            {selectedMarket ? (
                                <div className="bg-[var(--surface)] rounded-2xl overflow-hidden">
                                    {/* Card Header */}
                                    <div className="p-4 border-b border-[var(--border-color)]/50">
                                        <h3 className="font-semibold text-[var(--text-primary)] leading-tight text-sm">
                                            {selectedMarket.yesSubTitle || selectedMarket.noSubTitle || selectedMarket.subtitle || 'Market Option'}
                                        </h3>
                                        {selectedMarket.closeTime && (
                                            <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                                Closes {formatDate(selectedMarket.closeTime)}
                                            </p>
                                        )}
                                    </div>

                                    {/* Trade Component */}
                                    <div className="p-4">
                                        <TradeMarket market={selectedMarket} initialSide={selectedSide} />
                                    </div>

                                    {/* Share Blink */}
                                    <div className="px-4 pb-4 border-t border-[var(--border-color)]/50 pt-4">
                                        <ShareBlink market={selectedMarket} />
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-[var(--surface)] rounded-2xl p-8 text-center">
                                    <p className="text-[var(--text-tertiary)]">Select a market to trade</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}