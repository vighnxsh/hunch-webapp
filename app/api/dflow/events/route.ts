import { NextRequest, NextResponse } from 'next/server';
import { fetchEventsBySeriesServer, fetchEventsServer } from '@/app/lib/dflowServer';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : undefined;
        const status = searchParams.get('status') || undefined;
        const withNestedMarkets = searchParams.get('withNestedMarkets') === 'true';
        const cursor = searchParams.get('cursor') || undefined;

        const seriesTickers = searchParams.get('seriesTickers') || undefined;
        const response = seriesTickers
            ? {
                events: await fetchEventsBySeriesServer(seriesTickers, {
                    status,
                    withNestedMarkets,
                    limit,
                }),
            }
            : await fetchEventsServer(limit ?? 20, {
                status,
                withNestedMarkets,
                cursor,
            });

        return NextResponse.json(response);
    } catch (error: any) {
        console.error('[API /dflow/events] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch events' },
            { status: 500 }
        );
    }
}
