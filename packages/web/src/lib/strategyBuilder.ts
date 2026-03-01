import { BacktestConfig } from './backtester';

export const STRATEGY_PRESETS: { name: string; description: string; config: BacktestConfig }[] = [
    {
        name: 'SMA Crossover (Classic)',
        description: 'Buys when fast SMA crosses above slow SMA, sells when it crosses below.',
        config: {
            name: 'SMA Crossover',
            initialBalance: 10000,
            buyCondition: 'sma20 > sma50',
            sellCondition: 'sma20 < sma50',
            stopLossPct: 2,
            takeProfitPct: 5,
            indicators: [
                { name: 'sma20', type: 'SMA', period: 20 },
                { name: 'sma50', type: 'SMA', period: 50 },
            ],
            entryFeePct: 0.05,
            exitFeePct: 0.05,
        }
    },
    {
        name: 'ICT — FVG Fill',
        description: 'Buys when a bullish FVG is tapped. Sells when a bearish FVG is tapped.',
        config: {
            name: 'ICT FVG Strategy',
            initialBalance: 10000,
            buyCondition: 'ict_fvg_bull === 1 && close > open',
            sellCondition: 'ict_fvg_bear === 1 && close < open',
            stopLossPct: 1.5,
            takeProfitPct: 4,
            indicators: [
                { name: 'ict', type: 'ICT', period: 10 },
            ],
            entryFeePct: 0.05,
            exitFeePct: 0.05,
        }
    },
    {
        name: 'ICT — Liquidity Sweep',
        description: 'Buys after a sell-side liquidity sweep. Sells after a buy-side liquidity sweep.',
        config: {
            name: 'ICT Sweep Strategy',
            initialBalance: 10000,
            buyCondition: 'ict_sweep_ssl === 1',
            sellCondition: 'ict_sweep_bsl === 1',
            stopLossPct: 1.5,
            takeProfitPct: 4,
            indicators: [
                { name: 'ict', type: 'ICT', period: 20 },
            ],
            entryFeePct: 0.05,
            exitFeePct: 0.05,
        }
    },
    {
        name: 'VRVP — POC Bounce',
        description: 'Buys when price bounces off the Point of Control (POC). Sells when it acts as resistance.',
        config: {
            name: 'VRVP POC Strategy',
            initialBalance: 10000,
            buyCondition: 'low <= vrvp_poc && close > vrvp_poc',
            sellCondition: 'high >= vrvp_poc && close < vrvp_poc',
            stopLossPct: 1.5,
            takeProfitPct: 3,
            indicators: [
                { name: 'vrvp', type: 'VRVP', period: 50 },
            ],
            entryFeePct: 0.05,
            exitFeePct: 0.05,
        }
    }
];
