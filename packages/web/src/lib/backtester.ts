import { CandleData } from '../stores/marketStore';
import { computeVRVP } from './vrvp';

export interface BacktestConfig {
    name: string;
    buyCondition: string; // e.g., "close > sma20"
    sellCondition: string; // e.g., "close < sma20"
    stopLossPct?: number; // e.g., 2.0 = 2%
    takeProfitPct?: number; // e.g., 5.0 = 5%
    initialBalance?: number;
    indicators: {
        name: string;
        type: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'ICT' | 'VRVP';
        period: number;
    }[];
    entryFeePct?: number;
    exitFeePct?: number;
    holdingFeePct?: number;
    minDrawdownThresholdPct?: number; // Filter for TUD
    slippagePct?: number; // Institutional slippage
    symbols?: string[]; // Portfolio mode
}

export interface TradeResult {
    entryTime: number;
    exitTime: number;
    entryPrice: number;
    exitPrice: number;
    type: 'LONG' | 'SHORT';
    pnl: number;
    pnlPct: number;
    reason: 'TP' | 'SL' | 'CONDITION';
}

export interface BacktestResult {
    trades: TradeResult[];
    totalTrades: number;
    winRate: number;
    initialBalance: number;
    finalBalance: number;
    netPnL: number;
    netReturnPct: number;
    bahFinalValue: number;
    bahReturnPct: number;
    sharpeRatio: number;
    maxDrawdown: number;
    maxProfitDrawdown: number;
    maxProfitDrawdownPct: number;
    equityCurve: { time: number, value: number }[];
    bahCurve: { time: number, value: number }[];
    totalPnL: number;
    monthlyReturns: { year: number; month: number; returnPct: number }[];
    drawdownCurve: { time: number; value: number }[];
    totalFees: number;
    entryFees: number;
    exitFees: number;
    holdingFees: number;
    alpha: number;
    beta: number;
    marketExposure: number;
    waveContributionPct: number;
    ev: number;
    timeUnderDrawdownPct: number;
    timeUnderDrawdownDays: number;
    activeRecoveryPct: number;
    waitingForSetupPct: number;
    maxWinStreak: number;
    maxLossStreak: number;
    meanBalance: number;
    stdDevBalance: number;
    consolidationRange: number;
    slippageCosts: number;
    monteCarlo?: {
        probOfRuin: number;
        confidenceIntervals: { p5: number; p50: number; p95: number };
    };
}

function calculateSMA(data: number[], period: number) {
    const res: number[] = new Array(data.length).fill(0);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i];
        if (i >= period) {
            sum -= data[i - period];
            res[i] = sum / period;
        } else {
            res[i] = sum / (i + 1);
        }
    }
    return res;
}

function calculateEMA(data: number[], period: number) {
    const res: number[] = new Array(data.length).fill(0);
    if (!data.length) return res;
    const k = 2 / (period + 1);
    let ema = data[0];
    res[0] = ema;
    for (let i = 1; i < data.length; i++) {
        ema = (data[i] * k) + (ema * (1 - k));
        res[i] = ema;
    }
    return res;
}

