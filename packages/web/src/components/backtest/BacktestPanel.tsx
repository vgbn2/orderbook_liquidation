import { useState } from 'react';
import { useCandleStore } from '../../stores/candleStore';
import { CandleData } from '../../types';
import { runBacktest, BacktestResult } from '../../lib/backtester';
import { parseCSVToTrades, calculateStatsFromTrades } from '../../lib/tradeImporter';
import StrategyBuilder from './builder/StrategyBuilder';

interface Props {
    onResult?: (result: BacktestResult | null) => void;
}

export function BacktestPanel({ onResult }: Props = {}) {
    const candles = useCandleStore(s => s.candles);
    const [error, setError] = useState<string | null>(null);
    const [backtestDays, setBacktestDays] = useState<number | 'all' | null>(null);

    const timeframe = useCandleStore(s => s.timeframe);
    const symbol = useCandleStore(s => s.symbol);
    const setTimeframe = useCandleStore(s => s.setTimeframe);

    const handleRun = async (config: any) => {
        try {
            setError(null);

            let dataToPass: CandleData[] | Record<string, CandleData[]> = candles;

            let fetchLimit = 5000;
            if (backtestDays === 'all') {
                fetchLimit = 100000;
            } else if (backtestDays !== null) {
                const candlesPerDay: Record<string, number> = { '1m': 1440, '5m': 288, '15m': 96, '1h': 24, '4h': 6, '1d': 1, '1w': 1 / 7, '1M': 1 / 30 };
                fetchLimit = Math.ceil((candlesPerDay[timeframe] || 1440) * backtestDays);
            }

            // If portfolio mode (multi-symbol)
            if (config.symbols && config.symbols.length > 0) {
                const multiData: Record<string, CandleData[]> = {};
                for (const sym of config.symbols) {
                    try {
                        const res = await fetch(`/api/ohlcv?symbol=${sym}&interval=${timeframe}&limit=${fetchLimit}`);
                        if (!res.ok) throw new Error(`Failed to fetch ${sym}`);
                        multiData[sym] = await res.json();
                    } catch (e) {
                        console.error(`Error fetching ${sym}:`, e);
                    }
                }
                dataToPass = multiData;
            } else if (backtestDays !== null) {
                // Fetch specific days for current symbol instead of using limited store candles
                try {
                    const res = await fetch(`/api/ohlcv?symbol=${symbol}&interval=${timeframe}&limit=${fetchLimit}`);
                    if (!res.ok) throw new Error(`Failed to fetch ${symbol}`);
                    dataToPass = await res.json();
                } catch (e) {
                    console.error(`Error fetching ${symbol}:`, e);
                }
            }

            const res = runBacktest(dataToPass, config);
            if (onResult) onResult(res);

            // Dispatch event to show trades on chart (only for active symbol trades if many)
            window.dispatchEvent(new CustomEvent('backtest_results', { detail: res }));
        } catch (e: any) {
            setError(e.message || 'Backtest Failed');
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target?.result as string;
                const trades = parseCSVToTrades(text);
                const stats = calculateStatsFromTrades(trades);
                if (onResult) onResult(stats);
                setError(null);
            } catch (err: any) {
                setError('CSV Error: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    return (
        <StrategyBuilder
            onRun={handleRun}
            onImportCSV={handleFileUpload}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            backtestDays={backtestDays}
            setBacktestDays={setBacktestDays}
            error={error}
        />
    );
}
