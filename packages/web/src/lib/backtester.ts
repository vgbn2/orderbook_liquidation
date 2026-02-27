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
    totalPnL: number;
    winRate: number;
    totalTrades: number;
    initialBalance: number;
    finalBalance: number;
    netPnL: number;
    sharpeRatio: number;
    alpha: number;
    beta: number;
}

// Simple SMA calculator
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

export function runBacktest(candles: CandleData[], configRaw: string): BacktestResult {
    try {
        const config: BacktestConfig = JSON.parse(configRaw);
        if (!candles.length) throw new Error("No data");

        // 1. Compute indicators
        const env: Record<string, number[]> = {
            open: candles.map(c => c.open),
            high: candles.map(c => c.high),
            low: candles.map(c => c.low),
            close: candles.map(c => c.close),
            volume: candles.map(c => c.volume)
        };

        if (config.indicators) {
            config.indicators.forEach(ind => {
                if (ind.type === 'SMA') {
                    env[ind.name] = calculateSMA(env.close, ind.period);
                }
                // (Others can be added as needed)
            });
        }

        // 2. Compile condition functions
        // WARNING: new Function is used here for user-driven logic on client side.
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

        const trades: TradeResult[] = [];
        let position: 'LONG' | null = null;
        let entryPrice = 0;
        let entryTime = 0;

        // 3. Simulation Loop
        for (let i = Math.max(...(config.indicators || []).map(i => i.period), 1); i < candles.length; i++) {
            const c = candles[i];

            if (position === 'LONG') {
                const pnlPct = ((c.close - entryPrice) / entryPrice) * 100;
                let exitReason: 'TP' | 'SL' | 'CONDITION' | null = null;

                if (config.takeProfitPct && pnlPct >= config.takeProfitPct) exitReason = 'TP';
                else if (config.stopLossPct && pnlPct <= -config.stopLossPct) exitReason = 'SL';
                else if (sellFn(env, i)) exitReason = 'CONDITION';

                if (exitReason) {
                    trades.push({
                        entryTime,
                        exitTime: c.time,
                        entryPrice,
                        exitPrice: c.close,
                        type: 'LONG',
                        pnl: c.close - entryPrice,
                        pnlPct,
                        reason: exitReason
                    });
                    position = null;
                }
            } else if (!position) {
                if (buyFn(env, i)) {
                    position = 'LONG';
                    entryPrice = c.close;
                    entryTime = c.time;
                }
            }
        }

        // Close open position at end
        if (position === 'LONG') {
            const last = candles[candles.length - 1];
            trades.push({
                entryTime,
                exitTime: last.time,
                entryPrice,
                exitPrice: last.close,
                type: 'LONG',
                pnl: last.close - entryPrice,
                pnlPct: ((last.close - entryPrice) / entryPrice) * 100,
                reason: 'CONDITION'
            });
        }

        const winningTrades = trades.filter(t => t.pnl > 0);
        const initialBalance = config.initialBalance || 10000;

        // Track bar-by-bar returns for Alpha/Beta
        const strategyReturns: number[] = [];
        const marketReturns: number[] = [];

        // Let's just use the trades to reconstruct bar-by-bar equity.
        const equityPerBar = new Array(candles.length).fill(initialBalance);
        const activeTrades = [...trades];
        let tradeIdx = 0;
        let inTrade = false;

        for (let i = 1; i < candles.length; i++) {
            const prevPrice = candles[i - 1].close;
            const currPrice = candles[i].close;
            marketReturns.push((currPrice - prevPrice) / prevPrice);

            // Reconstruct equity
            if (!inTrade && tradeIdx < activeTrades.length && activeTrades[tradeIdx].entryTime === candles[i].time) {
                inTrade = true;
            }

            if (inTrade) {
                const pnlFactor = currPrice / candles[i - 1].close;
                equityPerBar[i] = equityPerBar[i - 1] * pnlFactor;

                if (activeTrades[tradeIdx].exitTime === candles[i].time) {
                    inTrade = false;
                    tradeIdx++;
                }
            } else {
                equityPerBar[i] = equityPerBar[i - 1];
            }
            strategyReturns.push((equityPerBar[i] - equityPerBar[i - 1]) / equityPerBar[i - 1]);
        }

        // Alpha / Beta calculation
        let alpha = 0;
        let beta = 0;
        if (marketReturns.length > 1) {
            const meanMarket = marketReturns.reduce((a, b) => a + b, 0) / marketReturns.length;
            const meanStrategy = strategyReturns.reduce((a, b) => a + b, 0) / strategyReturns.length;

            let num = 0;
            let den = 0;
            for (let i = 0; i < marketReturns.length; i++) {
                num += (strategyReturns[i] - meanStrategy) * (marketReturns[i] - meanMarket);
                den += Math.pow(marketReturns[i] - meanMarket, 2);
            }

            beta = den !== 0 ? num / den : 0;
            alpha = meanStrategy - (beta * meanMarket);
            // Annualize alpha (approx)
            alpha = alpha * 252; // Assuming daily bars for simplicity in naming, or just keep as per-bar
        }

        // Sharpe Ratio remains based on trade returns or bar returns? 
        // User's provided pseudocode used trade returns. Let's keep that or update to bar returns.
        // Usually Sharpe is period-based. Let's update to bar returns for consistency with Alpha/Beta.
        const returns = strategyReturns;
        let sharpeRatio = 0;
        if (returns.length > 1) {
            const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
            const stdDev = Math.sqrt(returns.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length);
            if (stdDev !== 0) {
                sharpeRatio = (avgReturn / stdDev) * Math.sqrt(252 * (returns.length / candles.length));
                // Scaling factor: if we have 1m data, N is much higher. 
                // Let's use the provided sqrt(len) from user pseudocode for simplicity unless scales are weird.
                sharpeRatio = (avgReturn / stdDev) * Math.sqrt(returns.length);
            }
        }

        return {
            trades,
            totalTrades: trades.length,
            winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
            totalPnL: trades.reduce((sum, t) => sum + t.pnlPct, 0),
            initialBalance,
            finalBalance: equityPerBar[candles.length - 1],
            netPnL: equityPerBar[candles.length - 1] - initialBalance,
            sharpeRatio,
            alpha,
            beta
        };
    } catch (err: any) {
        throw new Error(`Backtest error: ${err.message}`);
    }
}
