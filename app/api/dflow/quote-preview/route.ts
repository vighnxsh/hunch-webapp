import { NextRequest, NextResponse } from 'next/server';
import { requestOrderPreviewServer } from '@/app/lib/dflowServer';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const inputMint = searchParams.get('inputMint');
    const outputMint = searchParams.get('outputMint');
    const amount = searchParams.get('amount');

    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters: inputMint, outputMint, amount' },
        { status: 400 }
      );
    }

    const orderResponse = await requestOrderPreviewServer({
      inputMint,
      outputMint,
      amount,
    });

    return NextResponse.json(orderResponse);
  } catch (error: any) {
    console.error('[API /dflow/quote-preview] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to request quote preview' },
      { status: 500 }
    );
  }
}
