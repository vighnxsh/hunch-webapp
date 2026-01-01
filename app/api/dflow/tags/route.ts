import { NextRequest, NextResponse } from 'next/server';
import { fetchTagsByCategoriesServer } from '@/app/lib/dflowServer';

export async function GET(request: NextRequest) {
    try {
        const categories = await fetchTagsByCategoriesServer();
        return NextResponse.json({ tagsByCategories: categories });
    } catch (error: any) {
        console.error('[API /dflow/tags] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch tags' },
            { status: 500 }
        );
    }
}
