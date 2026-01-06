import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { createTrade, getUserTrades, updateTradeQuote } from '@/app/lib/tradeService';
import { getActiveCopySettingsForLeader } from '@/app/lib/copySettingsService';
import { publishCopyTradeJob } from '@/app/lib/qstash';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      marketTicker,
      eventTicker,
      side,
      amount,
      transactionSig,
      quote,
      entryPrice
    } = body;

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
      eventTicker: eventTicker || undefined,
      side: side as 'yes' | 'no',
      amount,
      transactionSig,
      quote: quote || undefined,
      entryPrice: entryPrice && entryPrice !== 'null' ? parseFloat(entryPrice) : undefined,
      // Intentionally do NOT store executed token/usdc amounts.
    });

    // Fan-out: Enqueue copy trade jobs for all active followers
    // This is non-blocking - errors don't fail the leader's trade
    try {
      const activeCopyConfigs = await getActiveCopySettingsForLeader(trade.userId);
      console.log(`[CopyTrading] Found ${activeCopyConfigs.length} active copy configs for leader ${trade.userId}`);

      for (const config of activeCopyConfigs) {
        await publishCopyTradeJob(trade.id, config.followerId);
      }
    } catch (copyError) {
      // Log but don't fail the trade
      console.error('[CopyTrading] Error during fan-out:', copyError);
    }

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

    // Check if we should skip cache
    const skipCache = request.headers.get('cache-control') === 'no-cache';

    const getCachedTrades = unstable_cache(
      async (uid: string, lim: number, off: number) => getUserTrades(uid, lim, off),
      [`trades-${userId}-${limit}-${offset}`],
      {
        revalidate: 3, // 3 second revalidation
        tags: [`trades-${userId}`]
      }
    );

    const trades = skipCache
      ? await getUserTrades(userId, limit, offset)
      : await getCachedTrades(userId, limit, offset);

    const response = NextResponse.json(trades, { status: 200 });

    if (!skipCache) {
      response.headers.set('Cache-Control', 'public, s-maxage=3, stale-while-revalidate=10');
    }

    return response;
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

