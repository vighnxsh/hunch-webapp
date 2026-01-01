'use client';

import { useMemo, useState } from 'react';
import {
    LineChart,
    Line,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
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
    probability: string;
}

// Props
interface SocialPriceChartProps {
    candlesticks: CandlestickData[];
    trades: TradeEntry[];
    className?: string;
    height?: number;
    lineColor?: string; // Custom line color
}

// Polymarket-style muted blue
const POLYMARKET_BLUE = '#5b8def';

// Clean, minimal tooltip for probability
const ProbabilityTooltip = ({ active, payload }: any) => {
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
            <div className="bg-[rgba(12,12,14,0.92)] rounded-lg px-3 py-2 shadow-lg backdrop-blur-sm border border-white/5">
                <p className="text-[10px] text-[#999] mb-0.5">
                    {dateStr}
                </p>
                <p className="text-sm font-semibold text-white tabular-nums">
                    {data.probability}
                </p>
            </div>
        );
    }
    return null;
};

export default function SocialPriceChart({
    candlesticks,
    trades,
    className = '',
    height = 180,
    lineColor,
}: SocialPriceChartProps) {
    const [isHovering, setIsHovering] = useState(false);

    // Use provided color or default to Polymarket blue
    const strokeColor = lineColor || POLYMARKET_BLUE;

    // Process candlestick data into chart format
    const chartData = useMemo<ChartDataPoint[]>(() => {
        if (!candlesticks || candlesticks.length === 0) return [];

        return candlesticks
            .filter(c => c.price.close !== null)
            .map(c => ({
                timestamp: c.end_period_ts,
                price: c.price.close!,
                probability: `${c.price.close}%`,
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }, [candlesticks]);

    // Calculate stable Y domain - fixed range with padding
    const yDomain = useMemo<[number, number]>(() => {
        if (chartData.length === 0) return [30, 80];

        const prices = chartData.map(d => d.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);

        // Create a stable, rounded range
        const range = max - min;
        const padding = Math.max(range * 0.25, 8);

        // Round to nearest 5 for clean labels
        let domainMin = Math.floor((min - padding) / 5) * 5;
        let domainMax = Math.ceil((max + padding) / 5) * 5;

        // Ensure we stay within 0-100 bounds
        domainMin = Math.max(0, domainMin);
        domainMax = Math.min(100, domainMax);

        // Ensure minimum range for visual stability
        if (domainMax - domainMin < 20) {
            const midpoint = (domainMin + domainMax) / 2;
            domainMin = Math.max(0, Math.floor(midpoint - 15));
            domainMax = Math.min(100, Math.ceil(midpoint + 15));
        }

        return [domainMin, domainMax];
    }, [chartData]);

    // Generate Y-axis ticks for clean percentage labels
    const yTicks = useMemo(() => {
        const [min, max] = yDomain;
        const ticks: number[] = [];
        // Generate 3-4 evenly spaced ticks
        const step = Math.ceil((max - min) / 3 / 5) * 5;
        for (let i = min; i <= max; i += step) {
            ticks.push(i);
        }
        if (ticks[ticks.length - 1] !== max) {
            ticks.push(max);
        }
        return ticks;
    }, [yDomain]);

    if (chartData.length === 0) {
        return (
            <div className={`w-full flex items-center justify-center ${className}`} style={{ height }}>
                <p className="text-[var(--text-tertiary)] text-sm">No data</p>
            </div>
        );
    }

    return (
        <div
            className={`w-full ${className}`}
            style={{ height }}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 32, bottom: 4, left: 4 }}
                >
                    <defs>
                        {/* Very subtle gradient fill for minimal area effect */}
                        <linearGradient id="subtleGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.08} />
                            <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                        </linearGradient>
                    </defs>

                    {/* Minimal horizontal grid only */}
                    <CartesianGrid
                        horizontal={true}
                        vertical={false}
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="none"
                    />

                    <XAxis
                        dataKey="timestamp"
                        hide
                        type="number"
                        domain={['dataMin', 'dataMax']}
                    />

                    <YAxis
                        orientation="right"
                        domain={yDomain}
                        ticks={yTicks}
                        tick={{
                            fontSize: 9,
                            fill: 'rgba(255,255,255,0.4)',
                            fontFamily: 'var(--font-number, system-ui)',
                        }}
                        tickFormatter={(value) => `${value}%`}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                    />

                    <Tooltip
                        content={<ProbabilityTooltip />}
                        cursor={{
                            stroke: 'rgba(255,255,255,0.15)',
                            strokeWidth: 1,
                        }}
                    />

                    {/* Single thin line - the core visual */}
                    <Line
                        type="monotone"
                        dataKey="price"
                        stroke={strokeColor}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={isHovering ? {
                            r: 3,
                            strokeWidth: 0,
                            fill: strokeColor,
                        } : false}
                        isAnimationActive={true}
                        animationDuration={800}
                        animationEasing="ease-out"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
