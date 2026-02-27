import { useState } from 'react';
import { useMarketStore } from '../stores/marketStore';
import { runBacktest, BacktestResult } from '../lib/backtester';

const DEFAULT_STRATEGY = `{
  "name": "SMA Crossover",
  "buyCondition": "close > SMA20",
  "sellCondition": "close < SMA20",
  "takeProfitPct": 3.0,
  "stopLossPct": 1.5,
  "indicators": [
    { "name": "SMA20", "type": "SMA", "period": 20 }
  ]
}`;

export function BacktestPanel() {
    const candles = useMarketStore(s => s.candles);
    const [jsonInput, setJsonInput] = useState(DEFAULT_STRATEGY);
    const [result, setResult] = useState<BacktestResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleRun = () => {
        try {
            setError(null);
            const res = runBacktest(candles, jsonInput);
            setResult(res);

            // Dispatch event to show trades on chart
            window.dispatchEvent(new CustomEvent('backtest_results', { detail: res }));
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
            <h3 className="panel-title">JSON Strategy Backtester</h3>

            <textarea
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
                style={{
                    width: '100%', height: '200px', fontFamily: 'monospace',
                    background: 'var(--bg-main)', color: 'var(--text-main)',
                    border: '1px solid var(--border-color)', padding: '0.5rem',
                    resize: 'vertical'
                }}
            />

            <button className="tool-btn" onClick={handleRun} style={{ background: 'var(--accent-primary)' }}>
                RUN BACKTEST
            </button>

            {error && <div style={{ color: 'var(--down-color)', fontSize: '0.8rem' }}>{error}</div>}

            {result && (
                <div className="stats-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '0.5rem'
                }}>
                    <div className="stat-card">
                        <span className="stat-label">Total Trades</span>
                        <span className="stat-value">{result.totalTrades}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Win Rate</span>
                        <span className="stat-value">{result.winRate.toFixed(1)}%</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Sharpe Ratio</span>
                        <span className="stat-value">{result.sharpeRatio.toFixed(2)}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Alpha (Annual)</span>
                        <span className="stat-value">{result.alpha.toFixed(4)}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Beta</span>
                        <span className="stat-value">{result.beta.toFixed(3)}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Initial Bal</span>
                        <span className="stat-value">${result.initialBalance.toLocaleString()}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Final Bal</span>
                        <span className="stat-value">${result.finalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Net P&L</span>
                        <span className={`stat-value ${result.netPnL >= 0 ? 'up' : 'down'}`}>
                            {result.netPnL >= 0 ? '+' : ''}${result.netPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Total %</span>
                        <span className={`stat-value ${result.totalPnL >= 0 ? 'up' : 'down'}`}>
                            {result.totalPnL >= 0 ? '+' : ''}{result.totalPnL.toFixed(2)}%
                        </span>
                    </div>
                </div>
            )}

            {result && result.trades.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflowY: 'auto', flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>Trade Log</h4>
                    {result.trades.slice(-5).map((t, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                            <span>{t.type} @ {t.entryPrice.toFixed(0)}</span>
                            <span className={t.pnl >= 0 ? 'up' : 'down'}>
                                {t.pnl >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                            </span>
                        </div>
                    ))}
                    {result.trades.length > 5 && <div>...and {result.trades.length - 5} more</div>}
                </div>
            )}
        </div>
    );
}
