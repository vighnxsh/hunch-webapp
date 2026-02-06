import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, AuthError, createAuthErrorResponse } from '@/app/lib/authMiddleware';
import { getDelegation } from '@/app/lib/delegationService';

/**
 * GET /api/users/delegation-status
 * Returns the delegation status for the authenticated user
 * Used to check if user needs to sign delegation for copy trading
 */
export async function GET(request: NextRequest) {
    try {
        // Get the authenticated user from Privy session
        const authUser = await getAuthenticatedUser(request);

        // Get delegation status from the database
        const delegation = await getDelegation(authUser.userId);

        return NextResponse.json({
            hasValidDelegation: delegation.hasValidDelegation,
            signedAt: delegation.signedAt || null,
        });
    } catch (error: any) {
        if (error instanceof AuthError) {
            return NextResponse.json(createAuthErrorResponse(error), { status: error.statusCode });
        }
        console.error('Error fetching delegation status:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch delegation status' },
            { status: 500 }
        );
    }
}
