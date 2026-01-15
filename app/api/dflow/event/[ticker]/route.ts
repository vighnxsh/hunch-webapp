import { NextRequest, NextResponse } from 'next/server';
import { fetchEventDetailsServer } from '@/app/lib/dflowServer';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ ticker: string }> }
) {
    try {
        const { ticker } = await params;

        if (!ticker) {
            return NextResponse.json(
                { error: 'Event ticker is required' },
                { status: 400 }
            );
        }

        const eventDetails = await fetchEventDetailsServer(ticker);
        return NextResponse.json(eventDetails);
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
