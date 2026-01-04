import { NextRequest, NextResponse } from 'next/server';

const TRADE_API_BASE_URL =
    process.env.DFLOW_TRADE_API_URL ??
    process.env.NEXT_PUBLIC_PM_TRADE_API_BASE_URL ??
    "https://b.quote-api.dflow.net";

const DFLOW_API_KEY = process.env.NEXT_PUBLIC_DFLOW_API_KEY ?? process.env.DFLOW_API_KEY;

function getHeaders(): HeadersInit {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    };

    if (DFLOW_API_KEY) {
        headers["x-api-key"] = DFLOW_API_KEY;
    }

    return headers;
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const signature = searchParams.get('signature');

        if (!signature) {
            return NextResponse.json(
                { error: 'Missing required parameter: signature' },
                { status: 400 }
            );
        }

        // Call DFlow order status endpoint
        const url = `${TRADE_API_BASE_URL}/order-status?signature=${encodeURIComponent(signature)}`;

        console.log('[API /dflow/order-status] Fetching order status for signature:', signature);

        const response = await fetch(url, {
            method: "GET",
            headers: getHeaders(),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[API /dflow/order-status] Error (${response.status}):`, errorText);

            return NextResponse.json(
                { error: `Failed to get order status: ${response.statusText}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log('[API /dflow/order-status] Status:', data.status);

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[API /dflow/order-status] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to get order status' },
            { status: 500 }
        );
    }
}
