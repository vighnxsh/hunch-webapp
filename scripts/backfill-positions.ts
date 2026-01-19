/**
 * Backfill script to migrate existing trades into Position model
 * 
 * This script:
 * 1. Groups existing trades by userId + marketTicker + side
 * 2. Creates Position records for each group
 * 3. Calculates cost basis and realized PnL from historical trades
 * 4. Links trades to their positions
 * 
 * Run with: npx tsx scripts/backfill-positions.ts
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

// Manually read .env to get DIRECT_DATABASE_URL or DATABASE_URL
const envPath = path.resolve(__dirname, '../.env');
let databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const directMatch = envContent.match(/DIRECT_DATABASE_URL="?([^"\n]+)"?/);
    const dbMatch = envContent.match(/DATABASE_URL="?([^"\n]+)"?/);
    if (directMatch) {
        databaseUrl = directMatch[1];
        console.log('Found DIRECT_DATABASE_URL in .env file');
    } else if (dbMatch) {
        databaseUrl = dbMatch[1];
        console.log('Found DATABASE_URL in .env file');
    }
}

if (databaseUrl) {
    databaseUrl = databaseUrl.trim();
}

if (!databaseUrl) {
    console.error('❌ Could not find DIRECT_DATABASE_URL or DATABASE_URL in environment or .env file');
    process.exit(1);
}

// Create Prisma Client configuration (adapter vs Accelerate)
const isAccelerate = databaseUrl.startsWith('prisma://');
const prismaConfig: { adapter?: any; accelerateUrl?: string } = {};

if (isAccelerate) {
    prismaConfig.accelerateUrl = databaseUrl;
} else {
    const pool = new Pool({ connectionString: databaseUrl });
    prismaConfig.adapter = new PrismaPg(pool);
}

const prisma = new PrismaClient(prismaConfig);

const DECIMALS = 1_000_000;

interface TradeGroup {
    userId: string;
    marketTicker: string;
    eventTicker: string | null;
    side: string;
    trades: {
        id: string;
        action: string;
        executedInAmount: string | null;
        executedOutAmount: string | null;
        createdAt: Date;
    }[];
}

async function backfillPositions() {
    console.log('🚀 Starting position backfill...\n');

    // Fetch all real trades
    const allTrades = await prisma.trade.findMany({
        where: { isDummy: false },
        orderBy: { createdAt: 'asc' },
        select: {
            id: true,
            userId: true,
            marketTicker: true,
            eventTicker: true,
            side: true,
            action: true,
            executedInAmount: true,
            executedOutAmount: true,
            createdAt: true,
            positionId: true,
        },
    });

    console.log(`📊 Found ${allTrades.length} total trades\n`);

    // Group trades by userId + marketTicker + side
    const tradeGroups = new Map<string, TradeGroup>();

    for (const trade of allTrades) {
        const key = `${trade.userId}-${trade.marketTicker}-${trade.side}`;

        if (!tradeGroups.has(key)) {
            tradeGroups.set(key, {
                userId: trade.userId,
                marketTicker: trade.marketTicker,
                eventTicker: trade.eventTicker,
                side: trade.side,
                trades: [],
            });
        }

        tradeGroups.get(key)!.trades.push({
            id: trade.id,
            action: trade.action,
            executedInAmount: trade.executedInAmount,
            executedOutAmount: trade.executedOutAmount,
            createdAt: trade.createdAt,
        });
    }

    console.log(`📦 Found ${tradeGroups.size} unique positions to create\n`);

    let created = 0;
    let updated = 0;
    let tradesLinked = 0;

    for (const [key, group] of tradeGroups) {
        // Calculate aggregated values
        let totalCostBasis = 0;
        let totalTokensBought = 0;
        let totalTokensSold = 0;
        let totalSellProceeds = 0;
        let realizedPnL = 0;

        for (const trade of group.trades) {
            if (trade.action === 'BUY') {
                // BUY: inAmount = USDC spent, outAmount = tokens received
                const usdcSpent = trade.executedInAmount ? Number(trade.executedInAmount) / DECIMALS : 0;
                const tokensReceived = trade.executedOutAmount ? Number(trade.executedOutAmount) / DECIMALS : 0;

                if (usdcSpent > 0 && tokensReceived > 0) {
                    totalCostBasis += usdcSpent;
                    totalTokensBought += tokensReceived;
                }
            } else if (trade.action === 'SELL') {
                // SELL: inAmount = tokens sold, outAmount = USDC received
                const tokensSold = trade.executedInAmount ? Number(trade.executedInAmount) / DECIMALS : 0;
                const usdcReceived = trade.executedOutAmount ? Number(trade.executedOutAmount) / DECIMALS : 0;

                if (tokensSold > 0 && usdcReceived > 0) {
                    // Calculate realized PnL using average cost method
                    if (totalTokensBought > 0) {
                        const avgCostPerToken = totalCostBasis / totalTokensBought;
                        const costBasisSold = avgCostPerToken * tokensSold;
                        realizedPnL += usdcReceived - costBasisSold;
                    }

                    totalTokensSold += tokensSold;
                    totalSellProceeds += usdcReceived;
                }
            }
        }

        // Determine status
        const remainingTokens = totalTokensBought - totalTokensSold;
        let status = 'OPEN';
        let closedAt = null;

        if (remainingTokens <= 0.0001) {
            status = 'CLOSED';
            closedAt = group.trades[group.trades.length - 1].createdAt;
        } else if (totalTokensSold > 0) {
            status = 'PARTIALLY_CLOSED';
        }

        const existingPosition = await prisma.position.findUnique({
            where: {
                userId_marketTicker_side: {
                    userId: group.userId,
                    marketTicker: group.marketTicker,
                    side: group.side,
                },
            },
            select: { id: true },
        });

        // Upsert position
        const position = await prisma.position.upsert({
            where: {
                userId_marketTicker_side: {
                    userId: group.userId,
                    marketTicker: group.marketTicker,
                    side: group.side,
                },
            },
            create: {
                userId: group.userId,
                marketTicker: group.marketTicker,
                eventTicker: group.eventTicker,
                side: group.side,
                totalCostBasis,
                totalTokensBought,
                totalTokensSold,
                totalSellProceeds,
                realizedPnL,
                status,
                closedAt,
                openedAt: group.trades[0].createdAt,
            },
            update: {
                totalCostBasis,
                totalTokensBought,
                totalTokensSold,
                totalSellProceeds,
                realizedPnL,
                status,
                closedAt,
            },
        });

        // Link trades to position
        const tradeIds = group.trades.map(t => t.id);
        await prisma.trade.updateMany({
            where: { id: { in: tradeIds } },
            data: { positionId: position.id },
        });

        tradesLinked += tradeIds.length;

        if (!existingPosition) {
            created++;
        } else {
            updated++;
        }

        console.log(`  ✅ ${group.marketTicker} (${group.side}): ${group.trades.length} trades, PnL: $${realizedPnL.toFixed(2)}`);
    }

    console.log('\n📊 Backfill Summary:');
    console.log(`  - Positions created: ${created}`);
    console.log(`  - Positions updated: ${updated}`);
    console.log(`  - Trades linked: ${tradesLinked}`);
    console.log('\n✨ Backfill complete!');
}

backfillPositions()
    .catch((e) => {
        console.error('❌ Backfill failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
