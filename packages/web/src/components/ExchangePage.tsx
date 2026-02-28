interface Props {
    exchange: 'binance' | 'bybit' | 'okx' | 'hyperliquid'
}

export function ExchangePage({ exchange }: Props) {

    const EXCHANGE_CONFIG = {
        binance: { color: '#f0b90b', url: 'https://www.binance.com', label: 'Binance Futures' },
        bybit: { color: '#f7a600', url: 'https://www.bybit.com', label: 'Bybit Linear' },
        okx: { color: '#00b4ff', url: 'https://www.okx.com', label: 'OKX Swap' },
        hyperliquid: { color: '#00e87a', url: 'https://app.hyperliquid.xyz', label: 'Hyperliquid Perp' },
    };

    // Fallback if somehow an invalid exchange is passed
    const cfg = EXCHANGE_CONFIG[exchange] || EXCHANGE_CONFIG.binance;

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
                    BTC-USDT PERPETUAL
                </span>
                <a
                    href={cfg.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        marginLeft: 'auto',
                        fontSize: 10,
                        color: cfg.color,
                        textDecoration: 'none',
                        border: `1px solid ${cfg.color}44`,
                        padding: '3px 8px',
                        borderRadius: 3,
                    }}
                >
                    Open Exchange ↗
                </a>
            </div>

            {/* Content grid */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr', overflow: 'hidden' }}>

                {/* Full orderbook (Placeholder for now) */}
                <div style={{ borderRight: '1px solid var(--border-medium)', overflowY: 'auto', padding: 16 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                        [ Orderbook Placeholder for {exchange.toUpperCase()} ]
                    </div>
                </div>

                {/* Depth chart + trade tape + exchange-specific stats */}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                    {/* Depth/market impact chart — full width */}
                    <div style={{ height: 200, borderBottom: '1px solid var(--border-medium)', padding: 16 }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 60 }}>
                            [ Cumulative Depth Chart / Bid-Ask Curves Placeholder ]
                        </div>
                    </div>

                    {/* Bottom: stats + trade tape side by side */}
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>

                        {/* Exchange-specific stats */}
                        <div style={{ padding: 16, borderRight: '1px solid var(--border-medium)', overflowY: 'auto' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                                [ Exchange Stats Placeholder ]<br />
                                <span style={{ fontSize: 10 }}>Funding Rate · Open Interest · L/S Ratio</span>
                            </div>
                        </div>

                        {/* Live trade tape */}
                        <div style={{ overflowY: 'auto', padding: 16 }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                                [ Live Trade Tape Placeholder ]
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
