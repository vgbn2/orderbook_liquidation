import { BacktestResult, TradeResult } from './backtester';

export function parseCSVToTrades(csvText: string): TradeResult[] {
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    // Fallback if headers aren't perfect, we try to auto-detect
    const entryTimeIdx = headers.findIndex(h => h.includes('entry') && h.includes('time') || h === 'time in');
    const exitTimeIdx = headers.findIndex(h => h.includes('exit') && h.includes('time') || h === 'time out');
    const entryPriceIdx = headers.findIndex(h => h.includes('entry') && h.includes('price') || h === 'price in');
    const exitPriceIdx = headers.findIndex(h => h.includes('exit') && h.includes('price') || h === 'price out');
    const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('side') || h.includes('direction'));
    const pnlIdx = headers.findIndex(h => h === 'pnl');
    const pnlPctIdx = headers.findIndex(h => h.includes('pnl') && h.includes('%') || h === 'return');
    const reasonIdx = headers.findIndex(h => h.includes('reason'));

    // If we can't find core fields, throw
    if (entryPriceIdx === -1 || exitPriceIdx === -1 || typeIdx === -1) {
        throw new Error('CSV must contain Entry Price, Exit Price, and Type/Side columns.');
    }

    const trades: TradeResult[] = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());

        const typeStr = cols[typeIdx].toUpperCase();
        const type = typeStr.includes('LONG') || typeStr === 'BUY' ? 'LONG' : 'SHORT';

        const entryPrice = parseFloat(cols[entryPriceIdx]);
        const exitPrice = parseFloat(cols[exitPriceIdx]);

        let pnlPct = 0;
        if (pnlPctIdx !== -1 && cols[pnlPctIdx]) {
            pnlPct = parseFloat(cols[pnlPctIdx].replace('%', ''));
        } else {
            pnlPct = type === 'LONG' ? (exitPrice - entryPrice) / entryPrice * 100 : (entryPrice - exitPrice) / entryPrice * 100;
        }

        let pnl = 0;
        if (pnlIdx !== -1 && cols[pnlIdx]) {
            pnl = parseFloat(cols[pnlIdx]);
        }

        // Try parsing dates, fallback to index
        let entryTime = i;
        if (entryTimeIdx !== -1 && cols[entryTimeIdx]) {
            const parsed = new Date(cols[entryTimeIdx]).getTime();
            if (!isNaN(parsed)) entryTime = parsed / 1000;
        }

        let exitTime = i + 1;
        if (exitTimeIdx !== -1 && cols[exitTimeIdx]) {
            const parsed = new Date(cols[exitTimeIdx]).getTime();
            if (!isNaN(parsed)) exitTime = parsed / 1000;
        }

        let reason: 'TP' | 'SL' | 'CONDITION' = 'CONDITION';
        if (reasonIdx !== -1 && cols[reasonIdx]) {
            const r = cols[reasonIdx].toUpperCase();
            if (r.includes('TP') || r.includes('PROFIT')) reason = 'TP';
            if (r.includes('SL') || r.includes('LOSS')) reason = 'SL';
        }

        trades.push({
            entryTime,
            exitTime,
            entryPrice,
            exitPrice,
            type,
            pnl,
            pnlPct,
            reason
        });
    }

    // Sort chronologically just in case
    return trades.sort((a, b) => a.entryTime - b.entryTime);
}

// Mimics the logic at the end of singleRunBacktest to compile a standard result object
export function calculateStatsFromTrades(trades: TradeResult[], initialBalance: number = 10000): BacktestResult {
    let currentBalance = initialBalance;
    const equityCurve: { time: number, value: number }[] = [];
    const monthlyReturnsMap: Map<string, number> = new Map();

    let maxBalance = initialBalance;
    let maxDrawdown = 0;

    let totalFees = 0; // if CSV doesn't have fees, it's 0
    let totalWin = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    const drawdownCurve: { time: number; value: number }[] = [];

    // Process trade by trade to build equity curve
    for (const trade of trades) {
        // Assume trade.pnl is absolute return per unit. If pnl is calculated from position sizing, 
        // a simple CSV might just expect us to compound `pnlPct` against full balance
        const tradeReturn = currentBalance * (trade.pnlPct / 100);
        currentBalance += tradeReturn;

        equityCurve.push({ time: trade.exitTime, value: currentBalance });

        if (currentBalance > maxBalance) {
            maxBalance = currentBalance;
        }
        const drawdownPct = maxBalance > 0 ? ((maxBalance - currentBalance) / maxBalance) * 100 : 0;
        if (drawdownPct > maxDrawdown) maxDrawdown = drawdownPct;
        drawdownCurve.push({ time: trade.exitTime, value: drawdownPct });

        if (trade.pnlPct > 0) {
            totalWin++;
            currentWinStreak++;
            currentLossStreak = 0;
            if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
        } else {
            currentLossStreak++;
            currentWinStreak = 0;
            if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
        }

        // Monthly tracking
        const date = new Date(trade.exitTime * 1000);
        const yKey = date.getFullYear();
        const mKey = date.getMonth();
        const key = `${yKey}-${mKey}`;
        const existing = monthlyReturnsMap.get(key) || 0;
        monthlyReturnsMap.set(key, existing + trade.pnlPct);
    }

    const netPnL = currentBalance - initialBalance;
    const netReturnPct = (netPnL / initialBalance) * 100;
    const winRate = trades.length > 0 ? (totalWin / trades.length) * 100 : 0;

    // Monthly Heatmap
    const monthlyReturns: { year: number; month: number; returnPct: number }[] = [];
    monthlyReturnsMap.forEach((val, key) => {
        const [y, m] = key.split('-');
        monthlyReturns.push({ year: parseInt(y), month: parseInt(m), returnPct: val });
    });

    const sharpeRatio = trades.length > 0 ? (netReturnPct / trades.length) / (maxDrawdown > 0 ? (maxDrawdown / Math.sqrt(trades.length)) : 1) : 0;

    // We don't have underlying asset data, so BAH is assumed flat
    const bahCurve = equityCurve.map(p => ({ time: p.time, value: initialBalance }));

    return {
        trades,
        totalTrades: trades.length,
        winRate,
        initialBalance,
        finalBalance: currentBalance,
        netPnL,
        netReturnPct,
        bahFinalValue: initialBalance,
        bahReturnPct: 0,
        sharpeRatio,
        maxDrawdown,
        maxProfitDrawdown: 0,
        maxProfitDrawdownPct: 0,
        equityCurve,
        bahCurve,
        totalPnL: trades.reduce((sum, t) => sum + t.pnlPct, 0),
        monthlyReturns,
        drawdownCurve,
        totalFees,
        entryFees: 0,
        exitFees: 0,
        holdingFees: 0,
        alpha: netReturnPct,
        beta: 0,
        marketExposure: 0,
        waveContributionPct: 0,
        ev: trades.length > 0 ? trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length : 0,
        timeUnderDrawdownPct: 0,
        timeUnderDrawdownDays: 0,
        activeRecoveryPct: 0,
        waitingForSetupPct: 0,
        maxWinStreak,
        maxLossStreak,
        meanBalance: 0,
        stdDevBalance: 0,
        consolidationRange: 0,
        slippageCosts: 0
    };
}
