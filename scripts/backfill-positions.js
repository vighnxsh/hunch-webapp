/**
 * Backfill script to migrate existing trades into Position model
 * 
 * Run with: node scripts/backfill-positions.js
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Manually read .env to get DATABASE_URL or DIRECT_DATABASE_URL
const envPath = path.resolve(__dirname, '../.env');
let databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (fs.existsSync(envPath) && !databaseUrl) {
    const envContent = fs.readFileSync(envPath, 'utf8');

    // Try to find DIRECT_DATABASE_URL first
    let match = envContent.match(/DIRECT_DATABASE_URL="?([^"\n]+)"?/);
    if (match) {
        databaseUrl = match[1];
        console.log('Found DIRECT_DATABASE_URL in .env file');
    } else {
        // Fallback to DATABASE_URL
        match = envContent.match(/DATABASE_URL="?([^"\n]+)"?/);
        if (match) {
            databaseUrl = match[1];
            console.log('Found DATABASE_URL in .env file');
        }
    }
}

if (!databaseUrl) {
    console.error('❌ Could not find DATABASE_URL or DIRECT_DATABASE_URL in environment or .env file');
    process.exit(1);
}

// Ensure the URL is valid for standard Prisma (e.g. modify headers if needed, but usually fine)
// Set env var so Prisma picks it up automatically - this is the most reliable method
process.env.DATABASE_URL = databaseUrl;

console.log('Initializing standard Prisma Client...');
const prisma = new PrismaClient();

const DECIMALS = 1_000_000;

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
    const tradeGroups = new Map();

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

        tradeGroups.get(key).trades.push({
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
                const usdcSpent = trade.executedInAmount ? Number(trade.executedInAmount) / DECIMALS : 0;
                const tokensReceived = trade.executedOutAmount ? Number(trade.executedOutAmount) / DECIMALS : 0;

                if (usdcSpent > 0 && tokensReceived > 0) {
                    totalCostBasis += usdcSpent;
                    totalTokensBought += tokensReceived;
                }
            } else if (trade.action === 'SELL') {
                const tokensSold = trade.executedInAmount ? Number(trade.executedInAmount) / DECIMALS : 0;
                const usdcReceived = trade.executedOutAmount ? Number(trade.executedOutAmount) / DECIMALS : 0;

                if (tokensSold > 0 && usdcReceived > 0) {
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

        const remainingTokens = totalTokensBought - totalTokensSold;
        let status = 'OPEN';
        let closedAt = null;

        if (remainingTokens <= 0.0001) {
            status = 'CLOSED';
            closedAt = group.trades[group.trades.length - 1].createdAt;
        } else if (totalTokensSold > 0) {
            status = 'PARTIALLY_CLOSED';
        }

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

        const tradeIds = group.trades.map(t => t.id);
        await prisma.trade.updateMany({
            where: { id: { in: tradeIds } },
            data: { positionId: position.id },
        });

        tradesLinked += tradeIds.length;

        if (position.createdAt.getTime() === position.updatedAt.getTime()) {
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
