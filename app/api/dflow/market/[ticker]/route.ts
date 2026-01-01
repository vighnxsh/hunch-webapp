import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketDetailsServer } from '@/app/lib/dflowServer';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ ticker: string }> }
) {
    try {
        const { ticker } = await params;

        if (!ticker) {
            return NextResponse.json(
                { error: 'Market ticker is required' },
                { status: 400 }
            );
        }

        const marketDetails = await fetchMarketDetailsServer(ticker);
        return NextResponse.json(marketDetails);
    } catch (error: any) {
        console.error('[API /dflow/market/[ticker]] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch market details' },
            { status: 500 }
        );
    }
}
