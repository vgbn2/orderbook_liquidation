import { useEffect } from 'react';
import { useMarketStore } from '../stores/marketStore';
import { computeHTFBias } from '../lib/htfBias';

export function HTFBiasMonitor() {
    const { htfCandles, htfBias, setHtfBias } = useMarketStore();

    // Recompute bias when candles update
    useEffect(() => {
        for (const [tf, candles] of Object.entries(htfCandles)) {
            const bias = computeHTFBias(candles);
            if (bias) setHtfBias(tf, bias);
        }
    }, [htfCandles, setHtfBias]);

    const tfs = ['4h', '1d'];

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            padding: 12, background: 'var(--bg-surface)',
            borderRadius: 8, border: '1px solid var(--border-medium)',
            fontFamily: 'JetBrains Mono, monospace'
        }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
                HTF CONTEXT ALIGNMENT
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {tfs.map(tf => {
                    const bias = htfBias[tf];
                    if (!bias) return (
                        <div key={tf} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {tf}: Loading...
                        </div>
                    );

                    const isBullish = bias.direction === 'bullish';
                    const color = isBullish ? '#00ff88' : bias.direction === 'bearish' ? '#ff3366' : '#888';

                    return (
                        <div key={tf} style={{
                            padding: 8, borderRadius: 4, background: 'var(--bg-base)',
                            borderLeft: `3px solid ${color}`
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 700 }}>{tf.toUpperCase()}</span>
                                <span style={{
                                    fontSize: 10, padding: '1px 4px', borderRadius: 2,
                                    background: `${color}22`, color: color, fontWeight: 700
                                }}>
                                    {bias.direction.toUpperCase()}
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 9 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>SMA 50/200</span>
                                    <span style={{ color: bias.aboveSma50 && bias.aboveSma200 ? '#00ff88' : '#ff3366' }}>
                                        {bias.aboveSma50 ? '▲' : '▼'} {bias.aboveSma200 ? '▲' : '▼'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>RSI</span>
                                    <span>{bias.rsi14.toFixed(1)}</span>
                                </div>
                                <div style={{ marginTop: 4, height: 4, background: '#333', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                                    <div style={{
                                        position: 'absolute', left: `${bias.rangePosition * 100}%`,
                                        width: 4, height: 4, background: '#fff', transform: 'translateX(-50%)'
                                    }} />
                                    <div style={{ height: '100%', width: '38.2%', background: '#ff336644', position: 'absolute', left: 0 }} />
                                    <div style={{ height: '100%', width: '38.2%', background: '#00ff8844', position: 'absolute', right: 0 }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'var(--text-muted)', marginTop: 2 }}>
                                    <span>DISCOUNT</span>
                                    <span>PREMIUM</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
