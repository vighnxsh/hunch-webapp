import { NextRequest, NextResponse } from 'next/server';
import { fetchEventsServer } from '@/app/lib/dflowServer';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const status = searchParams.get('status') || undefined;
        const withNestedMarkets = searchParams.get('withNestedMarkets') === 'true';
        const cursor = searchParams.get('cursor') || undefined;

        const response = await fetchEventsServer(limit, {
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
