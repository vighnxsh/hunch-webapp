import { NextRequest, NextResponse } from 'next/server';

const METADATA_API_BASE_URL =
    process.env.DFLOW_METADATA_API_URL ??
    process.env.NEXT_PUBLIC_PM_METADATA_API_BASE_URL ??
    'https://a.prediction-markets-api.dflow.net';

const DFLOW_API_KEY = process.env.NEXT_PUBLIC_DFLOW_API_KEY ?? process.env.DFLOW_API_KEY;

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const category = searchParams.get('category');
        const tags = searchParams.get('tags');
        const status = searchParams.get('status');
        const isInitialized = searchParams.get('isInitialized');

        const queryParams = new URLSearchParams();
        if (category) queryParams.append('category', category);
        if (tags) queryParams.append('tags', tags);
        if (status) queryParams.append('status', status);
        if (isInitialized) queryParams.append('isInitialized', isInitialized);

        const url = `${METADATA_API_BASE_URL}/api/v1/series${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };
        if (DFLOW_API_KEY) {
            headers['x-api-key'] = DFLOW_API_KEY;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers,
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
