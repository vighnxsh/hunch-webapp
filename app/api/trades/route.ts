import { NextRequest, NextResponse } from 'next/server';
import { createTrade, getUserTrades } from '@/app/lib/tradeService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, marketTicker, side, amount, transactionSig } = body;

    if (!userId || !marketTicker || !side || !amount || !transactionSig) {
      return NextResponse.json(
        { error: 'All fields are required: userId, marketTicker, side, amount, transactionSig' },
        { status: 400 }
      );
    }

    if (side !== 'yes' && side !== 'no') {
      return NextResponse.json(
        { error: 'side must be either "yes" or "no"' },
        { status: 400 }
      );
    }

    const trade = await createTrade({
      userId,
      marketTicker,
      side: side as 'yes' | 'no',
      amount,
      transactionSig,
    });

    return NextResponse.json(trade, { status: 201 });
  } catch (error: any) {
    console.error('Error creating trade:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create trade' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const trades = await getUserTrades(userId, limit, offset);

    return NextResponse.json(trades, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching trades:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}

