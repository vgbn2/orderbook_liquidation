import { useState, useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { useMarketStore } from '../stores/marketStore';
import { runBacktest, BacktestResult } from '../lib/backtester';

const DEFAULT_STRATEGY = `{
  "name": "SMA Crossover",
  "buyCondition": "close > SMA20",
  "sellCondition": "close < SMA20",
  "takeProfitPct": 3.0,
  "stopLossPct": 1.5,
  "initialBalance": 10000,
  "indicators": [
    { "name": "SMA20", "type": "SMA", "period": 20 }
  ]
}`;

function EquityChart({ result }: { result: BacktestResult }) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const strategySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const bahSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 200,
            layout: {
                background: { color: 'transparent' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
            },
            rightPriceScale: {
                borderVisible: false,
            },
            timeScale: {
                borderVisible: false,
            },
            handleScroll: false,
            handleScale: false,
        });

        const strategySeries = chart.addLineSeries({
            color: '#2962FF',
            lineWidth: 2,
            title: 'Strategy',
        });

        const bahSeries = chart.addLineSeries({
            color: '#F0B90B',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            title: 'Buy & Hold',
        });

        chartRef.current = chart;
        strategySeriesRef.current = strategySeries;
        bahSeriesRef.current = bahSeries;

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []);

    useEffect(() => {
        if (strategySeriesRef.current && bahSeriesRef.current && result) {
            strategySeriesRef.current.setData(result.equityCurve.map(p => ({ ...p, time: p.time as Time })));
            bahSeriesRef.current.setData(result.bahCurve.map(p => ({ ...p, time: p.time as Time })));
            chartRef.current?.timeScale().fitContent();
        }
    }, [result]);

    return (
        <div style={{ position: 'relative', width: '100%', marginTop: '1rem' }}>
            <div ref={chartContainerRef} style={{ width: '100%' }} />
            <div style={{
                position: 'absolute', top: 0, left: 0, display: 'flex', gap: '1rem',
                fontSize: '0.7rem', padding: '0.5rem', pointerEvents: 'none'
            }}>
                <span style={{ color: '#2962FF' }}>● Strategy</span>
                <span style={{ color: '#F0B90B' }}>● Buy & Hold</span>
            </div>
        </div>
    );
}

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
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
            <h3 className="panel-title">Strategy Backtester</h3>

            <textarea
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
                style={{
                    width: '100%', height: '120px', minHeight: '120px', fontFamily: 'monospace',
                    background: 'var(--bg-main)', color: 'var(--text-main)',
                    border: '1px solid var(--border-color)', padding: '0.5rem',
                    resize: 'vertical', fontSize: '0.8rem'
                }}
            />

            <button className="tool-btn" onClick={handleRun} style={{ background: 'var(--accent-primary)', padding: '0.6rem' }}>
                RUN BACKTEST
            </button>

            {error && <div style={{ color: 'var(--down-color)', fontSize: '0.8rem', padding: '0.5rem', border: '1px solid var(--down-color)', borderRadius: '4px' }}>{error}</div>}

            {result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Summary Row */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '0.5rem', background: 'rgba(255,255,255,0.03)',
                        padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Final Bal</div>
                            <div style={{ fontWeight: 'bold' }}>${result.finalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Net Return</div>
                            <div style={{ fontWeight: 'bold', color: result.netReturnPct >= 0 ? 'var(--up-color)' : 'var(--down-color)' }}>
                                {result.netReturnPct >= 0 ? '+' : ''}{result.netReturnPct.toFixed(1)}%
                            </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>vs Buy&Hold</div>
                            <div style={{ fontWeight: 'bold', color: (result.netReturnPct - result.bahReturnPct) >= 0 ? 'var(--up-color)' : 'var(--down-color)' }}>
                                {(result.netReturnPct - result.bahReturnPct) >= 0 ? '+' : ''}{(result.netReturnPct - result.bahReturnPct).toFixed(1)}%
                            </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sharpe</div>
                            <div style={{ fontWeight: 'bold' }}>{result.sharpeRatio.toFixed(2)}</div>
                        </div>
                    </div>

                    {/* Chart Area */}
                    <EquityChart result={result} />

                    {/* Secondary Stats Row */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.5rem', fontSize: '0.8rem'
                    }}>
                        <div className="stat-card" style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Max Drawdown</div>
                            <div style={{ color: 'var(--down-color)' }}>{result.maxDrawdown.toFixed(1)}%</div>
                        </div>
                        <div className="stat-card" style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Trades</div>
                            <div>{result.totalTrades}</div>
                        </div>
                        <div className="stat-card" style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Win Rate</div>
                            <div>{result.winRate.toFixed(1)}%</div>
                        </div>
                    </div>

                    {/* Trade Log */}
                    {result.trades.length > 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.2rem' }}>Recent Trades</h4>
                            {result.trades.slice(-5).map((t, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                    <span>#{result.trades.length - 4 + i} {t.type}</span>
                                    <span className={t.pnl >= 0 ? 'up' : 'down'}>
                                        {t.pnl >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
