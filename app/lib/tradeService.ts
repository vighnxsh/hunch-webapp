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
  isDummy?: boolean;
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
  isDummy: boolean;
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
  // Explicitly set isDummy to false if not provided (real trades by default now)
  // This overrides the Prisma schema default of true
  const isDummyValue = data.isDummy !== undefined ? data.isDummy : false;
  
  console.log('tradeService.createTrade - isDummy:', isDummyValue, 'transactionSig:', data.transactionSig?.substring(0, 20) + '...');
  
  const trade = await prisma.trade.create({
    data: {
      userId: data.userId,
      marketTicker: data.marketTicker,
      eventTicker: data.eventTicker || null,
      side: data.side,
      amount: data.amount,
      transactionSig: data.transactionSig,
      quote: data.quote || null,
      isDummy: isDummyValue, // Explicitly set to override schema default
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
 * Get all recent trades (global feed)
 * Used for unauthenticated users or discovery feed
 */
export async function getAllRecentTrades(
  limit: number = 50,
  offset: number = 0
): Promise<TradeWithUser[]> {
  const trades = await prisma.trade.findMany({
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

