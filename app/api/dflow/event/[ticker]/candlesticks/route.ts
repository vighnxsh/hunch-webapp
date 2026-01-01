import { NextRequest, NextResponse } from 'next/server';
import { fetchEventCandlesticksServer } from '@/app/lib/dflowServer';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ ticker: string }> }
) {
    try {
        const { ticker } = await params;
        const searchParams = request.nextUrl.searchParams;

        if (!ticker) {
            return NextResponse.json(
                { error: 'Event ticker is required' },
                { status: 400 }
            );
        }

        const startTs = searchParams.get('startTs')
            ? parseInt(searchParams.get('startTs')!, 10)
            : undefined;
        const endTs = searchParams.get('endTs')
            ? parseInt(searchParams.get('endTs')!, 10)
            : undefined;
        const periodInterval = searchParams.get('periodInterval')
            ? parseInt(searchParams.get('periodInterval')!, 10)
            : undefined;

        const candlesticks = await fetchEventCandlesticksServer(ticker, {
            startTs,
            endTs,
            periodInterval,
        });

        return NextResponse.json(candlesticks);
    } catch (error: any) {
        console.error('[API /dflow/event/[ticker]/candlesticks] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch event candlesticks' },
            { status: 500 }
        );
    }
}
