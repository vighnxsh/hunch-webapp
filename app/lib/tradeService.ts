import { prisma } from './db';
import redis, { CacheKeys } from './redis';

const DECIMALS = 1_000_000; // Both tokens and USDC use 6 decimals

export interface CreateTradeData {
  userId: string;
  marketTicker: string;
  eventTicker?: string;
  side: 'yes' | 'no';
  action?: 'BUY' | 'SELL';
  amount: string;
  executedInAmount?: string;
  executedOutAmount?: string;
  transactionSig: string;
  quote?: string;
  entryPrice?: number;
}

export interface TradeWithUser {
  id: string;
  userId: string;
  marketTicker: string;
  eventTicker: string | null;
  side: string;
  action: string;
  amount: string;
  transactionSig: string;
  quote: string | null;
  createdAt: Date;
  user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    walletAddress: string;
  };
}

/**
 * Upsert position and calculate PnL for a trade
 * Uses average cost method for partial sells
 */
async function upsertPositionForTrade(
  userId: string,
  marketTicker: string,
  eventTicker: string | null,
  side: 'yes' | 'no',
  action: 'BUY' | 'SELL',
  executedInAmount: string | null,
  executedOutAmount: string | null
): Promise<string> {
  // Find or create position
  let position = await prisma.position.findUnique({
    where: {
      userId_marketTicker_side: { userId, marketTicker, side }
    }
  });

  if (!position) {
    position = await prisma.position.create({
      data: {
        userId,
        marketTicker,
        eventTicker,
        side,
        status: 'OPEN'
      }
    });
  }

  // Calculate amounts in human-readable form (divide by 1M)
  if (action === 'BUY') {
    // BUY: inAmount = USDC spent, outAmount = tokens received
    const usdcSpent = executedInAmount ? Number(executedInAmount) / DECIMALS : 0;
    const tokensReceived = executedOutAmount ? Number(executedOutAmount) / DECIMALS : 0;

    if (usdcSpent > 0 && tokensReceived > 0) {
      await prisma.position.update({
        where: { id: position.id },
        data: {
          totalCostBasis: { increment: usdcSpent },
          totalTokensBought: { increment: tokensReceived },
          status: 'OPEN'
        }
      });
    }
  } else if (action === 'SELL') {
    // SELL: inAmount = tokens sold, outAmount = USDC received
    const tokensSold = executedInAmount ? Number(executedInAmount) / DECIMALS : 0;
    const usdcReceived = executedOutAmount ? Number(executedOutAmount) / DECIMALS : 0;

    if (tokensSold > 0 && usdcReceived > 0) {
      // Refresh position to get latest values
      position = await prisma.position.findUnique({
        where: { id: position.id }
      });

      if (!position) {
        throw new Error('Position not found during sell processing');
      }

      if (position.totalTokensBought > 0) {
        // Calculate average cost per token
        const avgCostPerToken = position.totalCostBasis / position.totalTokensBought;

        // Cost basis for tokens being sold
        const costBasisSold = avgCostPerToken * tokensSold;

        // Realized PnL for this sell
        const realizedPnLThisSell = usdcReceived - costBasisSold;

        // Calculate new status
        const newTotalTokensSold = position.totalTokensSold + tokensSold;
        const remainingTokens = position.totalTokensBought - newTotalTokensSold;

        let newStatus = 'OPEN';
        let closedAt = null;
        if (remainingTokens <= 0.0001) { // Small tolerance for floating point
          newStatus = 'CLOSED';
          closedAt = new Date();
        } else if (newTotalTokensSold > 0) {
          newStatus = 'PARTIALLY_CLOSED';
        }

        await prisma.position.update({
          where: { id: position.id },
          data: {
            totalTokensSold: { increment: tokensSold },
            totalSellProceeds: { increment: usdcReceived },
            realizedPnL: { increment: realizedPnLThisSell },
            status: newStatus,
            closedAt: closedAt
          }
        });
      }
    }
  }

  return position.id;
}

/**
 * Create a new trade (real trades only)
 */
