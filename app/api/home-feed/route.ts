import { NextRequest, NextResponse } from 'next/server';
import {
    fetchEventsServer,
    fetchSeriesServer,
    fetchEventsBySeriesServer
} from '@/app/lib/dflowServer';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const category = searchParams.get('category');
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : 20;
        const cursor = searchParams.get('cursor') || undefined;
        const status = searchParams.get('status') || 'active';

        // If a specific category is selected (and not 'All'), we need to fetch by series
        if (category && category !== 'All') {
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
                return NextResponse.json({ events: [] });
            }

            // 2. Fetch events for those series
            const events = await fetchEventsBySeriesServer(seriesTickers, {
                withNestedMarkets: true,
                status: status,
                limit, // Apply limit if needed, though series fetching handles it differently
            });

            return NextResponse.json({ events });
        }

        // Default flow: Fetch all events (supports pagination)
        const response = await fetchEventsServer(limit, {
            status,
            withNestedMarkets: true,
            cursor,
        });

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('[API /home-feed] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch home feed' },
            { status: 500 }
        );
    }
}
