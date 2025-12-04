import { prisma } from './db';
import redis, { CacheKeys } from './redis';

export interface CreateTradeData {
  userId: string;
  marketTicker: string;
  side: 'yes' | 'no';
  amount: string;
  transactionSig: string;
}

export interface TradeWithUser {
  id: string;
  userId: string;
  marketTicker: string;
  side: string;
  amount: string;
  transactionSig: string;
  createdAt: Date;
  user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    walletAddress: string;
  };
}

/**
 * Create a new trade
 */
export async function createTrade(data: CreateTradeData) {
  // Check if trade already exists (idempotency)
  const existingTrade = await prisma.trade.findUnique({
    where: { transactionSig: data.transactionSig },
  });

  if (existingTrade) {
    return existingTrade;
  }

  const trade = await prisma.trade.create({
    data: {
      userId: data.userId,
      marketTicker: data.marketTicker,
      side: data.side,
      amount: data.amount,
      transactionSig: data.transactionSig,
    },
  });

  // Invalidate feed caches for all followers of this user
  await invalidateUserFeedCaches(data.userId);

  return trade;
}

/**
 * Get trades for a specific user
 */
export async function getUserTrades(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<TradeWithUser[]> {
  const trades = await prisma.trade.findMany({
    where: { userId },
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
 * Get trades by transaction signatures (for verification)
 */
export async function getTradesBySignatures(signatures: string[]): Promise<TradeWithUser[]> {
  const trades = await prisma.trade.findMany({
    where: {
      transactionSig: {
        in: signatures,
      },
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

