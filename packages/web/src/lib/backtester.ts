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
        let currentBalance = initialBalance;
        const returns: number[] = [];

        trades.forEach(t => {
            currentBalance += (currentBalance * (t.pnlPct / 100));
            returns.push(t.pnlPct / 100);
        });

        // Sharpe Ratio calculation
        let sharpeRatio = 0;
        if (returns.length > 1) {
            const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
            const stdDev = Math.sqrt(returns.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length);
            if (stdDev !== 0) {
                sharpeRatio = (avgReturn / stdDev) * Math.sqrt(returns.length);
            }
        }

        return {
            trades,
            totalTrades: trades.length,
            winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
            totalPnL: trades.reduce((sum, t) => sum + t.pnlPct, 0),
            initialBalance,
            finalBalance: currentBalance,
            netPnL: currentBalance - initialBalance,
            sharpeRatio
        };
    } catch (err: any) {
        throw new Error(`Backtest error: ${err.message}`);
    }
}
