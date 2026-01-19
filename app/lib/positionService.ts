import { prisma } from './db';
import { type Market, type EventDetails } from './api';
import { fetchMarketDetailsServer, fetchEventDetailsServer, filterOutcomeMintsServer, fetchMarketsBatchServer } from './dflowServer';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

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
  // New PnL fields from Position model
  totalCostBasis: number;
  totalTokensBought: number;
  totalTokensSold: number;
  totalSellProceeds: number;
  realizedPnL: number;
  unrealizedPnL: number | null;
  totalPnL: number | null;
  positionStatus: 'OPEN' | 'CLOSED' | 'PARTIALLY_CLOSED';
}

export interface PositionsByStatus {
  active: AggregatedPosition[];
  previous: AggregatedPosition[];
}

/**
 * Get all user positions with P&L calculations
 */
export async function getUserPositions(userId: string): Promise<PositionsByStatus> {
  // Positions are derived from onchain token holdings (source of truth),
  // then mapped to markets via the Metadata API (per retrive_token.md).
  // Accept either a DB userId or (fallback) a wallet address string.
  let walletAddress: string | null = null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletAddress: true },
  });
  if (user?.walletAddress) {
    walletAddress = user.walletAddress;
  } else {
    // Fallback: if caller passed a wallet address instead of a DB id.
    walletAddress = userId;
  }

  if (!walletAddress) return { active: [], previous: [] };

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');
  const owner = new PublicKey(walletAddress);

  const [tokenAccounts2022, tokenAccountsLegacy] = await Promise.all([
    connection
      .getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID })
      .catch(() => ({ value: [] as any[] })),
    connection
      .getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID })
      .catch(() => ({ value: [] as any[] })),
  ]);

  const allAccounts = [...tokenAccounts2022.value, ...tokenAccountsLegacy.value];

  const userTokens = allAccounts
    .map(({ account }) => {
      const info = (account.data as any).parsed.info;
      return {
        mint: info.mint as string,
        rawBalance: info.tokenAmount.amount as string,
        balance: Number(info.tokenAmount.uiAmount || 0),
        decimals: Number(info.tokenAmount.decimals || 0),
      };
    })
    .filter((t) => t.balance > 0);

  if (userTokens.length === 0) {
    return { active: [], previous: [] };
  }

  // Filter to prediction-market outcome mints using server-side function
  // This avoids the relative URL issue that occurs when calling from API routes
  const outcomeMints = await filterOutcomeMintsServer(userTokens.map((t) => t.mint));

  if (!outcomeMints || outcomeMints.length === 0) {
    return { active: [], previous: [] };
  }

  const outcomeTokenBalances = userTokens.filter((t) => outcomeMints.includes(t.mint));
  if (outcomeTokenBalances.length === 0) {
    return { active: [], previous: [] };
  }

  const markets = await fetchMarketsBatchServer(outcomeMints);

  // Build mint -> market mapping (yesMint/noMint/marketLedger)
  const marketByMint = new Map<string, Market>();
  for (const market of markets) {
    if (!market?.accounts) continue;

    const accountsAny = market.accounts as any;
    // Some responses have accounts keyed by settlement mint; others are flat.
    if (typeof accountsAny === 'object') {
      for (const v of Object.values(accountsAny)) {
        const acct = v as any;
        if (acct?.yesMint) marketByMint.set(acct.yesMint, market);
        if (acct?.noMint) marketByMint.set(acct.noMint, market);
        if (acct?.marketLedger) marketByMint.set(acct.marketLedger, market);
      }
    }
  }

  // Aggregate by market ticker + side using onchain balances as the quantity.
  const positionsMap = new Map<string, AggregatedPosition>();
  for (const tok of outcomeTokenBalances) {
    const market = marketByMint.get(tok.mint) || null;
    if (!market) continue;

    const side = inferSideFromMint(market, tok.mint);
    if (side === 'unknown') continue;

    const key = `${market.ticker}-${side}`;
    if (!positionsMap.has(key)) {
      positionsMap.set(key, {
        marketTicker: market.ticker,
        eventTicker: market.eventTicker || null,
        side,
        totalTokenAmount: 0,
        totalUsdcAmount: 0,
        averageEntryPrice: 0,
        currentPrice: null,
        currentValue: null,
        profitLoss: null,
        profitLossPercentage: null,
        tradeCount: 0,
        market,
        eventImageUrl: null,
        trades: [],
        // New PnL fields - will be populated from Position model
        totalCostBasis: 0,
        totalTokensBought: 0,
        totalTokensSold: 0,
        totalSellProceeds: 0,
        realizedPnL: 0,
        unrealizedPnL: null,
        totalPnL: null,
        positionStatus: 'OPEN',
      });
    }

    const pos = positionsMap.get(key)!;
    pos.totalTokenAmount += tok.balance;
  }

  // Fetch DB trades to find sold positions (zero balance)
  let dbId = user ? userId : null;
  if (!dbId && walletAddress) {
    const u = await prisma.user.findUnique({ where: { walletAddress } });
    if (u) dbId = u.id;
  }

  if (dbId) {
    const dbTrades = await prisma.trade.findMany({
      where: { userId: dbId },
      select: { marketTicker: true, side: true },
      distinct: ['marketTicker', 'side'],
    });

    for (const trade of dbTrades) {
      const key = `${trade.marketTicker}-${trade.side}`;
      if (!positionsMap.has(key)) {
        try {
          // Check if we already have the market in our batch
          let market = markets.find(m => m.ticker === trade.marketTicker);

          // If not, fetch it individually using server-side function
          if (!market) {
            market = await fetchMarketDetailsServer(trade.marketTicker);
          }

          if (market) {
            positionsMap.set(key, {
              marketTicker: market.ticker,
              eventTicker: market.eventTicker || null,
              side: trade.side as 'yes' | 'no',
              totalTokenAmount: 0,
              totalUsdcAmount: 0,
              averageEntryPrice: 0,
              currentPrice: null,
              currentValue: null,
              profitLoss: null,
              profitLossPercentage: null,
              tradeCount: 0,
              market,
              eventImageUrl: null,
              trades: [],
              // New PnL fields - will be populated from Position model
              totalCostBasis: 0,
              totalTokensBought: 0,
              totalTokensSold: 0,
              totalSellProceeds: 0,
              realizedPnL: 0,
              unrealizedPnL: null,
              totalPnL: null,
              positionStatus: 'CLOSED',
            });
          }
        } catch (e) {
          console.error(`Failed to fetch market details for sold position ${trade.marketTicker}:`, e);
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

  // Fetch Position model data for PnL information
  const positionModels = await prisma.position.findMany({
    where: { userId: dbId || undefined },
  });
  const positionModelMap = new Map(
    positionModels.map((p) => [`${p.marketTicker}-${p.side}`, p])
  );

  // Compute current value and merge Position model data
  for (const pos of positions) {
    if (pos.eventTicker) pos.eventImageUrl = eventImagesMap.get(pos.eventTicker) || null;

    // Get Position model data
    const key = `${pos.marketTicker}-${pos.side}`;
    const positionModel = positionModelMap.get(key);

    if (positionModel) {
      pos.totalCostBasis = positionModel.totalCostBasis;
      pos.totalTokensBought = positionModel.totalTokensBought;
      pos.totalTokensSold = positionModel.totalTokensSold;
      pos.totalSellProceeds = positionModel.totalSellProceeds;
      pos.realizedPnL = positionModel.realizedPnL;
      pos.positionStatus = positionModel.status as 'OPEN' | 'CLOSED' | 'PARTIALLY_CLOSED';
      pos.tradeCount = positionModel.totalTokensBought > 0 ? 1 : 0; // Will be updated with actual trade count

      // Calculate average entry price
      if (positionModel.totalTokensBought > 0) {
        pos.averageEntryPrice = positionModel.totalCostBasis / positionModel.totalTokensBought;
        pos.totalUsdcAmount = positionModel.totalCostBasis;
      }
    }

    if (pos.market) {
      const currentPrice = getCurrentMarketPrice(pos.market, pos.side);
      pos.currentPrice = currentPrice;

      if (currentPrice !== null && pos.totalTokenAmount > 0) {
        pos.currentValue = pos.totalTokenAmount * currentPrice;

        // Calculate unrealized PnL for remaining tokens
        if (pos.totalTokensBought > 0) {
          const remainingTokens = pos.totalTokensBought - pos.totalTokensSold;
          const remainingCostBasis = (pos.totalCostBasis / pos.totalTokensBought) * remainingTokens;
          pos.unrealizedPnL = pos.currentValue - remainingCostBasis;
          pos.totalPnL = pos.realizedPnL + pos.unrealizedPnL;

          // Calculate profitLoss and profitLossPercentage for display
          pos.profitLoss = pos.totalPnL;
          if (remainingCostBasis > 0) {
            pos.profitLossPercentage = (pos.totalPnL / remainingCostBasis) * 100;
          }
        }
      }
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

function inferSideFromMint(market: Market, outcomeMint: string): 'yes' | 'no' | 'unknown' {
  const accountsAny = market.accounts as any;
  if (!accountsAny) return 'unknown';

  // accounts may be keyed by settlement mint -> account object
  if (typeof accountsAny === 'object') {
    for (const v of Object.values(accountsAny)) {
      const acct = v as any;
      if (acct?.yesMint === outcomeMint) return 'yes';
      if (acct?.noMint === outcomeMint) return 'no';
    }
  }

  // fallback to top-level fields if present
  if ((market as any).yesMint === outcomeMint) return 'yes';
  if ((market as any).noMint === outcomeMint) return 'no';
  return 'unknown';
}

/**
 * Separate positions into active and previous based on market status
 */
function separateByMarketStatus(positions: AggregatedPosition[]): PositionsByStatus {
  const active: AggregatedPosition[] = [];
  const previous: AggregatedPosition[] = [];

  for (const position of positions) {
    // If sold (zero balance), it goes to previous
    if (position.totalTokenAmount === 0) {
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

  // With entry-only DB, we don't have cost basis on server, so P&L stats are not meaningful.
  // Return counts only; profit/loss-related fields default to 0.
  return {
    totalProfitLoss: 0,
    totalPositions: allPositions.length,
    activePositions: active.length,
    winningPositions: 0,
    losingPositions: 0,
    winRate: 0,
  };
}

