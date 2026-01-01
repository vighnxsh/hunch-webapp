import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketDetailsServer } from '@/app/lib/dflowServer';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ mint: string }> }
) {
    try {
        const { mint } = await params;

        if (!mint) {
            return NextResponse.json(
                { error: 'Mint address is required' },
                { status: 400 }
            );
        }

        // Note: The DFlow API uses /api/v1/market/by-mint/{mint}
        // We need to add this to dflowServer.ts
        const response = await fetch(
            `${process.env.DFLOW_METADATA_API_URL ?? 'https://a.prediction-markets-api.dflow.net'}/api/v1/market/by-mint/${mint}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(process.env.NEXT_PUBLIC_DFLOW_API_KEY ? { 'x-api-key': process.env.NEXT_PUBLIC_DFLOW_API_KEY } : {}),
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch market by mint: ${response.statusText}`);
        }

        const market = await response.json();
        return NextResponse.json(market);
    } catch (error: any) {
        console.error('[API /dflow/market-by-mint/[mint]] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch market by mint' },
            { status: 500 }
        );
    }
}
