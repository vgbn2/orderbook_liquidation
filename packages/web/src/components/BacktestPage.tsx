import { useState, useMemo } from 'react';
import { BacktestPanel } from './BacktestPanel';
import { BacktestResult } from '../lib/backtester';
import { EquityChart } from './EquityChart';
import { DrawdownChart } from './backtest/DrawdownChart';
import { MonthlyHeatmap } from './backtest/MonthlyHeatmap';
import { StatCard } from './UI';

export function BacktestPage() {
    const [result, setResult] = useState<BacktestResult | null>(null);

    return (
        <div style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            background: 'var(--bg-base)',
        }}>
            {/* LEFT — strategy config (existing BacktestPanel component) */}
            <div style={{
                width: 320,
                borderRight: '1px solid var(--border-medium)',
                flexShrink: 0,
                overflowY: 'auto',
                background: 'var(--bg-surface)'
            }}>
                <BacktestPanel onResult={(r) => setResult(r)} />
            </div>

            {/* RIGHT — results */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                <RightPanel result={result} />
            </div>
        </div>
    );
}

function RightPanel({ result }: { result: BacktestResult | null }) {
    const [tab, setTab] = useState<'overview' | 'trades' | 'monthly' | 'drawdown'>('overview');

    if (!result) {
        return (
            <div style={{
                maxWidth: 1000,
                margin: '0 auto',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 8,
                padding: 48,
                minHeight: 400,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>📈</div>
                <div className="label" style={{ marginBottom: 4, fontSize: 14 }}>RUN A BACKTEST TO SEE RESULTS</div>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                    Configure your strategy parameters on the left and click Run.
                </p>
            </div>
        );
    }

    return (
        <div style={{
            maxWidth: 1200,
            margin: '0 auto',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 600,
            overflow: 'hidden'
        }}>
            {/* Tab Bar */}
            <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-medium)',
                background: 'var(--bg-panel)',
                padding: '0 16px'
            }}>
                <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>OVERVIEW</TabButton>
                <TabButton active={tab === 'trades'} onClick={() => setTab('trades')}>TRADES ({result.totalTrades})</TabButton>
                <TabButton active={tab === 'monthly'} onClick={() => setTab('monthly')}>MONTHLY</TabButton>
                <TabButton active={tab === 'drawdown'} onClick={() => setTab('drawdown')}>DRAWDOWN</TabButton>
            </div>

            <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                {tab === 'overview' && <OverviewTab result={result} />}
                {tab === 'trades' && <TradesTab result={result} />}
                {tab === 'monthly' && <MonthlyTab result={result} />}
                {tab === 'drawdown' && <DrawdownTab result={result} />}
            </div>
        </div>
    );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '16px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: active ? 'bold' : 'normal',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            }}
        >
            {children}
        </button>
    );
}

