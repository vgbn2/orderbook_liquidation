import { useState } from 'react';
import { useMarketStore } from '../stores/marketStore';
import { runBacktest, BacktestResult } from '../lib/backtester';
import { EquityChart } from './EquityChart';
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
  "holdingFeePct": 0.001
}`; interface Props {
    onResult?: (result: BacktestResult | null) => void;
}

export function BacktestPanel({ onResult }: Props = {}) {
    const candles = useMarketStore(s => s.candles);
    const [jsonInput, setJsonInput] = useState(DEFAULT_STRATEGY);
    const [result, setResult] = useState<BacktestResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const timeframe = useMarketStore(s => s.timeframe);
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

    const handleRun = () => {
        try {
            setError(null);
            const res = runBacktest(candles, jsonInput);
            setResult(res);
            if (onResult) onResult(res);

            // Dispatch event to show trades on chart
            window.dispatchEvent(new CustomEvent('backtest_results', { detail: res }));
        } catch (err: any) {
            setError(err.message);
        }
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

                <Button
                    variant="primary"
                    onClick={handleRun}
                    style={{ width: '100%' }}
                >
                    RUN BACKTEST
                </Button>

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
        </PanelSection>
    );
}

