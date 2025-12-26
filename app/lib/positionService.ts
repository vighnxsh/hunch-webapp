import { prisma } from './db';
import { fetchMarketDetails, fetchEventDetails, type Market, type EventDetails } from './api';

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
  tokenAmount: any;
  usdcAmount: any;
  createdAt: Date;
}

export interface AggregatedPosition {
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
}

export interface PositionsByStatus {
  active: AggregatedPosition[];
  previous: AggregatedPosition[];
}

/**
 * Get all user positions with P&L calculations
 */
export async function getUserPositions(userId: string): Promise<PositionsByStatus> {
  // Fetch all user trades with execution details
  const trades = await prisma.trade.findMany({
    where: {
      userId,
      isDummy: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (trades.length === 0) {
    return { active: [], previous: [] };
  }

  // Aggregate trades by market and side
  const positionsMap = new Map<string, AggregatedPosition>();

  for (const trade of trades) {
    const key = `${trade.marketTicker}-${trade.side}`;
    
    if (!positionsMap.has(key)) {
      positionsMap.set(key, {
        marketTicker: trade.marketTicker,
        eventTicker: trade.eventTicker,
        side: trade.side as 'yes' | 'no',
        totalTokenAmount: 0,
        totalUsdcAmount: 0,
        averageEntryPrice: 0,
        currentPrice: null,
        currentValue: null,
        profitLoss: null,
        profitLossPercentage: null,
        tradeCount: 0,
        market: null,
        eventImageUrl: null,
        trades: [],
      });
    }

    const position = positionsMap.get(key)!;
    position.trades.push(trade as any);
    position.tradeCount++;

    // Aggregate amounts if available
    if (trade.tokenAmount && trade.usdcAmount) {
      position.totalTokenAmount += Number(trade.tokenAmount);
      position.totalUsdcAmount += Number(trade.usdcAmount);
    }
  }

  // Calculate average entry prices
  for (const position of positionsMap.values()) {
    if (position.totalTokenAmount > 0 && position.totalUsdcAmount > 0) {
      position.averageEntryPrice = position.totalUsdcAmount / position.totalTokenAmount;
    }
  }

  // Fetch market data for all positions
  const marketTickers = Array.from(new Set(trades.map(t => t.marketTicker)));
  const marketsMap = new Map<string, Market>();
  
  // Fetch markets individually (can be optimized with batch endpoint if available)
  await Promise.all(
    marketTickers.map(async (ticker) => {
      try {
        const market = await fetchMarketDetails(ticker);
        marketsMap.set(ticker, market);
      } catch (error) {
        console.error(`Failed to fetch market ${ticker}:`, error);
      }
    })
  );

  // Fetch event images for positions with eventTicker (only imageUrl, minimal data)
  const eventTickers = Array.from(new Set(
    trades.map(t => t.eventTicker).filter((ticker): ticker is string => ticker !== null)
  ));
  const eventImagesMap = new Map<string, string>();
  
  await Promise.all(
    eventTickers.map(async (eventTicker) => {
      try {
        const eventDetails = await fetchEventDetails(eventTicker);
        if (eventDetails.imageUrl) {
          eventImagesMap.set(eventTicker, eventDetails.imageUrl);
        }
      } catch (error) {
        console.error(`Failed to fetch event image for ${eventTicker}:`, error);
      }
    })
  );

  // Attach market data, event image, and calculate P&L
  for (const position of positionsMap.values()) {
    const market = marketsMap.get(position.marketTicker);
    position.market = market || null;

    // Attach event image if eventTicker exists
    if (position.eventTicker) {
      position.eventImageUrl = eventImagesMap.get(position.eventTicker) || null;
    }

    if (market) {
      // Get current price based on side
      const currentPrice = getCurrentMarketPrice(market, position.side);
      position.currentPrice = currentPrice;

      if (currentPrice !== null && position.totalTokenAmount > 0) {
        position.currentValue = position.totalTokenAmount * currentPrice;
        position.profitLoss = position.currentValue - position.totalUsdcAmount;
        
        if (position.totalUsdcAmount > 0) {
          position.profitLossPercentage = (position.profitLoss / position.totalUsdcAmount) * 100;
        }
      }
    }
  }

  // Separate positions by market status
  const positions = Array.from(positionsMap.values());
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

  let totalProfitLoss = 0;
  let winningPositions = 0;
  let losingPositions = 0;

  for (const position of allPositions) {
    if (position.profitLoss !== null) {
      totalProfitLoss += position.profitLoss;
      if (position.profitLoss > 0) {
        winningPositions++;
      } else if (position.profitLoss < 0) {
        losingPositions++;
      }
    }
  }

  const totalPositionsWithPL = winningPositions + losingPositions;
  const winRate = totalPositionsWithPL > 0 
    ? (winningPositions / totalPositionsWithPL) * 100 
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

