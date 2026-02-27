import { useMarketStore } from '../stores/marketStore';

export function QuantPanel() {
    const quantSnapshot = useMarketStore((s) => s.quantSnapshot);

    if (!quantSnapshot) {
        return (
            <div className="panel quant-panel">
                <div className="panel-header">
                    <span className="panel-title">MACRO-QUANT</span>
                </div>
                <div className="quant-loading">Awaiting first analysis cycle…</div>
            </div>
        );
    }

    const { meta, sigmaGrid, quantiles, macroBreakdown, currentPrice } = quantSnapshot;

    return (
        <div className="panel quant-panel">
            <div className="panel-header">
                <span className="panel-title">MACRO-QUANT</span>
                <span className="quant-price">${currentPrice?.toLocaleString()}</span>
            </div>

            {/* Macro Breakdown */}
            <div className="quant-section">
                <div className="quant-section-title">MACRO IMPACT</div>
                <table className="quant-table">
                    <thead>
                        <tr>
                            <th>Asset</th>
                            <th>Corr</th>
                            <th>Z</th>
                            <th>Impact</th>
                        </tr>
                    </thead>
                    <tbody>
                        {macroBreakdown?.map((m: any) => (
                            <tr key={m.ticker}>
                                <td className="quant-ticker">{m.ticker}</td>
                                <td className={m.correlation > 0 ? 'text-bull' : 'text-bear'}>
                                    {m.correlation > 0 ? '+' : ''}{m.correlation.toFixed(2)}
                                </td>
                                <td className={m.zScore > 0 ? 'text-bull' : 'text-bear'}>
                                    {m.zScore > 0 ? '+' : ''}{m.zScore.toFixed(2)}
                                </td>
                                <td className={m.impact > 0 ? 'text-bull' : 'text-bear'}>
                                    {m.impact > 0 ? '+' : ''}{m.impact.toFixed(3)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="quant-drift-summary">
                    <span>Drift: {meta?.adjustedDrift > 0 ? '+' : ''}{meta?.adjustedDrift?.toFixed(4)}%/d</span>
                    <span>σ/d: {meta?.stepVolatility?.toFixed(3)}%</span>
                </div>
            </div>

            {/* Key Quantiles */}
            <div className="quant-section">
                <div className="quant-section-title">KEY QUANTILES ({meta?.horizon}d)</div>
                <div className="quant-quantiles">
                    {quantiles && Object.entries(quantiles).map(([key, val]: [string, any]) => {
                        const label = key === 'p5' ? '5th' : key === 'p25' ? '25th' : key === 'p50' ? 'Median' : key === 'p75' ? '75th' : '95th';
                        return (
                            <div key={key} className="quant-quantile-row">
                                <span className="quant-q-label">{label}</span>
                                <span className="quant-q-price">${val.price?.toLocaleString()}</span>
                                <span className={`quant-q-pct ${val.pctMove >= 0 ? 'text-bull' : 'text-bear'}`}>
                                    {val.pctMove >= 0 ? '+' : ''}{val.pctMove?.toFixed(2)}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sigma Grid (compact) */}
            <div className="quant-section">
                <div className="quant-section-title">DISTRIBUTION</div>
                <div className="quant-sigma-grid">
                    {sigmaGrid?.map((row: any) => {
                        const barWidth = Math.min(row.probability, 100);
                        const isAbove = row.pctMove >= 0;
                        return (
                            <div key={row.sigma} className="sigma-row">
                                <span className="sigma-level">{row.sigma > 0 ? '+' : ''}{row.sigma}σ</span>
                                <span className="sigma-price">${row.price?.toLocaleString()}</span>
                                <div className="sigma-bar-wrap">
                                    <div
                                        className={`sigma-bar ${isAbove ? 'bull' : 'bear'}`}
                                        style={{ width: `${barWidth}%` }}
                                    />
                                </div>
                                <span className="sigma-prob">{row.probability?.toFixed(0)}%</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
