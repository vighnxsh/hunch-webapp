/**
 * Delegation Service
 * 
 * Handles the per-follower delegation that authorizes Hunch to trade on their behalf.
 * A valid delegation is required before copy trading can be enabled for any leader.
 * 
 * Three-Layer Auth Model:
 * 1. Global App Key (PRIVY_AUTHORIZATION_PRIVATE_KEY) - enables server-side wallet signing
 * 2. Per-Follower Delegation (this service) - user consent to allow copy trading
 * 3. Per-Leader Copy Settings - budget and config for each leader
 */

import { prisma } from './db';

export interface DelegationData {
    hasValidDelegation: boolean;
    signature?: string;
    message?: string;
    signedAt?: Date | null;
}

export interface StoreDelegationInput {
    signature: string;
    message: string;
}

/**
 * Check if a user has a valid delegation for copy trading
 */
export async function hasValidDelegation(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            delegationSignature: true,
            delegationSignedAt: true,
        },
    });

    if (!user) {
        return false;
    }

    // A valid delegation requires both signature and timestamp
    return !!(user.delegationSignature && user.delegationSignedAt);
}

/**
 * Get the delegation data for a user
 */
export async function getDelegation(userId: string): Promise<DelegationData> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            delegationSignature: true,
            delegationMessage: true,
            delegationSignedAt: true,
        },
    });

    if (!user || !user.delegationSignature || !user.delegationSignedAt) {
        return { hasValidDelegation: false };
    }

    return {
        hasValidDelegation: true,
        signature: user.delegationSignature,
        message: user.delegationMessage || undefined,
        signedAt: user.delegationSignedAt,
    };
}

/**
 * Store a user's delegation signature
 * This authorizes Hunch to execute trades on behalf of the user
 */
export async function storeDelegation(
    userId: string,
    input: StoreDelegationInput
): Promise<DelegationData> {
    const user = await prisma.user.update({
        where: { id: userId },
        data: {
            delegationSignature: input.signature,
            delegationMessage: input.message,
            delegationSignedAt: new Date(),
        },
        select: {
            delegationSignature: true,
            delegationMessage: true,
            delegationSignedAt: true,
        },
    });

    console.log(`[Delegation] Stored delegation for user ${userId}`);

    return {
        hasValidDelegation: true,
        signature: user.delegationSignature || undefined,
        message: user.delegationMessage || undefined,
        signedAt: user.delegationSignedAt,
    };
}

/**
 * Revoke a user's delegation
 * This will prevent any further copy trades from being executed
 * Note: This does NOT delete CopySettings - use deleteCopySettings for that
 */
export async function revokeDelegation(userId: string): Promise<{ success: boolean }> {
    await prisma.user.update({
        where: { id: userId },
        data: {
            delegationSignature: null,
            delegationMessage: null,
            delegationSignedAt: null,
        },
    });

    console.log(`[Delegation] Revoked delegation for user ${userId}`);

    return { success: true };
}

/**
 * Validate a delegation before allowing a copy trade to execute
 * Returns a structured result with reason if invalid
 */
export async function validateDelegationForCopyTrade(
    followerId: string
): Promise<{ valid: boolean; reason?: string }> {
    const delegation = await getDelegation(followerId);

    if (!delegation.hasValidDelegation) {
        return {
            valid: false,
            reason: 'NO_DELEGATION',
        };
    }

    // Future: Add additional validation like expiry checks here
    // if (delegation.signedAt && isExpired(delegation.signedAt)) {
    //     return { valid: false, reason: 'DELEGATION_EXPIRED' };
    // }

    return { valid: true };
}