// ── OVERVIEW TAB ──
function OverviewTab({ result }: { result: BacktestResult }) {
    const winningTrades = result.trades.filter(t => t.pnl > 0);
    const losingTrades = result.trades.filter(t => t.pnl <= 0);
    const avgWin = winningTrades.length ? winningTrades.reduce((s, t) => s + t.pnlPct, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length ? losingTrades.reduce((s, t) => s + t.pnlPct, 0) / losingTrades.length : 0;

    const winPnl = winningTrades.reduce((s, t) => s + t.pnl, 0);
    const lossPnl = losingTrades.reduce((s, t) => s + Math.abs(t.pnl), 0);
    const profitFactor = lossPnl === 0 ? (winPnl > 0 ? Infinity : 0) : Math.abs(winPnl / lossPnl);

    const alpha = result.netReturnPct - result.bahReturnPct;

    const tpCount = result.trades.filter(t => t.reason === 'TP').length;
    const slCount = result.trades.filter(t => t.reason === 'SL').length;
    const condCount = result.trades.filter(t => t.reason === 'CONDITION').length;

    const bestTrade = result.trades.length ? Math.max(...result.trades.map(t => t.pnlPct)) : 0;
    const worstTrade = result.trades.length ? Math.min(...result.trades.map(t => t.pnlPct)) : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <div>
                    <div className="label" style={{ marginBottom: 12 }}>PERFORMANCE</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <StatCard label="NET RETURN" value={`${result.netReturnPct >= 0 ? '+' : ''}${result.netReturnPct.toFixed(2)}%`} trend={result.netReturnPct >= 0 ? 'up' : 'down'} />
                        <StatCard label="NET PNL" value={`$${result.netPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} trend={result.netPnL >= 0 ? 'up' : 'down'} />
                        <StatCard label="B&H RETURN" value={`${result.bahReturnPct >= 0 ? '+' : ''}${result.bahReturnPct.toFixed(2)}%`} />
                        <StatCard label="ALPHA (VS B&H)" value={`${alpha >= 0 ? '+' : ''}${alpha.toFixed(2)}%`} trend={alpha >= 0 ? 'up' : 'down'} />
                    </div>
                </div>

                <div>
                    <div className="label" style={{ marginBottom: 12 }}>RISK</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <StatCard label="SHARPE RATIO" value={result.sharpeRatio.toFixed(2)} />
                        <StatCard label="MAX DRAWDOWN" value={`-${result.maxDrawdown.toFixed(2)}%`} trend="down" />
                        <StatCard label="PROFIT FACTOR" value={profitFactor === Infinity ? 'INF' : profitFactor.toFixed(2)} />
                        <StatCard label="INITIAL BALANCE" value={`$${result.initialBalance.toLocaleString()}`} />
                    </div>
                </div>

                <div>
                    <div className="label" style={{ marginBottom: 12 }}>TRADE STATS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <StatCard label="TOTAL TRADES" value={result.totalTrades} />
                        <StatCard label="WIN RATE" value={`${result.winRate.toFixed(1)}%`} />
                        <StatCard label="WIN / LOSS COUNT" value={`${winningTrades.length} / ${losingTrades.length}`} />
                        <StatCard label="AVG WIN / LOSS" value={`${avgWin > 0 ? '+' : ''}${avgWin.toFixed(2)}% / ${avgLoss.toFixed(2)}%`} />
                    </div>
                </div>

                <div>
                    <div className="label" style={{ marginBottom: 12 }}>EXIT BREAKDOWN</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <StatCard label="TAKE PROFIT (TP)" value={`${result.totalTrades ? ((tpCount / result.totalTrades) * 100).toFixed(0) : 0}%`} />
                        <StatCard label="STOP LOSS (SL)" value={`${result.totalTrades ? ((slCount / result.totalTrades) * 100).toFixed(0) : 0}%`} />
                        <StatCard label="CONDITION" value={`${result.totalTrades ? ((condCount / result.totalTrades) * 100).toFixed(0) : 0}%`} />
                        <StatCard label="BEST / WORST" value={`${bestTrade > 0 ? '+' : ''}${bestTrade.toFixed(2)}% / ${worstTrade.toFixed(2)}%`} />
                    </div>
                </div>
            </div>

            <div>
                <div className="label" style={{ marginBottom: 12 }}>EQUITY CURVE</div>
                <div style={{ border: '1px solid var(--border-medium)', borderRadius: 8, overflow: 'hidden', padding: 16 }}>
                    <EquityChart result={result} height={300} />
                </div>
            </div>
        </div>
    );
}

// ── TRADES TAB ──
type SortCol = 'entryTime' | 'exitTime' | 'entryPrice' | 'exitPrice' | 'pnl' | 'pnlPct' | 'reason';
type SortDir = 'asc' | 'desc';
type FilterType = 'ALL' | 'WIN' | 'LOSS';

function TradesTab({ result }: { result: BacktestResult }) {
    const [sortCol, setSortCol] = useState<SortCol>('entryTime');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [filter, setFilter] = useState<FilterType>('ALL');

    const winningTrades = result.trades.filter(t => t.pnl > 0);
    const losingTrades = result.trades.filter(t => t.pnl <= 0);

    const filteredTrades = useMemo(() => {
        let sorted = [...result.trades];
        if (filter === 'WIN') sorted = sorted.filter(t => t.pnl > 0);
        if (filter === 'LOSS') sorted = sorted.filter(t => t.pnl <= 0);

        sorted.sort((a, b) => {
            let valA: number | string = a[sortCol];
            let valB: number | string = b[sortCol];
            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [result.trades, filter, sortCol, sortDir]);

    const handleSort = (col: SortCol) => {
        if (sortCol === col) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortCol(col);
            setSortDir('desc');
        }
    };

    const Th = ({ children, col }: { children: React.ReactNode, col: SortCol }) => (
        <th
            style={{ textAlign: 'left', padding: '12px 16px', cursor: 'pointer', userSelect: 'none', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 'bold' }}
            onClick={() => handleSort(col)}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {children}
                {sortCol === col && <span style={{ color: 'var(--accent)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
            </div>
        </th>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
            <div style={{ display: 'flex', gap: 8 }}>
                <button className={`btn btn-sm ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>ALL</button>
                <button className={`btn btn-sm ${filter === 'WIN' ? 'active' : ''}`} onClick={() => setFilter('WIN')}>WIN ({winningTrades.length})</button>
                <button className={`btn btn-sm ${filter === 'LOSS' ? 'active' : ''}`} onClick={() => setFilter('LOSS')}>LOSS ({losingTrades.length})</button>
            </div>

            <div style={{ border: '1px solid var(--border-medium)', borderRadius: 8, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace" }}>
                    <thead style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-medium)' }}>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 'bold' }}>#</th>
                            <Th col="entryTime">ENTRY DATE</Th>
                            <Th col="exitTime">EXIT DATE</Th>
                            <Th col="entryPrice">ENTRY $</Th>
                            <Th col="exitPrice">EXIT $</Th>
                            <Th col="pnl">PNL $</Th>
                            <Th col="pnlPct">PNL %</Th>
                            <Th col="reason">REASON</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTrades.map((t) => {
                            const isWin = t.pnl > 0;
                            const color = isWin ? 'var(--positive)' : 'var(--negative)';
                            const originalIndex = result.trades.indexOf(t) + 1;

                            let reasonColor = 'var(--text-muted)';
                            let reasonBg = 'rgba(255,255,255,0.05)';
                            if (t.reason === 'TP') { reasonColor = '#00e87a'; reasonBg = 'rgba(0, 230, 118, 0.1)'; }
                            if (t.reason === 'SL') { reasonColor = '#ff3b5c'; reasonBg = 'rgba(255, 59, 92, 0.1)'; }
                            if (t.reason === 'CONDITION') { reasonColor = '#b388ff'; reasonBg = 'rgba(179, 136, 255, 0.1)'; }

                            return (
                                <tr key={originalIndex} style={{ borderBottom: '1px solid var(--border-medium)' }}>
                                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{originalIndex}</td>
                                    <td style={{ padding: '12px 16px' }}>{new Date(t.entryTime * 1000).toLocaleString()}</td>
                                    <td style={{ padding: '12px 16px' }}>{new Date(t.exitTime * 1000).toLocaleString()}</td>
                                    <td style={{ padding: '12px 16px' }}>{t.entryPrice.toFixed(2)}</td>
                                    <td style={{ padding: '12px 16px' }}>{t.exitPrice.toFixed(2)}</td>
                                    <td style={{ padding: '12px 16px', color }}>{t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}</td>
                                    <td style={{ padding: '12px 16px', color }}>{t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '4px 8px',
                                            borderRadius: 12,
                                            background: reasonBg,
                                            color: reasonColor,
                                            fontSize: '10px',
                                            fontWeight: 'bold'
                                        }}>
                                            {t.reason}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredTrades.length === 0 && (
                            <tr>
                                <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No trades found matching filter.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── MONTHLY TAB ──
function MonthlyTab({ result }: { result: BacktestResult }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="label">MONTHLY RETURNS</div>
            <div style={{ border: '1px solid var(--border-medium)', borderRadius: 8, padding: 24, overflow: 'auto' }}>
                <MonthlyHeatmap data={result.monthlyReturns} />
            </div>
        </div>
    );
}

// ── DRAWDOWN TAB ──
function DrawdownTab({ result }: { result: BacktestResult }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="label">DRAWDOWN CURVE</div>
                <div style={{ color: 'var(--negative)', fontWeight: 'bold', fontSize: '14px' }}>
                    Max Drawdown: -{result.maxDrawdown.toFixed(2)}%
                </div>
            </div>
            <div style={{ border: '1px solid var(--border-medium)', borderRadius: 8, padding: 16, flex: 1, minHeight: 400 }}>
                <DrawdownChart data={result.drawdownCurve} />
            </div>
        </div>
    );
}
