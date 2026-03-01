import { useState, useEffect } from 'react';
import { useMarketStore, CandleData } from '../stores/marketStore';
import { runBacktest, BacktestResult } from '../lib/backtester';
import { STRATEGY_PRESETS } from '../lib/strategyBuilder';
import { EquityChart } from './EquityChart';
import { parseCSVToTrades, calculateStatsFromTrades } from '../lib/tradeImporter';
import { Button, PanelSection, StatCard } from './UI';

const DEFAULT_STRATEGY = `{
  "name": "SMA Crossover",
  "buyCondition": "close > SMA20",
  "sellCondition": "close < SMA20",
  "takeProfitPct": 3.0,
  "stopLossPct": 1.5,
  "initialBalance": 10000,
  "indicators": [
    { "name": "SMA20", "type": "SMA", "period": 20 }
  ],
  "entryFeePct": 0.05,
  "exitFeePct": 0.05,
  "holdingFeePct": 0.001,
  "minDrawdownThresholdPct": 0.5,
  "slippagePct": 0.1
}`; interface Props {
    onResult?: (result: BacktestResult | null) => void;
}

export function BacktestPanel({ onResult }: Props = {}) {
    const candles = useMarketStore(s => s.candles);
    const [jsonInput, setJsonInput] = useState(() => {
        const saved = localStorage.getItem('terminus_backtest_config');
        return saved || DEFAULT_STRATEGY;
    });
    const [result, setResult] = useState<BacktestResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [backtestDays, setBacktestDays] = useState<number | 'all' | null>(null);

    // Save configuration to localStorage
    useEffect(() => {
        localStorage.setItem('terminus_backtest_config', jsonInput);
    }, [jsonInput]);

    const timeframe = useMarketStore(s => s.timeframe);
    const symbol = useMarketStore(s => s.symbol);
    const setTimeframe = useMarketStore(s => s.setTimeframe);

    const TIMEFRAMES = [
        { value: "1m", label: "1m" },
        { value: "5m", label: "5m" },
        { value: "15m", label: "15m" },
        { value: "1h", label: "1h" },
        { value: "4h", label: "4h" },
        { value: "1d", label: "1D" },
        { value: "1w", label: "1W" },
        { value: "1M", label: "1M" },
    ];

    const handleRun = async () => {
        try {
            setError(null);
            const config = JSON.parse(jsonInput);

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
            setResult(res);
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
                setResult(stats);
                setError(null);
            } catch (err: any) {
                setError('CSV Error: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    return (
        <PanelSection title="STRATEGY BACKTESTER">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                    {TIMEFRAMES.map((tf) => (
                        <button
                            key={tf.value}
                            className={`btn btn-sm ${timeframe === tf.value ? "active" : ""}`}
                            style={{ border: "1px solid var(--border-medium)", padding: '2px 8px', fontSize: '10px' }}
                            onClick={() => setTimeframe(tf.value)}
                        >
                            {tf.label}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <select
                        className="terminus-input"
                        onChange={e => {
                            const preset = STRATEGY_PRESETS.find(p => p.name === e.target.value);
                            if (preset) setJsonInput(JSON.stringify(preset.config, null, 2));
                        }}
                        style={{ flex: 1, fontSize: '11px', padding: '4px' }}
                        defaultValue=""
                    >
                        <option value="" disabled>Load Strategy Preset...</option>
                        {STRATEGY_PRESETS.map(p => (
                            <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                    </select>

                    <select
                        className="terminus-input"
                        value={backtestDays === null ? "" : backtestDays}
                        onChange={e => setBacktestDays(e.target.value === 'all' ? 'all' : (e.target.value ? Number(e.target.value) : null))}
                        style={{ width: '120px', fontSize: '11px', padding: '4px' }}
                    >
                        <option value="">Current Chart</option>
                        <option value="1">Last 1 Day</option>
                        <option value="3">Last 3 Days</option>
                        <option value="7">Last 7 Days</option>
                        <option value="30">Last 30 Days</option>
                        <option value="90">Last 90 Days</option>
                        <option value="180">Last 180 Days</option>
                        <option value="365">Last 365 Days</option>
                        <option value="all">All Available</option>
                    </select>
                </div>

                <textarea
                    value={jsonInput}
                    onChange={e => setJsonInput(e.target.value)}
                    className="terminus-input"
                    style={{
                        width: '100%', height: '120px', minHeight: '120px',
                        fontFamily: "'JetBrains Mono', monospace",
                        resize: 'vertical', fontSize: '11px'
                    }}
                />

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <Button
                        variant="primary"
                        onClick={handleRun}
                        style={{ flex: 1 }}
                    >
                        RUN BACKTEST
                    </Button>
                    <label style={{ flex: 1, display: 'flex' }}>
                        <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />
                        <div
                            className="terminus-button"
                            style={{ width: '100%', textAlign: 'center', background: 'var(--bg-lighter)', color: 'var(--text-normal)', border: '1px solid var(--border-medium)', cursor: 'pointer', padding: '6px 12px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Import trades from a CSV file"
                        >
                            IMPORT CSV
                        </div>
                    </label>
                </div>

                {error && (
                    <div style={{
                        color: 'var(--negative)',
                        fontSize: '11px',
                        padding: 'var(--space-2)',
                        border: '1px solid var(--negative)',
                        borderRadius: '4px',
                        fontFamily: "'JetBrains Mono', monospace"
                    }}>
                        {error}
                    </div>
                )}

                {result && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {/* Summary Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 'var(--space-2)'
                        }}>
                            <StatCard
                                label="FINAL BALANCE"
                                value={`$${result.finalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                            />
                            <StatCard
                                label="NET RETURN"
                                value={`${result.netReturnPct >= 0 ? '+' : ''}${result.netReturnPct.toFixed(1)}%`}
                                trend={result.netReturnPct >= 0 ? 'up' : 'down'}
                            />
                            <StatCard
                                label="VS BUY & HOLD"
                                value={`${(result.netReturnPct - result.bahReturnPct) >= 0 ? '+' : ''}${(result.netReturnPct - result.bahReturnPct).toFixed(1)}%`}
                                trend={(result.netReturnPct - result.bahReturnPct) >= 0 ? 'up' : 'down'}
                            />
                            <StatCard
                                label="SHARPE RATIO"
                                value={result.sharpeRatio.toFixed(2)}
                            />
                            <StatCard
                                label="TOTAL FEES"
                                value={`-$${result.totalFees.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                trend="down"
                            />
                        </div>

                        {/* Chart Area */}
                        <EquityChart result={result} height={150} />

                        {/* Secondary Stats Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: 'var(--space-2)'
                        }}>
                            <StatCard
                                label="MAX DD"
                                value={`${result.maxDrawdown.toFixed(1)}%`}
                                trend="down"
                            />
                            <StatCard
                                label="TRADES"
                                value={result.totalTrades.toString()}
                            />
                            <StatCard
                                label="WIN RATE"
                                value={`${result.winRate.toFixed(1)}%`}
                            />
                        </div>

                        {/* Trade Log */}
                        {result.trades.length > 0 && (
                            <div style={{
                                background: 'rgba(0,0,0,0.2)',
                                padding: 'var(--space-3)',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)'
                            }}>
                                <div className="terminus-label" style={{ marginBottom: 'var(--space-2)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-1)' }}>
                                    RECENT TRADES
                                </div>
                                {result.trades.slice(-5).map((t, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                                        <span className="terminus-label" style={{ fontSize: '10px' }}>
                                            #{result.trades.length - 4 + i} {t.type}
                                        </span>
                                        <span className={`terminus-value ${t.pnl >= 0 ? 'up-color' : 'down-color'}`} style={{ fontSize: '10px' }}>
                                            {t.pnl >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </PanelSection >
    );
}

