import { NextRequest, NextResponse } from 'next/server';
import {
    createOrUpdateCopySettings,
    getCopySettings,
    deleteCopySettings,
    getCopySettingsForFollower,
} from '@/app/lib/copySettingsService';

// POST - Create or update copy settings
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { followerId, leaderId, amountPerTrade, maxTotalAmount, expiresAt, delegationSignature, signedMessage } = body;

        console.log('POST /api/copy-settings - Request body:', { followerId, leaderId, amountPerTrade, maxTotalAmount, hasSignature: !!delegationSignature });

        if (!followerId || !leaderId) {
            return NextResponse.json(
                { error: 'followerId and leaderId are required' },
                { status: 400 }
            );
        }

        if (typeof amountPerTrade !== 'number' || amountPerTrade <= 0) {
            return NextResponse.json(
                { error: 'amountPerTrade must be a positive number' },
                { status: 400 }
            );
        }

        if (typeof maxTotalAmount !== 'number' || maxTotalAmount <= 0) {
            return NextResponse.json(
                { error: 'maxTotalAmount must be a positive number' },
                { status: 400 }
            );
        }

        if (amountPerTrade > maxTotalAmount) {
            return NextResponse.json(
                { error: 'amountPerTrade cannot exceed maxTotalAmount' },
                { status: 400 }
            );
        }

        const copySettings = await createOrUpdateCopySettings(followerId, leaderId, {
            followerId,
            leaderId,
            amountPerTrade,
            maxTotalAmount,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            delegationSignature: delegationSignature || null,
            signedMessage: signedMessage || null,
            signedAt: delegationSignature ? new Date() : null,
        });

        console.log('POST /api/copy-settings - Success:', copySettings.id);
        return NextResponse.json(copySettings, { status: 200 });
    } catch (error: any) {
        console.error('Error creating/updating copy settings:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create/update copy settings' },
            { status: 500 }
        );
    }
}

// GET - Get copy settings
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const followerId = searchParams.get('followerId');
        const leaderId = searchParams.get('leaderId');

        console.log('GET /api/copy-settings - Params:', { followerId, leaderId });

        if (!followerId) {
            return NextResponse.json(
                { error: 'followerId is required' },
                { status: 400 }
            );
        }

        // If leaderId is provided, get specific settings
        if (leaderId) {
            const copySettings = await getCopySettings(followerId, leaderId);
            return NextResponse.json(copySettings || null, { status: 200 });
        }

        // Otherwise, get all copy settings for the follower
        const allSettings = await getCopySettingsForFollower(followerId);
        return NextResponse.json(allSettings, { status: 200 });
    } catch (error: any) {
        console.error('Error fetching copy settings:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch copy settings' },
            { status: 500 }
        );
    }
}

// DELETE - Delete copy settings
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { followerId, leaderId } = body;

        console.log('DELETE /api/copy-settings - Request body:', { followerId, leaderId });

        if (!followerId || !leaderId) {
            return NextResponse.json(
                { error: 'followerId and leaderId are required' },
                { status: 400 }
            );
        }

        const result = await deleteCopySettings(followerId, leaderId);
        console.log('DELETE /api/copy-settings - Success');
        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        console.error('Error deleting copy settings:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete copy settings' },
            { status: 500 }
        );
    }
}
