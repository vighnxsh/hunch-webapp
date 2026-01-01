import { NextRequest, NextResponse } from 'next/server';
import { fetchCandlesticksByMintServer } from '@/app/lib/dflowServer';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ mint: string }> }
) {
    try {
        const { mint } = await params;
        const searchParams = request.nextUrl.searchParams;

        if (!mint) {
            return NextResponse.json(
                { error: 'Mint address is required' },
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

        const candlesticks = await fetchCandlesticksByMintServer(mint, {
            startTs,
            endTs,
            periodInterval,
        });

        return NextResponse.json(candlesticks);
    } catch (error: any) {
        console.error('[API /dflow/candlesticks/[mint]] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch candlesticks' },
            { status: 500 }
        );
    }
}
