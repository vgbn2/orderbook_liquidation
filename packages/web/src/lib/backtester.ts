import { CandleData } from '../stores/marketStore';

export interface BacktestConfig {
    name: string;
    buyCondition: string; // e.g., "close > sma20"
    sellCondition: string; // e.g., "close < sma20"
    stopLossPct?: number; // e.g., 2.0 = 2%
    takeProfitPct?: number; // e.g., 5.0 = 5%
    initialBalance?: number;
    indicators: {
        name: string;
        type: 'SMA' | 'EMA' | 'RSI';
        period: number;
    }[];
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
    equityCurve: { time: number, value: number }[];
    bahCurve: { time: number, value: number }[];
    totalPnL: number;
    monthlyReturns: { year: number; month: number; returnPct: number }[];
    drawdownCurve: { time: number; value: number }[];
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
        res[i] = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses));
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

export function runBacktest(candles: CandleData[], configRaw: string): BacktestResult {
    try {
        const config: BacktestConfig = JSON.parse(configRaw);
        if (!candles.length) throw new Error("No data");

        const initialBalance = config.initialBalance || 10000;
        let balance = initialBalance;

        // 1. Compute indicators
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
                if (ind.type === 'SMA') {
                    env[ind.name] = calculateSMA(env.close, ind.period);
                } else if (ind.type === 'EMA') {
                    env[ind.name] = calculateEMA(env.close, ind.period);
                } else if (ind.type === 'RSI') {
                    env[ind.name] = calculateRSI(env.close, ind.period);
                }
            });
        }

        // 2. Compile condition functions
        const compileCondition = (expr: string) => {
            const vars = Object.keys(env);
            const fnBody = `
                ${vars.map(v => `const ${v} = env.${v}[i];`).join('\n')}
                return ${expr};
            `;
            return new Function('env', 'i', fnBody);
        };

        const buyFn = compileCondition(config.buyCondition);
        const sellFn = compileCondition(config.sellCondition);

        // ── BUY & HOLD BASELINE ─────────────────────────────────────
        const bahEntryPrice = candles[0].close;
        const bahQty = initialBalance / bahEntryPrice;

        const equityCurve: { time: number, value: number }[] = [];
        const bahCurve: { time: number, value: number }[] = [];
        const trades: TradeResult[] = [];
        let position: { entryPrice: number, entryTime: number, qty: number, stopPrice: number, tpPrice: number } | null = null;

        const warmupPeriod = Math.max(...(config.indicators || []).map(i => i.period), 1);

        // 3. Simulation Loop
        for (let i = warmupPeriod; i < candles.length; i++) {
            const c = candles[i];
            const price = c.close;

            // — Buy & Hold equity —
            bahCurve.push({ time: c.time, value: bahQty * price });

            // — Manage open position —
            if (position) {
                const pnlPct = ((price - position.entryPrice) / position.entryPrice) * 100;
                let exitReason: 'TP' | 'SL' | 'CONDITION' | null = null;

                if (config.takeProfitPct && pnlPct >= config.takeProfitPct) exitReason = 'TP';
                else if (config.stopLossPct && pnlPct <= -config.stopLossPct) exitReason = 'SL';
                else if (sellFn(env, i)) exitReason = 'CONDITION';

                if (exitReason) {
                    const exitPrice = exitReason === 'TP' ? position.tpPrice :
                        (exitReason === 'SL' ? position.stopPrice : price);

                    const pnl = (exitPrice - position.entryPrice) * position.qty;
                    balance += (position.entryPrice * position.qty) + pnl;

                    const actualPnlPct = (pnl / (position.entryPrice * position.qty)) * 100;

                    trades.push({
                        entryTime: position.entryTime,
                        exitTime: c.time,
                        entryPrice: position.entryPrice,
                        exitPrice,
                        type: 'LONG',
                        pnl,
                        pnlPct: actualPnlPct,
                        reason: exitReason
                    });
                    position = null;
                }
            }

            // — Check Buy Condition —
            if (!position && buyFn(env, i)) {
                const qty = balance / price;
                position = {
                    entryPrice: price,
                    entryTime: c.time,
                    qty,
                    stopPrice: price * (1 - (config.stopLossPct || 0) / 100),
                    tpPrice: price * (1 + (config.takeProfitPct || 0) / 100)
                };
                balance = 0; // Fully invested
            }

            // — Record strategy equity —
            const currentEquity = balance + (position ? position.qty * price : 0);
            equityCurve.push({ time: c.time, value: currentEquity });
        }

        // Close open position at end
        if (position) {
            const last = candles[candles.length - 1];
            const pnl = (last.close - position.entryPrice) * position.qty;
            balance += (position.entryPrice * position.qty) + pnl;
            const actualPnlPct = (pnl / (position.entryPrice * position.qty)) * 100;
            trades.push({
                entryTime: position.entryTime,
                exitTime: last.time,
                entryPrice: position.entryPrice,
                exitPrice: last.close,
                type: 'LONG',
                pnl,
                pnlPct: actualPnlPct,
                reason: 'CONDITION'
            });
        }

        const winningTrades = trades.filter(t => t.pnl > 0);

        // Sharpe Ratio
        let sharpeRatio = 0;
        const strategyReturns: number[] = [];
        for (let i = 1; i < equityCurve.length; i++) {
            strategyReturns.push((equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value);
        }
        if (strategyReturns.length > 1) {
            const avgR = strategyReturns.reduce((a, b) => a + b, 0) / strategyReturns.length;
            const stdR = Math.sqrt(strategyReturns.map(x => Math.pow(x - avgR, 2)).reduce((a, b) => a + b, 0) / strategyReturns.length);
            sharpeRatio = stdR === 0 ? 0 : (avgR / stdR) * Math.sqrt(strategyReturns.length);
        }

        const bahFinalValue = bahQty * candles[candles.length - 1].close;

        // Calculate Monthly Returns
        const monthlyReturns: { year: number; month: number; returnPct: number }[] = [];
        if (equityCurve.length > 0) {
            let currentMonth = new Date(equityCurve[0].time).getMonth();
            let currentYear = new Date(equityCurve[0].time).getFullYear();
            let startValue = equityCurve[0].value;
            let endValue = startValue;

            for (let i = 1; i < equityCurve.length; i++) {
                const pt = equityCurve[i];
                const d = new Date(pt.time);
                if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) {
                    monthlyReturns.push({
                        year: currentYear,
                        month: currentMonth,
                        returnPct: ((endValue - startValue) / startValue) * 100
                    });
                    currentMonth = d.getMonth();
                    currentYear = d.getFullYear();
                    startValue = endValue;
                }
                endValue = pt.value;
            }
            monthlyReturns.push({
                year: currentYear,
                month: currentMonth,
                returnPct: ((endValue - startValue) / startValue) * 100
            });
        }

        let peak = equityCurve.length > 0 ? equityCurve[0].value : 0;
        let maxDrawdown = 0;
        const drawdownCurve: { time: number; value: number }[] = [];

        for (const pt of equityCurve) {
            if (pt.value > peak) peak = pt.value;
            const dd = peak > 0 ? ((peak - pt.value) / peak) * 100 : 0;
            drawdownCurve.push({ time: pt.time, value: dd });
            if (dd > maxDrawdown) maxDrawdown = dd;
        }

        return {
            trades,
            totalTrades: trades.length,
            winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
            initialBalance,
            finalBalance: balance,
            netPnL: balance - initialBalance,
            netReturnPct: ((balance - initialBalance) / initialBalance) * 100,
            bahFinalValue,
            bahReturnPct: ((bahFinalValue - initialBalance) / initialBalance) * 100,
            sharpeRatio,
            maxDrawdown,
            equityCurve,
            bahCurve,
            totalPnL: trades.reduce((sum, t) => sum + t.pnlPct, 0),
            monthlyReturns,
            drawdownCurve
        };
    } catch (err: any) {
        throw new Error(`Backtest error: ${err.message}`);
    }
}
