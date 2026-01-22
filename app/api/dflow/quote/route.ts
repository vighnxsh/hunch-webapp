import { NextRequest, NextResponse } from 'next/server';
import { requestOrderServer } from '@/app/lib/dflowServer';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const userPublicKey = searchParams.get('userPublicKey');
    const inputMint = searchParams.get('inputMint');
    const outputMint = searchParams.get('outputMint');
    const amount = searchParams.get('amount');
    const slippageBps = searchParams.get('slippageBps')
      ? parseInt(searchParams.get('slippageBps')!, 10)
      : undefined;

    if (!userPublicKey || !inputMint || !outputMint || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters: userPublicKey, inputMint, outputMint, amount' },
        { status: 400 }
      );
    }

    // Platform fee parameters are now handled automatically in requestOrderServer
    // based on whether it's a buy (inputMint = USDC) or sell (outputMint = USDC)
    const orderResponse = await requestOrderServer({
      userPublicKey,
      inputMint,
      outputMint,
      amount,
      slippageBps,
    });

    return NextResponse.json(orderResponse);
  } catch (error: any) {
    console.error('[API /dflow/quote] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to request quote' },
      { status: 500 }
    );
  }
}
