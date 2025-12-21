import { NextRequest, NextResponse } from 'next/server';
import { createTrade, getUserTrades, updateTradeQuote } from '@/app/lib/tradeService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, marketTicker, eventTicker, side, amount, transactionSig, quote, isDummy } = body;

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

    // Force isDummy to false for real trades - explicitly set to override schema default
    // If isDummy is undefined, default to false (real trade)
    const finalIsDummy = isDummy !== undefined ? isDummy : false;
    
    console.log('Creating trade with isDummy:', finalIsDummy, 'transactionSig:', transactionSig?.substring(0, 20) + '...');
    
    const trade = await createTrade({
      userId,
      marketTicker,
      eventTicker: eventTicker || undefined,
      side: side as 'yes' | 'no',
      amount,
      transactionSig,
      quote: quote || undefined,
      isDummy: finalIsDummy, // Explicitly set - false for real trades
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { tradeId, quote, userId } = body;

    if (!tradeId || !userId) {
      return NextResponse.json(
        { error: 'tradeId and userId are required' },
        { status: 400 }
      );
    }

    if (quote && quote.length > 280) {
      return NextResponse.json(
        { error: 'Quote must be 280 characters or less' },
        { status: 400 }
      );
    }

    const updatedTrade = await updateTradeQuote(tradeId, quote || '', userId);

    return NextResponse.json(updatedTrade, { status: 200 });
  } catch (error: any) {
    console.error('Error updating trade quote:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update trade quote' },
      { status: 500 }
    );
  }
}

