import { NextRequest, NextResponse } from 'next/server';
import {
    fetchEventsServer,
    fetchSeriesServer,
    fetchEventsBySeriesServer
} from '@/app/lib/dflowServer';
import { processHomeFeed } from '@/app/lib/homeFeedService';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const category = searchParams.get('category');
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : 20;
        const cursor = searchParams.get('cursor') || undefined;
        const status = searchParams.get('status') || 'active';
        const includeMarkets = searchParams.get('includeMarkets') !== 'false';

        let rawEvents: any[] = [];
        let nextCursor: string | undefined;

        // If a specific category is selected (and not 'All' or 'Hot'), we need to fetch by series
        if (category && category !== 'All' && category !== 'Hot') {
            // 1. Fetch series for the category
            const series = await fetchSeriesServer({
                category,
                isInitialized: true,
                status: 'active',
            });

            const seriesTickers = (series || [])
                .map((item) => item.ticker)
                .filter(Boolean);

            if (seriesTickers.length === 0) {
                return NextResponse.json({
                    events: [],
                    topMarkets: [],
                    metadata: {
                        totalEvents: 0,
                        hasMore: false,
                    },
                });
            }

            // 2. Fetch events for those series
            // Fetch more than needed to allow for filtering
            const events = await fetchEventsBySeriesServer(seriesTickers, {
                withNestedMarkets: true,
                status: status,
                limit: limit * 3, // Over-fetch to account for filtering
            });

            rawEvents = events;
        } else {
            // Default flow: Fetch all events (supports pagination)
            // For "Hot" and "All", we fetch from the main events endpoint
            const response = await fetchEventsServer(limit * 3, {
                status,
                withNestedMarkets: true,
                cursor,
            });

            rawEvents = response.events || [];
            nextCursor = response.cursor;
        }

        // Process the events with server-side filtering, sorting, and market extraction
        const processed = processHomeFeed(rawEvents, {
            category: category || undefined,
            limit,
            includeMarkets,
        });

        return NextResponse.json({
            events: processed.events,
            topMarkets: processed.topMarkets,
            cursor: processed.metadata.hasMore ? nextCursor : undefined,
            metadata: processed.metadata,
        });

    } catch (error: any) {
        console.error('[API /home-feed] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch home feed' },
            { status: 500 }
        );
    }
}
