import { NextRequest, NextResponse } from 'next/server';
import { fetchEventDetailsServer } from '@/app/lib/dflowServer';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ ticker: string }> }
) {
    try {
        const { ticker } = await params;

        if (!ticker) {
            return NextResponse.json(
                { error: 'Event ticker is required' },
                { status: 400 }
            );
        }

        const eventDetails = await fetchEventDetailsServer(ticker);
        return NextResponse.json(eventDetails);
    } catch (error: any) {
        console.error('[API /dflow/event/[ticker]] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch event details' },
            { status: 500 }
        );
    }
}
