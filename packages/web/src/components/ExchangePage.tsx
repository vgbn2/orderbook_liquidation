import { useMarketStore } from '../stores/marketStore';
import { useRef, useEffect } from 'react';

// Also need to get EXCHANGE_CONFIG and Props
interface Props {
    exchange: 'binance' | 'bybit' | 'okx' | 'hyperliquid'
}

const EXCHANGE_CONFIG = {
    binance: { color: '#f0b90b', url: 'https://www.binance.com/referral/earn-together/refer2earn-usdc/claim?hl=en&ref=GRO_28502_0O1TP&utm_source=default', label: 'Binance Futures' },
    bybit: { color: '#f7a600', url: 'https://www.bybitglobal.com/invite?ref=KL4QY3Q', label: 'Bybit Linear' },
    okx: { color: '#00b4ff', url: 'https://www.okx.com', label: 'OKX Swap' },
    hyperliquid: { color: '#00e87a', url: 'https://app.hyperliquid.xyz', label: 'Hyperliquid Perp' },
};

export function ExchangePage({ exchange }: Props) {
    const cfg = EXCHANGE_CONFIG[exchange] || EXCHANGE_CONFIG.binance;

    // ── Read from store ──────────────────────────────────────
    const orderbook = useMarketStore(s => s.orderbook);
    const trades = useMarketStore(s => s.trades);          // last 50 trades
    const fundingRates = useMarketStore(s => s.fundingRates);    // array, most recent last
    const openInterest = useMarketStore(s => s.openInterest);    // array, most recent last
    const vwaf = useMarketStore(s => s.vwaf);
    const lastPrice = useMarketStore(s => s.lastPrice);
    const symbol = useMarketStore(s => s.symbol);

    const latestFunding = fundingRates[fundingRates.length - 1];
    const latestOI = openInterest[openInterest.length - 1];
    const prevOI = openInterest[openInterest.length - 2];
    const oiDelta = latestOI && prevOI
        ? ((latestOI.oi - prevOI.oi) / prevOI.oi) * 100
        : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>
            {/* Exchange header bar */}
            <div style={{
                height: 40,
                borderBottom: '1px solid var(--border-medium)',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: 12,
                flexShrink: 0,
            }}>
                <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: cfg.color,
                    boxShadow: `0 0 8px ${cfg.color}`,
                }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {cfg.label}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {symbol} PERPETUAL
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-medium)' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>PARTNERS:</span>
                        <a href="https://www.gate.com/signup/VLZNUV5BCQ?ref_type=103" target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: '#00e87a', textDecoration: 'none', padding: '2px 4px', background: 'rgba(0,232,122,0.1)', borderRadius: 2 }}>GATE (Bonus)</a>
                        <a href="https://promote.mexc.com/r/MyGmjWjC" target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: '#0084ff', textDecoration: 'none', padding: '2px 4px', background: 'rgba(0,132,255,0.1)', borderRadius: 2 }}>MEXC (0% Fees)</a>
                        <a href="https://www.bitget.com/referral/register?clacCode=5N1L5NYG" target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: '#00afb2', textDecoration: 'none', padding: '2px 4px', background: 'rgba(0,175,178,0.1)', borderRadius: 2 }}>BITGET</a>
                    </div>

                    <div style={{ width: '1px', height: '14px', background: 'var(--border-medium)', margin: '0 4px' }} />

                    <a
                        href={cfg.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            fontSize: 10,
                            color: cfg.color,
                            textDecoration: 'none',
                            border: `1px solid ${cfg.color}44`,
                            background: `${cfg.color}11`,
                            padding: '3px 8px',
                            borderRadius: 3,
                            fontWeight: 600
                        }}
                    >
                        Open {cfg.label.split(' ')[0]} ↗
                    </a>
                </div>
            </div>

            {/* ── CONTENT GRID ── */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr', overflow: 'hidden' }}>

                {/* ── LEFT: Orderbook ── */}
                <div style={{ borderRight: '1px solid var(--border-medium)', overflowY: 'auto' }}>
                    <ExchangeOrderbook orderbook={orderbook as any} />
                </div>

                {/* ── RIGHT ── */}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                    {/* Depth chart — top 200px */}
                    <div style={{ height: 200, borderBottom: '1px solid var(--border-medium)', flexShrink: 0 }}>
                        <DepthCurveChart orderbook={orderbook as any} />
                    </div>

                    {/* Bottom grid: stats left, trade tape right */}
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>

                        <div style={{ borderRight: '1px solid var(--border-medium)', overflowY: 'auto', padding: 16 }}>
                            <ExchangeStats
                                exchange={exchange}
                                accentColor={cfg.color}
                                latestFunding={latestFunding}
                                latestOI={latestOI}
                                oiDelta={oiDelta}
                                vwaf={vwaf}
                                lastPrice={lastPrice}
                                symbol={symbol}
                            />
                        </div>

                        <div style={{ overflowY: 'auto' }}>
                            <TradeTape trades={trades as any} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ExchangeOrderbook({ orderbook }: {
    orderbook: { bids: { price: number, qty: number }[], asks: { price: number, qty: number }[] } | null
}) {
    if (!orderbook) {
        return (
            <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                Waiting for orderbook...
            </div>
        );
    }

    const { bids, asks } = orderbook;

    // Show top 15 levels each side
    const topAsks = asks.slice(0, 15);
    const topBids = bids.slice(0, 15);
    const maxQty = Math.max(...topAsks.map(l => l.qty), ...topBids.map(l => l.qty), 1);
    const spread = asks.length && bids.length ? (asks[0].price - bids[0].price).toFixed(1) : '—';

    const rowStyle = {
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '2px 12px', fontSize: 11, position: 'relative' as const,
        fontFamily: 'var(--font)',
    };

    const barStyle = (qty: number, side: 'bid' | 'ask') => ({
        position: 'absolute' as const,
        top: 0, bottom: 0,
        [side === 'bid' ? 'left' : 'right']: 0,
        width: `${(qty / maxQty) * 60}%`,   // max 60% of row width
        background: side === 'bid' ? 'var(--color-positive)' : 'var(--color-negative)',
        opacity: 0.12,
    });

    return (
        <div style={{ padding: '8px 0' }}>
            <div style={{ padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                ORDERBOOK · {spread} SPR
            </div>

            {/* Asks — reversed so highest ask is at top */}
            {[...topAsks].reverse().map(level => (
                <div key={`ask-${level.price}`} style={rowStyle}>
                    <div style={barStyle(level.qty, 'ask')} />
                    <span style={{ flex: 1, color: 'var(--color-negative)', fontWeight: 500 }}>
                        {level.price.toFixed(1)}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
                        {level.qty.toFixed(3)}
                    </span>
                </div>
            ))}

            {/* Spread row */}
            <div style={{
                padding: '3px 12px', fontSize: 10, color: 'var(--text-muted)',
                borderTop: '1px solid var(--border-medium)', borderBottom: '1px solid var(--border-medium)',
                textAlign: 'center'
            }}>
                SPREAD  {spread}
            </div>

            {/* Bids */}
            {topBids.map(level => (
                <div key={`bid-${level.price}`} style={rowStyle}>
                    <div style={barStyle(level.qty, 'bid')} />
                    <span style={{ flex: 1, color: 'var(--color-positive)', fontWeight: 500 }}>
                        {level.price.toFixed(1)}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
                        {level.qty.toFixed(3)}
                    </span>
                </div>
            ))}
        </div>
    );
}

function DepthCurveChart({ orderbook }: {
    orderbook: { bids: { price: number, qty: number }[], asks: { price: number, qty: number }[] } | null
}) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!orderbook || !svgRef.current) return;

        const svg = svgRef.current;
        const W = svg.clientWidth || 400;
        const H = svg.clientHeight || 180;
        const pad = { l: 8, r: 8, t: 8, b: 20 };
        const chartW = W - pad.l - pad.r;
        const chartH = H - pad.t - pad.b;

        const bids = orderbook.bids.slice(0, 30);
        const asks = orderbook.asks.slice(0, 30);

        // Build cumulative arrays
        const bidCum: { price: number; cum: number }[] = [];
        let runBid = 0;
        for (const b of bids) {
            runBid += b.qty;
            bidCum.push({ price: b.price, cum: runBid });
        }

        const askCum: { price: number; cum: number }[] = [];
        let runAsk = 0;
        for (const a of asks) {
            runAsk += a.qty;
            askCum.push({ price: a.price, cum: runAsk });
        }

        // Price range: union of both sides
        const allPrices = [...bids.map(b => b.price), ...asks.map(a => a.price)];
        const priceMin = Math.min(...allPrices);
        const priceMax = Math.max(...allPrices);
        const maxCum = Math.max(runBid, runAsk, 1);

        const px = (price: number) =>
            pad.l + ((price - priceMin) / (priceMax - priceMin)) * chartW;
        const py = (cum: number) =>
            pad.t + chartH - (cum / maxCum) * chartH;

        // Build SVG path strings
        const bidPath = bidCum.length === 0 ? '' :
            `M ${px(bidCum[0].price)} ${H - pad.b} ` +
            bidCum.map(p => `L ${px(p.price)} ${py(p.cum)}`).join(' ') +
            ` L ${px(bidCum[bidCum.length - 1].price)} ${H - pad.b} Z`;

        const askPath = askCum.length === 0 ? '' :
            `M ${px(askCum[0].price)} ${H - pad.b} ` +
            askCum.map(p => `L ${px(p.price)} ${py(p.cum)}`).join(' ') +
            ` L ${px(askCum[askCum.length - 1].price)} ${H - pad.b} Z`;

        // Mid price vertical line
        const midPrice = bids.length && asks.length
            ? (bids[0].price + asks[0].price) / 2
            : (priceMin + priceMax) / 2;

        svg.innerHTML = `
            <defs>
                <linearGradient id="bidGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="var(--color-positive)" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="var(--color-positive)" stop-opacity="0.05"/>
                </linearGradient>
                <linearGradient id="askGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="var(--color-negative)" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="var(--color-negative)" stop-opacity="0.05"/>
                </linearGradient>
            </defs>
            ${bidPath ? `<path d="${bidPath}" fill="url(#bidGrad)" stroke="var(--color-positive)" stroke-width="1.5"/>` : ''}
            ${askPath ? `<path d="${askPath}" fill="url(#askGrad)" stroke="var(--color-negative)" stroke-width="1.5"/>` : ''}
            <line
                x1="${px(midPrice)}" y1="${pad.t}"
                x2="${px(midPrice)}" y2="${H - pad.b}"
                stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="3,3"
            />
            <text x="${px(midPrice)}" y="${H - 4}" text-anchor="middle"
                fill="var(--text-muted)" font-size="9" font-family="var(--font)">
                MID ${midPrice.toFixed(0)}
            </text>
            <text x="${pad.l + 4}" y="${pad.t + 12}"
                fill="var(--color-positive)" font-size="9" font-family="var(--font)">
                BID DEPTH
            </text>
            <text x="${W - pad.r - 4}" y="${pad.t + 12}" text-anchor="end"
                fill="var(--color-negative)" font-size="9" font-family="var(--font)">
                ASK DEPTH
            </text>
        `;
    }, [orderbook]);   // re-draw when orderbook changes

    return (
        <svg
            ref={svgRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    );
}

