import { prisma } from './db';
import { type Market } from './api';
import { fetchMarketDetailsServer, fetchEventDetailsServer } from './dflowServer';

export interface TradeWithDetails {
  id: string;
  userId: string;
  marketTicker: string;
  eventTicker: string | null;
  side: string;
  amount: string;
  transactionSig: string;
  quote: string | null;
  isDummy: boolean;
  entryPrice: any;
  createdAt: Date;
}

export interface AggregatedPosition {
  positionId: string;
  marketTicker: string;
  eventTicker: string | null;
  side: 'yes' | 'no';
  totalTokenAmount: number;
  totalUsdcAmount: number;
  averageEntryPrice: number;
  currentPrice: number | null;
  currentValue: number | null;
  profitLoss: number | null;
  profitLossPercentage: number | null;
  tradeCount: number;
  market: Market | null;
  eventImageUrl: string | null;
  trades: TradeWithDetails[];
  avgEntryPrice: number;
  netQuantity: number;
  realizedPnL: number;
  unrealizedPnL: number | null;
  totalPnL: number | null;
  totalCostBasis: number;
  openedAt: Date;
  closedAt: Date | null;
  positionStatus: 'OPEN' | 'CLOSED';
}

export interface PositionsByStatus {
  active: AggregatedPosition[];
  previous: AggregatedPosition[];
}

/**
 * Get all user positions with P&L calculations
 */
export async function getUserPositions(userId: string): Promise<PositionsByStatus> {
  let walletAddress: string | null = null;
  let dbId: string | null = null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, walletAddress: true },
  });
  if (user?.id) dbId = user.id;
  if (user?.walletAddress) {
    walletAddress = user.walletAddress;
  } else {
    // Fallback: if caller passed a wallet address instead of a DB id.
    walletAddress = userId;
  }

  if (!dbId && walletAddress) {
    const u = await prisma.user.findUnique({ where: { walletAddress } });
    if (u) dbId = u.id;
  }

  const positionsMap = new Map<string, AggregatedPosition>();
  let positionModels: Array<{
    id: string;
    marketTicker: string;
    eventTicker: string | null;
    side: string;
    avgEntryPrice: any;
    netQuantity: any;
    realizedPnL: any;
    status: string;
    openedAt: Date;
    closedAt: Date | null;
  }> = [];

  if (dbId) {
    positionModels = await prisma.position.findMany({
      where: { userId: dbId },
      select: {
        id: true,
        marketTicker: true,
        eventTicker: true,
        side: true,
        avgEntryPrice: true,
        netQuantity: true,
        realizedPnL: true,
        status: true,
        openedAt: true,
        closedAt: true,
      },
    });

    const tradeCounts = await prisma.trade.groupBy({
      by: ['positionId'],
      where: { userId: dbId, isDummy: false, positionId: { not: null } },
      _count: { _all: true },
    });
    const tradeCountMap = new Map(
      tradeCounts.map((t) => [t.positionId as string, t._count._all])
    );

    for (const positionModel of positionModels) {
      const avgEntryPrice = Number(positionModel.avgEntryPrice);
      const netQuantity = Number(positionModel.netQuantity);
      const realizedPnL = Number(positionModel.realizedPnL);
      const totalCostBasis = avgEntryPrice * netQuantity;

      positionsMap.set(positionModel.id, {
        positionId: positionModel.id,
        marketTicker: positionModel.marketTicker,
        eventTicker: positionModel.eventTicker,
        side: positionModel.side as 'yes' | 'no',
        totalTokenAmount: netQuantity,
        totalUsdcAmount: totalCostBasis,
        averageEntryPrice: avgEntryPrice,
        currentPrice: null,
        currentValue: null,
        profitLoss: null,
        profitLossPercentage: null,
        tradeCount: tradeCountMap.get(positionModel.id) || 0,
        market: null,
        eventImageUrl: null,
        trades: [],
        avgEntryPrice,
        netQuantity,
        realizedPnL,
        unrealizedPnL: null,
        totalPnL: null,
        totalCostBasis,
        openedAt: positionModel.openedAt,
        closedAt: positionModel.closedAt,
        positionStatus: positionModel.status as 'OPEN' | 'CLOSED',
      });
    }
  }

  // Attach markets for DB positions missing market data
  const tickersToFetch = new Set<string>();
  for (const pos of positionsMap.values()) {
    if (!pos.market) {
      tickersToFetch.add(pos.marketTicker);
    }
  }

  if (tickersToFetch.size > 0) {
    const fetchedMarkets = await Promise.all(
      Array.from(tickersToFetch).map(async (ticker) => {
        try {
          return await fetchMarketDetailsServer(ticker);
        } catch (e) {
          console.error(`Failed to fetch market details for ${ticker}:`, e);
          return null;
        }
      })
    );
    const marketByTicker = new Map(
      fetchedMarkets.filter((m): m is Market => !!m).map((m) => [m.ticker, m])
    );

    for (const pos of positionsMap.values()) {
      if (!pos.market) {
        const market = marketByTicker.get(pos.marketTicker) || null;
        if (market) {
          pos.market = market;
          if (!pos.eventTicker) pos.eventTicker = market.eventTicker || null;
        }
      }
    }
  }

  const positions = Array.from(positionsMap.values());

  // Fetch event images for positions with eventTicker
  const eventTickers = Array.from(
    new Set(positions.map((p) => p.eventTicker).filter((x): x is string => !!x))
  );
  const eventImagesMap = new Map<string, string>();
  await Promise.all(
    eventTickers.map(async (eventTicker) => {
      try {
        const ev = await fetchEventDetailsServer(eventTicker);
        if (ev.imageUrl) eventImagesMap.set(eventTicker, ev.imageUrl);
      } catch (e) {
        console.error(`Failed to fetch event image for ${eventTicker}:`, e);
      }
    })
  );

  // Compute current value and PnL
  for (const pos of positions) {
    if (pos.eventTicker) pos.eventImageUrl = eventImagesMap.get(pos.eventTicker) || null;

    if (pos.market) {
      const currentPrice = getCurrentMarketPrice(pos.market, pos.side);
      pos.currentPrice = currentPrice;

      if (currentPrice !== null && pos.totalTokenAmount > 0) {
        pos.currentValue = pos.totalTokenAmount * currentPrice;
        pos.unrealizedPnL = (currentPrice - pos.avgEntryPrice) * pos.totalTokenAmount;
        pos.totalPnL = pos.realizedPnL + pos.unrealizedPnL;
        pos.profitLoss = pos.totalPnL;

        if (pos.totalCostBasis > 0) {
          pos.profitLossPercentage = (pos.totalPnL / pos.totalCostBasis) * 100;
        }
      }
    }

    if (pos.totalTokenAmount <= 0) {
      pos.unrealizedPnL = null;
      pos.totalPnL = pos.realizedPnL;
      pos.profitLoss = pos.realizedPnL;
      pos.profitLossPercentage = null;
    }
  }

  return separateByMarketStatus(positions);
}

