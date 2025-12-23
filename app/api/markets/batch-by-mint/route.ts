import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketsBatch } from '@/app/lib/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mints } = body;

    if (!mints || !Array.isArray(mints) || mints.length === 0) {
      return NextResponse.json(
        { error: 'mints array is required' },
        { status: 400 }
      );
    }

    const markets = await fetchMarketsBatch(mints);

    return NextResponse.json(
      { markets },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in batch-by-mint API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