function ExchangeStats({ exchange, accentColor, latestFunding, latestOI,
    oiDelta, vwaf, lastPrice, symbol }: any) {

    const fmtRate = (r: number | undefined) =>
        r !== undefined ? `${(r * 100).toFixed(4)}%` : '—';
    const fmtUSD = (v: number | undefined) => {
        if (v === undefined) return '—';
        if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
        if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
        return `$${v.toLocaleString()}`;
    };

    // Find this exchange's row in vwaf.by_exchange
    const exVwafRow = vwaf?.by_exchange?.find(
        (e: any) => e.exchange.toLowerCase() === exchange
    );

    const statRow = (label: string, value: string, color?: string) => (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '5px 0', borderBottom: '1px solid var(--border-faint)', fontSize: 11
        }}>
            <span style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                {label}
            </span>
            <span style={{ color: color ?? 'var(--text-primary)', fontWeight: 500, fontFamily: 'var(--font)' }}>
                {value}
            </span>
        </div>
    );

    return (
        <div>
            <div style={{
                fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em',
                textTransform: 'uppercase', marginBottom: 10, fontWeight: 700
            }}>
                {exchange.toUpperCase()} STATS · {symbol}
            </div>

            {statRow('Last Price', lastPrice ? `$${lastPrice.toLocaleString()}` : '—')}
            {statRow('Funding Rate', fmtRate(latestFunding?.rate),
                latestFunding?.rate !== undefined
                    ? (latestFunding.rate > 0 ? 'var(--color-positive)' : 'var(--color-negative)')
                    : undefined
            )}
            {statRow('Open Interest', fmtUSD(latestOI?.oi))}
            {statRow('OI Change',
                oiDelta !== null ? `${oiDelta >= 0 ? '+' : ''}${oiDelta.toFixed(2)}%` : '—',
                oiDelta !== null
                    ? (oiDelta > 0 ? 'var(--color-positive)' : 'var(--color-negative)')
                    : undefined
            )}

            {/* Exchange-specific VWAF row */}
            {exVwafRow && (<>
                {statRow('Funding (VWAF)', fmtRate(exVwafRow.rate),
                    exVwafRow.rate > 0 ? 'var(--color-negative)' : 'var(--color-positive)'
                    // positive funding = longs pay = slightly bearish signal
                )}
                {statRow('OI Weight', `${(exVwafRow.weight * 100).toFixed(1)}%`)}
            </>)}

            {/* Funding rate trend bar (last 8 rates) */}
            {vwaf && (
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.08em' }}>
                        MARKET SENTIMENT
                    </div>
                    <div style={{
                        padding: '6px 10px',
                        background: 'var(--bg-raised)',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${accentColor}33`,
                        fontSize: 11, fontWeight: 700,
                        color: accentColor,
                        textAlign: 'center',
                    }}>
                        {vwaf.sentiment?.replace('_', ' ').toUpperCase() ?? '—'}
                    </div>
                </div>
            )}
        </div>
    );
}

function TradeTape({ trades }: {
    trades: { side: 'buy' | 'sell', price: number, qty: number, time: number }[]
}) {
    return (
        <div style={{ padding: '8px 0' }}>
            <div style={{
                padding: '4px 12px', fontSize: 10,
                color: 'var(--text-muted)', letterSpacing: '0.08em'
            }}>
                RECENT TRADES
            </div>

            {(!trades || trades.length === 0) && (
                <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
                    Waiting for trades...
                </div>
            )}

            {trades && trades.map((t, i) => {
                const isBuy = t.side === 'buy';
                const time = new Date(t.time).toTimeString().slice(0, 8);
                return (
                    <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '2px 12px', fontSize: 11,
                        borderLeft: `2px solid ${isBuy ? 'var(--color-positive)' : 'var(--color-negative)'}`,
                        marginBottom: 1,
                        background: isBuy ? 'rgba(0,232,122,0.03)' : 'rgba(255,45,78,0.03)',
                    }}>
                        <span style={{
                            color: isBuy ? 'var(--color-positive)' : 'var(--color-negative)',
                            fontWeight: 600, width: 14, fontFamily: 'var(--font)'
                        }}>
                            {isBuy ? '▲' : '▼'}
                        </span>
                        <span style={{ flex: 1, color: 'var(--text-primary)', fontFamily: 'var(--font)' }}>
                            {t.price.toFixed(1)}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
                            {t.qty.toFixed(4)}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 9, width: 56, textAlign: 'right' }}>
                            {time}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