/**
 * Get current market price for a specific side (YES or NO)
 */
function getCurrentMarketPrice(market: Market, side: 'yes' | 'no'): number | null {
  if (side === 'yes') {
    // Use mid-price if both bid and ask available
    if (market.yesBid && market.yesAsk) {
      return (parseFloat(market.yesBid) + parseFloat(market.yesAsk)) / 2;
    }
    // Fallback to bid or ask
    if (market.yesBid) return parseFloat(market.yesBid);
    if (market.yesAsk) return parseFloat(market.yesAsk);
  } else {
    // Use mid-price if both bid and ask available
    if (market.noBid && market.noAsk) {
      return (parseFloat(market.noBid) + parseFloat(market.noAsk)) / 2;
    }
    // Fallback to bid or ask
    if (market.noBid) return parseFloat(market.noBid);
    if (market.noAsk) return parseFloat(market.noAsk);
  }

  return null;
}

/**
 * Separate positions into active and previous based on market status
 */
function separateByMarketStatus(positions: AggregatedPosition[]): PositionsByStatus {
  const active: AggregatedPosition[] = [];
  const previous: AggregatedPosition[] = [];

  for (const position of positions) {
    if (position.positionStatus === 'CLOSED') {
      previous.push(position);
      continue;
    }

    if (!position.market) {
      // If market not found, consider it previous
      previous.push(position);
      continue;
    }

    const status = position.market.status?.toLowerCase();

    // Active markets: 'active', 'open', 'trading'
    if (status === 'active' || status === 'open' || status === 'trading') {
      active.push(position);
    } else {
      // Previous markets: 'closed', 'settled', 'finalized', etc.
      previous.push(position);
    }
  }

  return { active, previous };
}

/**
 * Calculate P&L for a specific position
 */
export function calculatePositionPL(
  totalTokenAmount: number,
  totalUsdcAmount: number,
  currentPrice: number | null
): {
  currentValue: number | null;
  profitLoss: number | null;
  profitLossPercentage: number | null;
} {
  if (currentPrice === null || totalTokenAmount === 0) {
    return {
      currentValue: null,
      profitLoss: null,
      profitLossPercentage: null,
    };
  }

  const currentValue = totalTokenAmount * currentPrice;
  const profitLoss = currentValue - totalUsdcAmount;
  const profitLossPercentage = totalUsdcAmount > 0
    ? (profitLoss / totalUsdcAmount) * 100
    : null;

  return {
    currentValue,
    profitLoss,
    profitLossPercentage,
  };
}

/**
 * Get position summary stats for a user
 */
export async function getUserPositionStats(userId: string): Promise<{
  totalProfitLoss: number;
  totalPositions: number;
  activePositions: number;
  winningPositions: number;
  losingPositions: number;
  winRate: number;
}> {
  const { active, previous } = await getUserPositions(userId);
  const allPositions = [...active, ...previous];

  const totalProfitLoss = allPositions.reduce((sum, pos) => {
    if (pos.totalPnL !== null) return sum + pos.totalPnL;
    return sum + pos.realizedPnL;
  }, 0);
  const winningPositions = allPositions.filter((p) => (p.totalPnL ?? p.realizedPnL) > 0).length;
  const losingPositions = allPositions.filter((p) => (p.totalPnL ?? p.realizedPnL) < 0).length;
  const winRate = allPositions.length > 0
    ? (winningPositions / allPositions.length) * 100
    : 0;

  return {
    totalProfitLoss,
    totalPositions: allPositions.length,
    activePositions: active.length,
    winningPositions,
    losingPositions,
    winRate,
  };
}

