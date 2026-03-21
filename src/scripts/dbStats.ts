import mongoose from 'mongoose';
import { ENV } from '../config/env';
import fetchData from '../utils/fetchData';

const PROXY_WALLET = ENV.PROXY_WALLET;
const uri = ENV.MONGO_URI || 'mongodb://localhost:27017/polymarket_copytrading';

interface ApiPosition {
    asset: string;
    conditionId: string;
    size: number;
    avgPrice: number;
    initialValue: number;
    currentValue: number;
    cashPnl: number;
    percentPnl: number;
    curPrice: number;
    title?: string;
    outcome?: string;
    redeemable?: boolean;
}

async function main() {
    console.log('Connecting to MongoDB...\n');
    await mongoose.connect(uri);
    console.log('Connected!\n');

    // Fetch YOUR actual positions from Polymarket API
    console.log(`Fetching YOUR positions for wallet: ${PROXY_WALLET}...\n`);
    const myPositions: ApiPosition[] = await fetchData(
        `https://data-api.polymarket.com/positions?user=${PROXY_WALLET}`
    );

    const positionsByAsset = new Map<string, ApiPosition>();
    const positionsByCondition = new Map<string, ApiPosition[]>();
    if (myPositions && myPositions.length > 0) {
        for (const p of myPositions) {
            positionsByAsset.set(p.asset, p);
            const arr = positionsByCondition.get(p.conditionId) || [];
            arr.push(p);
            positionsByCondition.set(p.conditionId, arr);
        }
        console.log(`Found ${myPositions.length} positions in your wallet.\n`);
    } else {
        console.log('No positions found in your wallet via API.\n');
    }

    const db = mongoose.connection.db!;
    const collections = await db.listCollections().toArray();
    const actCols = collections.filter(c => c.name.startsWith('user_activities_'));

    console.log('============================================================');
    console.log('=== YOUR ACTUAL P&L (trades you executed) ===');
    console.log('============================================================\n');

    let grandTotalSpent = 0;
    let grandTotalCurrentValue = 0;
    let grandTotalTrades = 0;
    let grandWins = 0;
    let grandLosses = 0;
    let grandOpen = 0;
    let grandWinPnl = 0;
    let grandLossPnl = 0;
    let grandOpenUnrealized = 0;

    // Group buys by market (conditionId + outcome) to aggregate
    interface MyTrade {
        title: string;
        outcome: string;
        asset: string;
        conditionId: string;
        tokensBought: number;
        avgBuyPrice: number;
        totalSpent: number;
        tradeCount: number;
        trader: string;
        currentPrice: number;
        currentValue: number;
        pnl: number;
        status: 'won' | 'lost' | 'open';
    }

    const allTrades: MyTrade[] = [];

    for (const col of actCols) {
        const wallet = col.name.replace('user_activities_', '');
        const short = wallet.slice(0, 6) + '...' + wallet.slice(-4);
        const coll = db.collection(col.name);

        const executed = await coll.find({ myBoughtSize: { $gt: 0 } }).toArray();
        if (executed.length === 0) continue;

        // Group by asset (token ID)
        const byAsset = new Map<string, typeof executed>();
        for (const t of executed) {
            const asset = t.asset as string;
            const arr = byAsset.get(asset) || [];
            arr.push(t);
            byAsset.set(asset, arr);
        }

        for (const [asset, trades] of byAsset) {
            let totalTokens = 0;
            let totalSpent = 0;

            for (const t of trades) {
                const tokens = (t.myBoughtSize as number) || 0;
                const price = (t.price as number) || 0;
                totalTokens += tokens;
                totalSpent += tokens * price;
            }

            const avgPrice = totalTokens > 0 ? totalSpent / totalTokens : 0;
            const title = (trades[0].title as string) || 'Unknown';
            const outcome = (trades[0].outcome as string) || '?';
            const conditionId = (trades[0].conditionId as string) || '';

            // Look up current state from YOUR positions
            const myPos = positionsByAsset.get(asset);
            let currentPrice = 0;
            let currentValue = 0;
            let status: 'won' | 'lost' | 'open' = 'open';

            if (myPos) {
                currentPrice = myPos.curPrice;
                currentValue = totalTokens * currentPrice;

                if (currentPrice >= 0.99) {
                    status = 'won';
                } else if (currentPrice <= 0.01) {
                    status = 'lost';
                } else {
                    status = 'open';
                }
            } else {
                // Position not found - might have been resolved/redeemed
                // Check trader's position data
                const posCol = `user_positions_${wallet}`;
                const hasCol = collections.some(c => c.name === posCol);
                if (hasCol) {
                    const traderPos = await db.collection(posCol).findOne({ asset });
                    if (traderPos) {
                        currentPrice = (traderPos.curPrice as number) || 0;
                        if (currentPrice >= 0.99) {
                            status = 'won';
                            currentValue = totalTokens * 1.0;
                        } else if (currentPrice <= 0.01) {
                            status = 'lost';
                            currentValue = 0;
                        } else {
                            status = 'open';
                            currentValue = totalTokens * currentPrice;
                        }
                    }
                }
            }

            const pnl = currentValue - totalSpent;

            allTrades.push({
                title, outcome, asset, conditionId,
                tokensBought: totalTokens,
                avgBuyPrice: avgPrice,
                totalSpent,
                tradeCount: trades.length,
                trader: short,
                currentPrice, currentValue, pnl, status,
            });

            grandTotalSpent += totalSpent;
            grandTotalCurrentValue += currentValue;
            grandTotalTrades += trades.length;

            if (status === 'won') { grandWins++; grandWinPnl += pnl; }
            else if (status === 'lost') { grandLosses++; grandLossPnl += pnl; }
            else { grandOpen++; grandOpenUnrealized += pnl; }
        }
    }

    // Sort by PnL
    const winners = allTrades.filter(t => t.status === 'won').sort((a, b) => b.pnl - a.pnl);
    const losers = allTrades.filter(t => t.status === 'lost').sort((a, b) => a.pnl - b.pnl);
    const open = allTrades.filter(t => t.status === 'open').sort((a, b) => b.pnl - a.pnl);

    // Display WINS
    console.log(`--- WINS (${winners.length} markets) ---`);
    for (const t of winners) {
        console.log(`  +$${t.pnl.toFixed(2)} | Spent $${t.totalSpent.toFixed(2)} -> Worth $${t.currentValue.toFixed(2)} | ${t.tokensBought.toFixed(2)} tokens @ $${t.avgBuyPrice.toFixed(3)} | ${t.title} [${t.outcome}] (${t.trader})`);
    }

    // Display LOSSES
    console.log(`\n--- LOSSES (${losers.length} markets) ---`);
    for (const t of losers) {
        console.log(`  -$${Math.abs(t.pnl).toFixed(2)} | Spent $${t.totalSpent.toFixed(2)} -> Worth $${t.currentValue.toFixed(2)} | ${t.tokensBought.toFixed(2)} tokens @ $${t.avgBuyPrice.toFixed(3)} | ${t.title} [${t.outcome}] (${t.trader})`);
    }

    // Display OPEN
    console.log(`\n--- OPEN POSITIONS (${open.length} markets) ---`);
    for (const t of open) {
        const sign = t.pnl >= 0 ? '+' : '-';
        console.log(`  ${sign}$${Math.abs(t.pnl).toFixed(2)} | Spent $${t.totalSpent.toFixed(2)} -> Worth $${t.currentValue.toFixed(2)} | ${t.tokensBought.toFixed(2)} tokens @ $${t.avgBuyPrice.toFixed(3)}, now $${t.currentPrice.toFixed(3)} | ${t.title} [${t.outcome}] (${t.trader})`);
    }

    // Summary
    const totalPnl = grandWinPnl + grandLossPnl + grandOpenUnrealized;
    console.log('\n============================================================');
    console.log('=== SUMMARY ===');
    console.log('============================================================');
    console.log(`  Total trades executed: ${grandTotalTrades}`);
    console.log(`  Unique markets: ${allTrades.length}`);
    console.log(`  Total spent: $${grandTotalSpent.toFixed(2)}`);
    console.log(`  Current value: $${grandTotalCurrentValue.toFixed(2)}`);
    console.log('');
    console.log(`  Resolved wins: ${grandWins} (+$${grandWinPnl.toFixed(2)})`);
    console.log(`  Resolved losses: ${grandLosses} (-$${Math.abs(grandLossPnl).toFixed(2)})`);
    console.log(`  Open positions: ${grandOpen} (unrealized: ${grandOpenUnrealized >= 0 ? '+' : '-'}$${Math.abs(grandOpenUnrealized).toFixed(2)})`);
    console.log('');
    console.log(`  Realized P&L: ${(grandWinPnl + grandLossPnl) >= 0 ? '+' : '-'}$${Math.abs(grandWinPnl + grandLossPnl).toFixed(2)}`);
    console.log(`  Total P&L (incl. open): ${totalPnl >= 0 ? '+' : '-'}$${Math.abs(totalPnl).toFixed(2)}`);

    const winRate = (grandWins + grandLosses) > 0 ? ((grandWins / (grandWins + grandLosses)) * 100).toFixed(1) : 'N/A';
    console.log(`  Win rate (resolved): ${winRate}%`);

    await mongoose.disconnect();
    console.log('\nDone!');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
