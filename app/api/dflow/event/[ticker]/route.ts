import { NextRequest, NextResponse } from 'next/server';
import { fetchEventDetailsServer, fetchEventMetadataServer } from '@/app/lib/dflowServer';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ ticker: string }> }
) {
    const { ticker } = await params;

    try {
        if (!ticker) {
            return NextResponse.json(
                { error: 'Event ticker is required' },
                { status: 400 }
            );
        }

        const [eventDetails, eventMetadata] = await Promise.all([
            fetchEventDetailsServer(ticker),
            fetchEventMetadataServer(ticker),
        ]);

        const marketDetails = eventMetadata?.market_details || [];
        const metadataByTicker = new Map(
            marketDetails
                .filter(detail => detail.market_ticker)
                .map(detail => [detail.market_ticker as string, detail])
        );

        const normalizedMarkets = (eventDetails?.markets ?? []).map(market => {
            const detail = metadataByTicker.get(market.ticker);

            return {
                ...market,
                image_url: detail?.image_url ?? market.image_url ?? market.imageUrl,
                color_code: detail?.color_code ?? market.color_code,
            };
        });

        const enrichedEventDetails = {
            ...eventDetails,
            image_url:
                eventMetadata?.image_url ??
                (eventDetails as any)?.image_url ??
                eventDetails?.imageUrl,
            featured_image_url:
                eventMetadata?.featured_image_url ??
                (eventDetails as any)?.featured_image_url,
            settlement_sources:
                eventMetadata?.settlement_sources ??
                (eventDetails as any)?.settlement_sources,
            markets: normalizedMarkets,
        };

        // Debug logging
        console.log(`[API /dflow/event/${ticker}] Response has markets:`, {
            hasMarkets: !!eventDetails?.markets,
            marketCount: eventDetails?.markets?.length ?? 0,
            title: eventDetails?.title,
        });

        return NextResponse.json(enrichedEventDetails);
    } catch (error: any) {
        const errorMessage = error?.message || 'Failed to fetch event details';
        const errorStack = error?.stack;
        console.error('[API /dflow/event/[ticker]] Error:', error);
        console.error('[API /dflow/event/[ticker]] Error details:', {
            ticker,
            errorMessage,
            errorStack,
            errorName: error?.name
        });

        // Determine appropriate status code based on error type
        let statusCode = 500;
        if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
            statusCode = 503; // Service Unavailable
        } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            statusCode = 404; // Not Found
        }

        return NextResponse.json(
            {
                error: errorMessage,
                ticker,
                ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
            },
            { status: statusCode }
        );
    }
}
