import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const category = searchParams.get('category');
        const tags = searchParams.get('tags');

        const queryParams = new URLSearchParams();
        if (category) queryParams.append('category', category);
        if (tags) queryParams.append('tags', tags);

        // Note: Series endpoint - proxying to DFlow
        const url = `${process.env.DFLOW_METADATA_API_URL ?? 'https://dev-prediction-markets-api.dflow.net'}/api/v1/series${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(process.env.NEXT_PUBLIC_DFLOW_API_KEY ? { 'x-api-key': process.env.NEXT_PUBLIC_DFLOW_API_KEY } : {}),
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch series: ${response.statusText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[API /dflow/series] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch series' },
            { status: 500 }
        );
    }
}