function calculateRSI(data: number[], period: number) {
    const res: number[] = new Array(data.length).fill(50);
    if (data.length <= period) return res;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = data[i] - data[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        const gain = diff >= 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;
        res[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    }
    return res;
}

function calculateICT(candles: CandleData[], lookback: number) {
    const fvgBull = new Array(candles.length).fill(0);
    const fvgBear = new Array(candles.length).fill(0);
    const sweepBsl = new Array(candles.length).fill(0);
    const sweepSsl = new Array(candles.length).fill(0);

    const activeFvgBull: { top: number; bottom: number }[] = [];
    const activeFvgBear: { top: number; bottom: number }[] = [];

    for (let i = 2; i < candles.length; i++) {
        const c0 = candles[i - 2], c1 = candles[i - 1], c2 = candles[i];

        // Detect FVG
        if (c2.low > c0.high && c2.low - c0.high > c1.close * 0.0003) {
            activeFvgBull.push({ top: c2.low, bottom: c0.high });
        }
        if (c2.high < c0.low && c0.low - c2.high > c1.close * 0.0003) {
            activeFvgBear.push({ top: c0.low, bottom: c2.high });
        }

        // Evaluate FVG presence
        let isBull = 0;
        for (let j = activeFvgBull.length - 1; j >= 0; j--) {
            const fvg = activeFvgBull[j];
            if (c2.low <= fvg.top && c2.high >= fvg.bottom) isBull = 1;
            if (c2.low <= fvg.bottom) activeFvgBull.splice(j, 1); // Filled
        }
        fvgBull[i] = isBull;

        let isBear = 0;
        for (let j = activeFvgBear.length - 1; j >= 0; j--) {
            const fvg = activeFvgBear[j];
            if (c2.high >= fvg.bottom && c2.low <= fvg.top) isBear = 1;
            if (c2.high >= fvg.top) activeFvgBear.splice(j, 1); // Filled
        }
        fvgBear[i] = isBear;

        // Sweeps
        if (i >= lookback) {
            let maxHigh = -Infinity, minLow = Infinity;
            for (let j = i - lookback; j < i; j++) {
                if (candles[j].high > maxHigh) maxHigh = candles[j].high;
                if (candles[j].low < minLow) minLow = candles[j].low;
            }
            if (c2.high > maxHigh && c2.close < maxHigh) sweepBsl[i] = 1;
            if (c2.low < minLow && c2.close > minLow) sweepSsl[i] = 1;
        }
    }

    return { fvgBull, fvgBear, sweepBsl, sweepSsl };
}

function calculateVRVP(candles: CandleData[], period: number) {
    const poc = new Array(candles.length).fill(0);
    const vah = new Array(candles.length).fill(0);
    const val = new Array(candles.length).fill(0);
    for (let i = period; i < candles.length; i++) {
        const slice = candles.slice(i - period, i + 1);
        const profile = computeVRVP(slice, 50);
        if (profile) {
            poc[i] = profile.poc;
            vah[i] = profile.vah;
            val[i] = profile.val;
        }
    }
    return { poc, vah, val };
}

export function runBacktest(data: CandleData[] | Record<string, CandleData[]>, configOrJson: BacktestConfig | string): BacktestResult {
    const config: BacktestConfig = typeof configOrJson === 'string' ? JSON.parse(configOrJson) : configOrJson;
    const multiData: Record<string, CandleData[]> = Array.isArray(data) ? { "Price": data } : data;
    const symbols = Object.keys(multiData);

    if (symbols.length === 0) throw new Error("No market data provided");

    const initialBalance = config.initialBalance || 10000;
    const symbolsToRun = config.symbols && config.symbols.length > 0 ? config.symbols : symbols;

    // Single Asset Mode
    if (symbolsToRun.length === 1) {
        const sym = symbolsToRun[0];
        if (!multiData[sym]) throw new Error(`Data for symbol ${sym} not found`);
        return runSingleBacktest(multiData[sym], config, initialBalance);
    }

    // Portfolio Mode
    const individualResults: BacktestResult[] = symbolsToRun.map(sym => {
        if (!multiData[sym]) throw new Error(`Data for symbol ${sym} not found`);
        const allocation = initialBalance / symbolsToRun.length;
        return runSingleBacktest(multiData[sym], { ...config, initialBalance: allocation }, allocation);
    });

    // Merge Results
    const portfolioTrades = individualResults.flatMap(r => r.trades).sort((a, b) => a.entryTime - b.entryTime);
    const timeToEquityMap: Record<number, number> = {};
    const timeToBahMap: Record<number, number> = {};

    individualResults.forEach(r => {
        r.equityCurve.forEach(p => timeToEquityMap[p.time] = (timeToEquityMap[p.time] || 0) + p.value);
        r.bahCurve.forEach(p => timeToBahMap[p.time] = (timeToBahMap[p.time] || 0) + p.value);
    });

    const sortedTimes = Object.keys(timeToEquityMap).map(Number).sort((a, b) => a - b);
    const portfolioEquityCurve = sortedTimes.map(t => ({ time: t, value: timeToEquityMap[t] }));
    const portfolioBahCurve = sortedTimes.map(t => ({ time: t, value: timeToBahMap[t] || initialBalance }));

    return calculateBacktestMetrics(
        config,
        portfolioEquityCurve,
        portfolioBahCurve,
        portfolioTrades,
        initialBalance,
        portfolioEquityCurve[portfolioEquityCurve.length - 1].value,
        individualResults.reduce((s, r) => s + r.entryFees, 0),
        individualResults.reduce((s, r) => s + r.exitFees, 0),
        individualResults.reduce((s, r) => s + r.holdingFees, 0),
        individualResults.reduce((s, r) => s + r.slippageCosts, 0),
        individualResults.reduce((s, r) => s + (r.marketExposure * (multiData[symbolsToRun[0]].length / 100)), 0),
        individualResults.reduce((s, r) => s + (r.netPnL * (r.waveContributionPct / 100)), 0),
        Math.max(...(config.indicators || []).map(i => i.period), 1),
        sortedTimes.map(t => individualResults.some(r => r.trades.some(tr => t >= tr.entryTime && t <= tr.exitTime))),
        multiData[symbolsToRun[0]]
    );
}

function runSingleBacktest(candles: CandleData[], config: BacktestConfig, initialBalance: number): BacktestResult {
    let balance = initialBalance;
    const equityCurve: { time: number; value: number }[] = [];
    const inMarketCurve: boolean[] = [];
    const trades: TradeResult[] = [];
    let position: { entryPrice: number; entryTime: number; qty: number; stopPrice: number; tpPrice: number } | null = null;

    let entryFees = 0, exitFees = 0, totalHoldingFees = 0, totalSlippageCosts = 0, currentTradeHoldingFees = 0, barsInMarket = 0, wavePnL = 0;

    const env: Record<string, number[]> = {
        open: candles.map(c => c.open),
        high: candles.map(c => c.high),
        low: candles.map(c => c.low),
        close: candles.map(c => c.close),
        volume: candles.map(c => c.volume),
        time: candles.map(c => c.time)
    };

    if (config.indicators) {
        config.indicators.forEach(ind => {
            if (ind.type === 'SMA') env[ind.name] = calculateSMA(env.close, ind.period);
            else if (ind.type === 'EMA') env[ind.name] = calculateEMA(env.close, ind.period);
            else if (ind.type === 'RSI') env[ind.name] = calculateRSI(env.close, ind.period);
            else if (ind.type === 'ICT') {
                const ict = calculateICT(candles, ind.period);
                env[`${ind.name}_fvg_bull`] = ict.fvgBull;
                env[`${ind.name}_fvg_bear`] = ict.fvgBear;
                env[`${ind.name}_sweep_bsl`] = ict.sweepBsl;
                env[`${ind.name}_sweep_ssl`] = ict.sweepSsl;
            }
            else if (ind.type === 'VRVP') {
                const vrvp = calculateVRVP(candles, ind.period);
                env[`${ind.name}_poc`] = vrvp.poc;
                env[`${ind.name}_vah`] = vrvp.vah;
                env[`${ind.name}_val`] = vrvp.val;
            }
        });
    }

    const compileCondition = (expr: string) => {
        const vars = Object.keys(env);
        const fnBody = `${vars.map(v => `const ${v} = env.${v}[i];`).join('\n')}\nreturn ${expr};`;
        return new Function('env', 'i', fnBody);
    };

    const buyFn = compileCondition(config.buyCondition);
    const sellFn = compileCondition(config.sellCondition);
    const bahQty = initialBalance / candles[0].close;
    const bahCurve = candles.map(c => ({ time: c.time, value: bahQty * c.close }));
    const warmupPeriod = Math.max(...(config.indicators || []).map(i => i.period), 1);

    for (let i = 0; i < candles.length; i++) {
        const c = candles[i], price = c.close;
        if (i < warmupPeriod) {
            equityCurve.push({ time: c.time, value: balance });
            inMarketCurve.push(false);
            continue;
        }

        if (position) {
            barsInMarket++;
            const move = (price - candles[i - 1].close) / candles[i - 1].close;
            wavePnL += (position.qty * candles[i - 1].close) * move;

            if (config.holdingFeePct) {
                const hf = (position.qty * price) * (config.holdingFeePct / 100);
                currentTradeHoldingFees += hf; totalHoldingFees += hf;
            }

            let exitReason: 'TP' | 'SL' | 'CONDITION' | null = null;
            if (config.takeProfitPct && price >= position.tpPrice) exitReason = 'TP';
            else if (config.stopLossPct && price <= position.stopPrice) exitReason = 'SL';
            else if (sellFn(env, i)) exitReason = 'CONDITION';

            if (exitReason) {
                let exitPrice = exitReason === 'TP' ? position.tpPrice : (exitReason === 'SL' ? position.stopPrice : price);
                if (config.slippagePct) {
                    const sip = exitPrice * (config.slippagePct / 100);
                    totalSlippageCosts += (sip * position.qty);
                    exitPrice -= sip;
                }
                const pnl = (exitPrice - position.entryPrice) * position.qty;
                balance += (position.entryPrice * position.qty) + pnl;
                if (config.exitFeePct) {
                    const ef = (position.qty * exitPrice) * (config.exitFeePct / 100);
                    exitFees += ef; balance -= ef;
                }
                balance -= currentTradeHoldingFees;
                const fees = (config.entryFeePct ? (position.qty * position.entryPrice * (config.entryFeePct / 100)) : 0) +
                    (config.exitFeePct ? (position.qty * exitPrice * (config.exitFeePct / 100)) : 0) + currentTradeHoldingFees;
                trades.push({
                    entryTime: position.entryTime, exitTime: c.time,
                    entryPrice: position.entryPrice, exitPrice, type: 'LONG',
                    pnl, pnlPct: ((pnl - fees) / (position.entryPrice * position.qty)) * 100, reason: exitReason
                });
                position = null;
            }
        }

        if (!position && buyFn(env, i)) {
            let ep = price;
            if (config.slippagePct) {
                const sip = price * (config.slippagePct / 100);
                totalSlippageCosts += (sip * (balance / (price + sip)));
                ep += sip;
            }
            const qty = balance / ep;
            position = {
                entryPrice: ep, entryTime: c.time, qty,
                stopPrice: ep * (1 - (config.stopLossPct || 0) / 100),
                tpPrice: ep * (1 + (config.takeProfitPct || 0) / 100)
            };
            currentTradeHoldingFees = 0;
            if (config.entryFeePct) {
                const ef = (qty * ep) * (config.entryFeePct / 100);
                entryFees += ef; balance -= ef;
            }
            balance = 0;
        }
        equityCurve.push({ time: c.time, value: balance + (position ? position.qty * price : 0) });
        inMarketCurve.push(!!position);
    }

    if (position) {
        const last = candles[candles.length - 1];
        let exP = last.close;
        if (config.slippagePct) { const sip = exP * (config.slippagePct / 100); totalSlippageCosts += (sip * position.qty); exP -= sip; }
        const pnl = (exP - position.entryPrice) * position.qty;
        balance += (position.entryPrice * position.qty) + pnl;
        if (config.exitFeePct) { const ef = (position.qty * exP) * (config.exitFeePct / 100); exitFees += ef; balance -= ef; }
        balance -= currentTradeHoldingFees;
        const fees = (config.entryFeePct ? (position.qty * position.entryPrice * (config.entryFeePct / 100)) : 0) +
            (config.exitFeePct ? (position.qty * exP * (config.exitFeePct / 100)) : 0) + currentTradeHoldingFees;
        trades.push({
            entryTime: position.entryTime, exitTime: last.time,
            entryPrice: position.entryPrice, exitPrice: exP, type: 'LONG',
            pnl, pnlPct: ((pnl - fees) / (position.entryPrice * position.qty)) * 100, reason: 'CONDITION'
        });
    }

    return calculateBacktestMetrics(config, equityCurve, bahCurve, trades, initialBalance, balance, entryFees, exitFees, totalHoldingFees, totalSlippageCosts, barsInMarket, wavePnL, warmupPeriod, inMarketCurve, candles);
}

function calculateBacktestMetrics(
    config: BacktestConfig,
    equityCurve: { time: number; value: number }[],
    bahCurve: { time: number; value: number }[],
    trades: TradeResult[],
    initialBalance: number,
    balance: number,
    entryFees: number,
    exitFees: number,
    totalHoldingFees: number,
    totalSlippageCosts: number,
    barsInMarket: number,
    wavePnL: number,
    warmupPeriod: number,
    inMarketCurve: boolean[],
    candles: CandleData[]
): BacktestResult {
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);

    let sharpeRatio = 0, strategyReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
        const prev = equityCurve[i - 1].value;
        if (prev !== 0) strategyReturns.push((equityCurve[i].value - prev) / prev);
    }
    if (strategyReturns.length > 1) {
        const avgR = strategyReturns.reduce((a, b) => a + b, 0) / strategyReturns.length;
        const stdR = Math.sqrt(strategyReturns.map(x => Math.pow(x - avgR, 2)).reduce((a, b) => a + b, 0) / strategyReturns.length);
        sharpeRatio = stdR === 0 ? 0 : (avgR / stdR) * Math.sqrt(strategyReturns.length);
    }

    const bahFinalValue = bahCurve.length > 0 ? bahCurve[bahCurve.length - 1].value : initialBalance;
    const marketReturns: number[] = [];
    for (let i = 1; i < bahCurve.length; i++) {
        const prev = bahCurve[i - 1].value;
        if (prev !== 0) marketReturns.push((bahCurve[i].value - prev) / prev);
    }

    let beta = 0, alpha = 0;
    if (strategyReturns.length > 1 && marketReturns.length === strategyReturns.length) {
        const avgM = marketReturns.reduce((a, b) => a + b, 0) / marketReturns.length;
        const avgS = strategyReturns.reduce((a, b) => a + b, 0) / strategyReturns.length;
        let num = 0, den = 0;
        for (let i = 0; i < strategyReturns.length; i++) {
            num += (strategyReturns[i] - avgS) * (marketReturns[i] - avgM);
            den += Math.pow(marketReturns[i] - avgM, 2);
        }
        beta = den === 0 ? 0 : num / den;
        alpha = ((balance - initialBalance) / initialBalance) - (beta * ((bahFinalValue - initialBalance) / initialBalance));
    }

    const marketExposure = (barsInMarket / Math.max(candles.length - warmupPeriod, 1)) * 100;
    const totalNetPnL = balance - initialBalance;
    const waveContributionPct = totalNetPnL !== 0 ? (wavePnL / totalNetPnL) * 100 : 0;
    const avgWinPct = winningTrades.length ? winningTrades.reduce((s, t) => s + t.pnlPct, 0) / winningTrades.length : 0;
    const avgLossPct = losingTrades.length ? losingTrades.reduce((s, t) => s + Math.abs(t.pnlPct), 0) / losingTrades.length : 0;
    const ev = ((winningTrades.length / Math.max(trades.length, 1)) * avgWinPct) - ((losingTrades.length / Math.max(trades.length, 1)) * avgLossPct);

    const balances = equityCurve.map(pt => pt.value);
    const meanBalance = balances.length > 0 ? balances.reduce((a, b) => a + b, 0) / balances.length : 0;
    const stdDevBalance = balances.length > 0 ? Math.sqrt(balances.map(x => Math.pow(x - meanBalance, 2)).reduce((a, b) => a + b, 0) / balances.length) : 0;

    let totalDDCount = 0, activeRecoveryCount = 0, waitingForSetupCount = 0, rollingPeak = initialBalance, timeUnderDrawdownSec = 0;
    for (let i = 0; i < equityCurve.length; i++) {
        const pt = equityCurve[i];
        if (pt.value > rollingPeak) rollingPeak = pt.value;
        const ddPct = rollingPeak > 0 ? ((rollingPeak - pt.value) / rollingPeak) * 100 : 0;
        if (pt.value < rollingPeak && ddPct >= (config.minDrawdownThresholdPct || 0)) {
            totalDDCount++;
            if (inMarketCurve[i]) activeRecoveryCount++; else waitingForSetupCount++;
            if (i > 0) timeUnderDrawdownSec += (equityCurve[i].time - equityCurve[i - 1].time);
        }
    }

    let maxWinStreak = 0, maxLossStreak = 0, cWin = 0, cLoss = 0;
    for (const t of trades) {
        if (t.pnl > 0) { cWin++; cLoss = 0; if (cWin > maxWinStreak) maxWinStreak = cWin; }
        else { cLoss++; cWin = 0; if (cLoss > maxLossStreak) maxLossStreak = cLoss; }
    }

    let probOfRuin = 0, p5 = initialBalance, p50 = initialBalance, p95 = initialBalance;
    if (trades.length > 5) {
        const iterations = 1000, finalBalances: number[] = [], ruinThreshold = initialBalance * 0.5, tpnls = trades.map(t => t.pnlPct / 100);
        let ruinCount = 0;
        for (let s = 0; s < iterations; s++) {
            let cb = initialBalance, isR = false;
            for (let i = 0; i < trades.length; i++) {
                cb *= (1 + tpnls[Math.floor(Math.random() * tpnls.length)]);
                if (cb < ruinThreshold) isR = true;
            }
            if (isR) ruinCount++; finalBalances.push(cb);
        }
        finalBalances.sort((a, b) => a - b);
        probOfRuin = (ruinCount / iterations) * 100;
        p5 = finalBalances[Math.floor(iterations * 0.05)];
        p50 = finalBalances[Math.floor(iterations * 0.50)];
        p95 = finalBalances[Math.floor(iterations * 0.95)];
    }

    const monthlyReturns: { year: number; month: number; returnPct: number }[] = [];
    if (equityCurve.length > 0) {
        let curM = new Date(equityCurve[0].time * 1000).getMonth(), curY = new Date(equityCurve[0].time * 1000).getFullYear(), startV = equityCurve[0].value, endV = startV;
        for (let i = 1; i < equityCurve.length; i++) {
            const d = new Date(equityCurve[i].time * 1000);
            if (d.getMonth() !== curM || d.getFullYear() !== curY) {
                monthlyReturns.push({ year: curY, month: curM, returnPct: startV !== 0 ? ((endV - startV) / startV) * 100 : 0 });
                curM = d.getMonth(); curY = d.getFullYear(); startV = equityCurve[i].value;
            }
            endV = equityCurve[i].value;
        }
        monthlyReturns.push({ year: curY, month: curM, returnPct: startV !== 0 ? ((endV - startV) / startV) * 100 : 0 });
    }

    let peakDD = equityCurve.length > 0 ? equityCurve[0].value : 0, maxDD = 0, peakBal = initialBalance, maxPDD = 0;
    const ddCurve: { time: number; value: number }[] = [];
    for (const pt of equityCurve) {
        if (pt.value > peakDD) peakDD = pt.value;
        const dd = peakDD > 0 ? ((peakDD - pt.value) / peakDD) * 100 : 0;
        ddCurve.push({ time: pt.time, value: dd });
        if (dd > maxDD) maxDD = dd;
        if (pt.value > peakBal) peakBal = pt.value;
        if (peakBal > initialBalance) {
            const curPDD = peakBal - pt.value;
            if (curPDD > maxPDD) maxPDD = curPDD;
        }
    }

    return {
        trades, totalTrades: trades.length, winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
        initialBalance, finalBalance: balance, netPnL: balance - initialBalance, netReturnPct: ((balance - initialBalance) / initialBalance) * 100,
        bahFinalValue, bahReturnPct: ((bahFinalValue - initialBalance) / initialBalance) * 100,
        sharpeRatio, maxDrawdown: maxDD, maxProfitDrawdown: maxPDD, maxProfitDrawdownPct: peakBal > initialBalance ? (maxPDD / (peakBal - initialBalance)) * 100 : 0,
        equityCurve, bahCurve, totalPnL: trades.reduce((sum, t) => sum + t.pnlPct, 0), monthlyReturns, drawdownCurve: ddCurve,
        totalFees: entryFees + exitFees + totalHoldingFees, entryFees, exitFees, holdingFees: totalHoldingFees,
        alpha: alpha * 100, beta, marketExposure, waveContributionPct, ev,
        timeUnderDrawdownPct: equityCurve.length > 0 ? (totalDDCount / equityCurve.length) * 100 : 0, timeUnderDrawdownDays: timeUnderDrawdownSec / 86400,
        activeRecoveryPct: totalDDCount > 0 ? (activeRecoveryCount / totalDDCount) * 100 : 0, waitingForSetupPct: totalDDCount > 0 ? (waitingForSetupCount / totalDDCount) * 100 : 0,
        maxWinStreak, maxLossStreak, meanBalance, stdDevBalance, consolidationRange: 2 * (stdDevBalance * 2), slippageCosts: totalSlippageCosts,
        monteCarlo: trades.length > 5 ? { probOfRuin, confidenceIntervals: { p5, p50, p95 } } : undefined
    };
}