export async function createTrade(data: CreateTradeData) {
  // First, upsert the position
  const positionId = await upsertPositionForTrade(
    data.userId,
    data.marketTicker,
    data.eventTicker || null,
    data.side,
    data.action || 'BUY',
    data.executedInAmount || null,
    data.executedOutAmount || null
  );

  const trade = await prisma.trade.create({
    data: {
      userId: data.userId,
      marketTicker: data.marketTicker,
      eventTicker: data.eventTicker || null,
      side: data.side,
      action: data.action || 'BUY',
      amount: data.amount,
      executedInAmount: data.executedInAmount || null,
      executedOutAmount: data.executedOutAmount || null,
      transactionSig: data.transactionSig,
      quote: data.quote || null,
      isDummy: false, // Only real trades are allowed
      entryPrice: data.entryPrice ?? null,
      positionId: positionId,
    },
  });

  // Invalidate feed caches for all followers of this user
  await invalidateUserFeedCaches(data.userId);

  return trade;
}

/**
 * Create a trade if it doesn't exist (idempotent)
 */
export async function createTradeIfNotExists(data: CreateTradeData) {
  const existing = await prisma.trade.findFirst({
    where: { transactionSig: data.transactionSig },
  });

  if (existing) {
    return existing;
  }

  return createTrade(data);
}

/**
 * Get trades for a specific user (real trades only)
 */
export async function getUserTrades(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<TradeWithUser[]> {
  const trades = await prisma.trade.findMany({
    where: {
      userId,
      isDummy: false, // Only return real trades
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          walletAddress: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return trades;
}

/**
 * Get trades by transaction signatures (for verification, real trades only)
 */
export async function getTradesBySignatures(signatures: string[]): Promise<TradeWithUser[]> {
  const trades = await prisma.trade.findMany({
    where: {
      transactionSig: {
        in: signatures,
      },
      isDummy: false, // Only return real trades
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          walletAddress: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return trades;
}

/**
 * Update a trade's quote
 */
export async function updateTradeQuote(tradeId: string, quote: string, userId: string) {
  // Verify the trade belongs to the user
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
  });

  if (!trade) {
    throw new Error('Trade not found');
  }

  if (trade.userId !== userId) {
    throw new Error('Unauthorized: You can only update your own trades');
  }

  const updatedTrade = await prisma.trade.update({
    where: { id: tradeId },
    data: { quote },
  });

  // Invalidate feed caches for all followers of this user
  await invalidateUserFeedCaches(userId);

  return updatedTrade;
}

/**
 * Get all recent trades (global feed, real trades only)
 * Used for unauthenticated users or discovery feed
 */
export async function getAllRecentTrades(
  limit: number = 50,
  offset: number = 0
): Promise<TradeWithUser[]> {
  const trades = await prisma.trade.findMany({
    where: {
      isDummy: false, // Only return real trades
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          walletAddress: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return trades;
}

/**
 * Invalidate feed caches for all followers of a user
 * This is called when a user makes a new trade
 */
async function invalidateUserFeedCaches(userId: string) {
  // Get all followers of this user
  const followers = await prisma.follow.findMany({
    where: { followingId: userId },
    select: { followerId: true },
  });

  // Invalidate feed cache for each follower
  const cacheKeys = followers.map((f) => CacheKeys.feed(f.followerId));
  if (cacheKeys.length > 0) {
    await redis.del(...cacheKeys);
  }
}

/**
 * Get user positions from the Position model (with PnL data)
 */
export async function getUserPositionsFromDB(userId: string) {
  const positions = await prisma.position.findMany({
    where: { userId },
    include: {
      trades: {
        orderBy: { createdAt: 'desc' },
        take: 10, // Last 10 trades per position
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return positions;
}

/**
 * Get portfolio stats for a user
 */
export async function getPortfolioStats(userId: string): Promise<{
  totalRealizedPnL: number;
  totalCostBasis: number;
  totalSellProceeds: number;
  openPositions: number;
  closedPositions: number;
  partiallyClosedPositions: number;
}> {
  const positions = await prisma.position.findMany({
    where: { userId },
    select: {
      realizedPnL: true,
      totalCostBasis: true,
      totalSellProceeds: true,
      status: true,
    }
  });

  const stats = positions.reduce((acc, pos) => {
    acc.totalRealizedPnL += pos.realizedPnL;
    acc.totalCostBasis += pos.totalCostBasis;
    acc.totalSellProceeds += pos.totalSellProceeds;

    if (pos.status === 'OPEN') acc.openPositions++;
    else if (pos.status === 'CLOSED') acc.closedPositions++;
    else if (pos.status === 'PARTIALLY_CLOSED') acc.partiallyClosedPositions++;

    return acc;
  }, {
    totalRealizedPnL: 0,
    totalCostBasis: 0,
    totalSellProceeds: 0,
    openPositions: 0,
    closedPositions: 0,
    partiallyClosedPositions: 0,
  });

  return stats;
}
