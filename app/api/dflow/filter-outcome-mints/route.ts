import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketsBatchServer, filterOutcomeMintsServer } from '@/app/lib/dflowServer';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { addresses } = body;

        if (!addresses || !Array.isArray(addresses)) {
            return NextResponse.json(
                { error: 'addresses array is required' },
                { status: 400 }
            );
        }

        const outcomeMints = await filterOutcomeMintsServer(addresses);
        return NextResponse.json({ outcomeMints });
    } catch (error: any) {
        console.error('[API /dflow/filter-outcome-mints] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to filter outcome mints' },
            { status: 500 }
        );
    }
}
