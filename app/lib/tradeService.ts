import { prisma } from './db';
import redis, { CacheKeys } from './redis';

export interface CreateTradeData {
  userId: string;
  marketTicker: string;
  eventTicker?: string;
  side: 'yes' | 'no';
  amount: string;
  transactionSig: string;
  quote?: string;
  entryPrice?: number;
  tokenAmount?: number;
  usdcAmount?: number;
}

export interface TradeWithUser {
  id: string;
  userId: string;
  marketTicker: string;
  eventTicker: string | null;
  side: string;
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
 * Create a new trade (real trades only)
 */
export async function createTrade(data: CreateTradeData) {
  const trade = await prisma.trade.create({
    data: {
      userId: data.userId,
      marketTicker: data.marketTicker,
      eventTicker: data.eventTicker || null,
      side: data.side,
      amount: data.amount,
      transactionSig: data.transactionSig,
      quote: data.quote || null,
      isDummy: false, // Only real trades are allowed
      entryPrice: data.entryPrice ?? null,
      tokenAmount: data.tokenAmount ?? null,
      usdcAmount: data.usdcAmount ?? null,
    },
  });

  // Invalidate feed caches for all followers of this user
  await invalidateUserFeedCaches(data.userId);

  return trade;
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

