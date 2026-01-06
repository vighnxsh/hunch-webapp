import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { PrivyClient } from '@privy-io/server-auth';
import { prisma } from '@/app/lib/db';
import { getCopySettings, updateUsedAmount } from '@/app/lib/copySettingsService';

// Initialize QStash receiver for signature verification
const qstashReceiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

// Initialize Privy server client
const privyClient = new PrivyClient(
    process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
    process.env.PRIVY_APP_SECRET!
);

interface CopyExecutePayload {
    leaderTradeId: string;
    followerId: string;
}

/**
 * POST /api/copy/execute
 * 
 * Called by QStash to execute a copy trade for a single follower.
 * This endpoint is the copy trading engine.
 * 
 * IMPORTANT RETRY RULES:
 * - throw error → QStash retries
 * - return 200 → job considered complete (success OR legitimately skipped)
 */
export async function POST(request: NextRequest) {
    const body = await request.text();
    const signature = request.headers.get('upstash-signature');

    // 1. Verify QStash signature
    if (!signature) {
        console.error('[CopyExecute] Missing QStash signature');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const isValid = await qstashReceiver.verify({
            signature,
            body,
            url: process.env.COPY_EXECUTE_URL!,
        });

        if (!isValid) {
            console.error('[CopyExecute] Invalid QStash signature');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    } catch (verifyError) {
        console.error('[CopyExecute] Signature verification failed:', verifyError);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse payload
    const payload: CopyExecutePayload = JSON.parse(body);
    const { leaderTradeId, followerId } = payload;

    console.log(`[CopyExecute] Processing: leaderTradeId=${leaderTradeId}, followerId=${followerId}`);

    try {
        // 3. Load leader trade
        const leaderTrade = await prisma.trade.findUnique({
            where: { id: leaderTradeId },
            include: {
                user: {
                    select: { id: true, walletAddress: true },
                },
            },
        });

        if (!leaderTrade) {
            console.log(`[CopyExecute] Leader trade ${leaderTradeId} not found, skipping`);
            return NextResponse.json({ status: 'skipped', reason: 'leader_trade_not_found' });
        }

        // 4. Load CopySettings for (followerId, leaderId)
        const copySettings = await getCopySettings(followerId, leaderTrade.userId);

        if (!copySettings) {
            console.log(`[CopyExecute] No copy settings for follower ${followerId} -> leader ${leaderTrade.userId}`);
            return NextResponse.json({ status: 'skipped', reason: 'no_copy_settings' });
        }

        if (!copySettings.enabled) {
            console.log(`[CopyExecute] Copy settings disabled for follower ${followerId}`);
            return NextResponse.json({ status: 'skipped', reason: 'disabled' });
        }

        if (copySettings.expiresAt && new Date() > copySettings.expiresAt) {
            console.log(`[CopyExecute] Copy settings expired for follower ${followerId}`);
            return NextResponse.json({ status: 'skipped', reason: 'expired' });
        }

        // 5. Idempotency check - check if already processed
        const existingCopyLog = await prisma.copyLog.findUnique({
            where: {
                leaderTradeId_followerId: {
                    leaderTradeId,
                    followerId,
                },
            },
        });

        if (existingCopyLog) {
            console.log(`[CopyExecute] Already processed: ${existingCopyLog.id}, status: ${existingCopyLog.status}`);
            return NextResponse.json({ status: 'skipped', reason: 'already_processed' });
        }

        // 6. Check limits
        const remaining = copySettings.maxTotalAmount - copySettings.usedAmount;
        if (remaining <= 0) {
            // Create skip log
            await prisma.copyLog.create({
                data: {
                    leaderTradeId,
                    followerId,
                    status: 'skipped',
                    skipReason: 'limit_exceeded',
                },
            });
            console.log(`[CopyExecute] Limit exceeded for follower ${followerId}, remaining: ${remaining}`);
            return NextResponse.json({ status: 'skipped', reason: 'limit_exceeded' });
        }

        const copyAmount = Math.min(copySettings.amountPerTrade, remaining);

        // 7. Get follower wallet address
        const follower = await prisma.user.findUnique({
            where: { id: followerId },
            select: { walletAddress: true, privyId: true },
        });

        if (!follower) {
            console.error(`[CopyExecute] Follower ${followerId} not found`);
            return NextResponse.json({ status: 'skipped', reason: 'follower_not_found' });
        }

        // Create pending log first (for idempotency if crash happens)
        const copyLog = await prisma.copyLog.create({
            data: {
                leaderTradeId,
                followerId,
                copyAmount,
                status: 'pending',
            },
        });

        try {
            // 8 & 9. Build and sign transaction via Privy
            // For now, we'll mark this as a TODO since actual trade execution
            // requires integration with the DFlow API transaction building

            // TODO: Implement actual trade execution:
            // 1. Build trade transaction for follower wallet
            // 2. Sign via Privy server SDK: await privyClient.walletApi.solana.signTransaction(...)
            // 3. Submit transaction to Solana network
            // 4. Get transaction signature

            console.log(`[CopyExecute] Would execute trade for follower ${followerId}:`);
            console.log(`  - Market: ${leaderTrade.marketTicker}`);
            console.log(`  - Side: ${leaderTrade.side}`);
            console.log(`  - Amount: $${copyAmount}`);
            console.log(`  - Follower wallet: ${follower.walletAddress}`);

            // For now, simulate success and create the trade record
            // In production, this would be the actual transaction signature
            const mockTransactionSig = `copy_${leaderTradeId}_${followerId}_${Date.now()}`;

            // Create follower trade record
            const copyTrade = await prisma.trade.create({
                data: {
                    userId: followerId,
                    marketTicker: leaderTrade.marketTicker,
                    eventTicker: leaderTrade.eventTicker,
                    side: leaderTrade.side,
                    amount: copyAmount.toString(),
                    transactionSig: mockTransactionSig,
                    isDummy: true, // Mark as copy trade placeholder until real execution
                    entryPrice: leaderTrade.entryPrice,
                },
            });

            // 10. Atomically update state
            await prisma.$transaction([
                prisma.copyLog.update({
                    where: { id: copyLog.id },
                    data: {
                        status: 'success',
                        copyTradeId: copyTrade.id,
                    },
                }),
                prisma.copySettings.update({
                    where: {
                        followerId_leaderId: {
                            followerId,
                            leaderId: leaderTrade.userId,
                        },
                    },
                    data: {
                        usedAmount: {
                            increment: copyAmount,
                        },
                    },
                }),
            ]);

            console.log(`[CopyExecute] Success! Created copy trade ${copyTrade.id} for follower ${followerId}`);
            return NextResponse.json({
                status: 'success',
                copyTradeId: copyTrade.id,
                copyAmount,
            });

        } catch (txError: any) {
            // Update log to failed
            await prisma.copyLog.update({
                where: { id: copyLog.id },
                data: {
                    status: 'failed',
                    error: txError.message || 'Transaction failed',
                },
            });

            // Throw to trigger QStash retry for transient errors
            console.error(`[CopyExecute] Transaction error for follower ${followerId}:`, txError);
            throw txError;
        }

    } catch (error: any) {
        console.error(`[CopyExecute] Error processing copy trade:`, error);
        // Throw error to trigger QStash retry
        throw error;
    }
}
