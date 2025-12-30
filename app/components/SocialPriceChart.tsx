'use client';

import { useMemo } from 'react';
import {
    AreaChart,
    Area,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip,
    ReferenceDot,
} from 'recharts';
import { CandlestickData } from '../lib/api';

// Trade entry for avatar plotting
export interface TradeEntry {
    id: string;
    userId: string;
    side: 'yes' | 'no';
    amount: string;
    createdAt: string; // ISO timestamp
    user: {
        id: string;
        displayName: string | null;
        avatarUrl: string | null;
        walletAddress: string;
    };
}

// Chart data point
interface ChartDataPoint {
    timestamp: number;
    price: number;
    priceDisplay: string;
}

// Props
interface SocialPriceChartProps {
    candlesticks: CandlestickData[];
    trades: TradeEntry[];
    className?: string;
    height?: number;
    lineColor?: string; // Custom line color (cyan for YES, pink for NO)
}

// Custom tooltip for price
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const date = new Date(data.timestamp * 1000);
        const dateStr = new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(date);

        return (
            <div className="bg-[rgba(15,15,20,0.95)] border border-[var(--border-color)]/30 rounded-lg px-3 py-2 shadow-xl backdrop-blur-xl">
                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                    {dateStr}
                </p>
                <p className="text-sm font-bold text-cyan-400 font-number">
                    {data.priceDisplay}
                </p>
            </div>
        );
    }
    return null;
};

// Avatar marker component for rendering on chart
function AvatarMarker({
    cx,
    cy,
    trade,
    onClick,
}: {
    cx: number;
    cy: number;
    trade: TradeEntry;
    onClick?: (trade: TradeEntry) => void;
}) {
    const ringColor = trade.side === 'yes' ? '#06b6d4' : '#d946ef';
    const displayName = trade.user.displayName ||
        `${trade.user.walletAddress.slice(0, 4)}...${trade.user.walletAddress.slice(-4)}`;

    return (
        <g
            transform={`translate(${cx}, ${cy})`}
            style={{ cursor: 'pointer' }}
            onClick={() => onClick?.(trade)}
        >
            {/* Glow effect */}
            <circle
                r={16}
                fill={`${ringColor}15`}
                className="animate-pulse"
            />
            {/* Outer ring */}
            <circle
                r={13}
                fill="none"
                stroke={ringColor}
                strokeWidth={2}
                style={{ filter: `drop-shadow(0 0 4px ${ringColor})` }}
            />
            {/* Avatar clip path */}
            <defs>
                <clipPath id={`avatar-clip-${trade.id}`}>
                    <circle r={11} />
                </clipPath>
            </defs>
            {/* Avatar image */}
            <image
                href={trade.user.avatarUrl || '/default.png'}
                x={-11}
                y={-11}
                width={22}
                height={22}
                clipPath={`url(#avatar-clip-${trade.id})`}
                style={{ borderRadius: '50%' }}
            />
            {/* Tooltip on hover - positioned above */}
            <foreignObject x={-60} y={-55} width={120} height={45} style={{ pointerEvents: 'none' }}>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg px-2 py-1 text-center shadow-xl">
                    <p className="text-[10px] text-[var(--text-primary)] font-medium truncate">{displayName}</p>
                    <p className={`text-[10px] font-bold ${trade.side === 'yes' ? 'text-cyan-400' : 'text-pink-400'}`}>
                        {trade.side.toUpperCase()} · ${(parseFloat(trade.amount) / 1_000_000).toFixed(2)}
                    </p>
                </div>
            </foreignObject>
        </g>
    );
}

export default function SocialPriceChart({
    candlesticks,
    trades,
    className = '',
    height = 180,
    lineColor = '#06b6d4', // Default cyan
}: SocialPriceChartProps) {

    // Process candlestick data into chart format
    const chartData = useMemo<ChartDataPoint[]>(() => {
        if (!candlesticks || candlesticks.length === 0) return [];

        return candlesticks
            .filter(c => c.price.close !== null)
            .map(c => ({
                timestamp: c.end_period_ts,
                price: c.price.close!,
                priceDisplay: `${c.price.close}¢`,
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }, [candlesticks]);

    // Map trades to their closest chart data points
    const tradePositions = useMemo(() => {
        if (chartData.length === 0 || trades.length === 0) return [];

        return trades.map(trade => {
            const tradeTimestamp = Math.floor(new Date(trade.createdAt).getTime() / 1000);

            // Find the closest candlestick timestamp
            let closestPoint = chartData[0];
            let minDiff = Math.abs(chartData[0].timestamp - tradeTimestamp);

            for (const point of chartData) {
                const diff = Math.abs(point.timestamp - tradeTimestamp);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestPoint = point;
                }
            }

            return {
                trade,
                timestamp: closestPoint.timestamp,
                price: closestPoint.price,
            };
        });
    }, [chartData, trades]);

    // Calculate Y domain with padding
    const yDomain = useMemo<[number, number]>(() => {
        if (chartData.length === 0) return [0, 100];

        const prices = chartData.map(d => d.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const padding = Math.max((max - min) * 0.2, 5);

        return [
            Math.max(0, Math.floor(min - padding)),
            Math.min(100, Math.ceil(max + padding)),
        ];
    }, [chartData]);

    if (chartData.length === 0) {
        return (
            <div className={`w-full flex items-center justify-center ${className}`} style={{ height }}>
                <p className="text-[var(--text-tertiary)] text-sm">No price data available</p>
            </div>
        );
    }

    return (
        <div className={`w-full ${className}`} style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    margin={{ top: 20, right: 10, bottom: 5, left: 10 }}
                >
                    <defs>
                        <linearGradient id={`priceGradient-${lineColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                            <stop offset="50%" stopColor={lineColor} stopOpacity={0.1} />
                            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                        </linearGradient>
                    </defs>

                    <XAxis
                        dataKey="timestamp"
                        hide
                        type="number"
                        domain={['dataMin', 'dataMax']}
                    />

                    <YAxis
                        domain={yDomain}
                        hide
                    />

                    <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ stroke: 'var(--text-tertiary)', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.5 }}
                    />

                    {/* Price area */}
                    <Area
                        type="monotone"
                        dataKey="price"
                        stroke={lineColor}
                        strokeWidth={2.5}
                        fill={`url(#priceGradient-${lineColor.replace('#', '')})`}
                        isAnimationActive={true}
                        animationDuration={1000}
                        animationEasing="ease-out"
                        style={{ filter: `drop-shadow(0 0 6px ${lineColor}66)` }}
                    />


                    {/* Trade avatars as reference dots */}
                    {tradePositions.map(({ trade, timestamp, price }) => (
                        <ReferenceDot
                            key={trade.id}
                            x={timestamp}
                            y={price}
                            shape={(props) => (
                                <AvatarMarker
                                    cx={props.cx || 0}
                                    cy={props.cy || 0}
                                    trade={trade}
                                />
                            )}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
