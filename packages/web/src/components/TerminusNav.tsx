import { useState, useRef, useEffect } from "react";
import { useMarketStore } from "../stores/marketStore";
import { useSettingsStore } from "../stores/settingsStore";
import { SettingsPopover } from "./SettingsPopover";
import { showToast } from "./Toast";


// ─── DATA ─────────────────────────────────────────────────────
let defaultMarkets = [
    { symbol: "BTCUSDT", price: "67,728.5", change: "-0.51%", neg: true, volume: 1000 },
    { symbol: "ETHUSDT", price: "3,482.1", change: "+1.23%", neg: false, volume: 900 },
    { symbol: "SOLUSDT", price: "182.44", change: "+2.87%", neg: false, volume: 800 },
    { symbol: "XAUUSDT", price: "5,190.77", change: "-0.05%", neg: true, volume: 700 },
    { symbol: "BNBUSDT", price: "612.30", change: "+0.44%", neg: false, volume: 600 },
    { symbol: "POWERUSDT", price: "1.8810", change: "+80.87%", neg: false, volume: 500 },
    { symbol: "APTUSDT", price: "0.999", change: "+4.50%", neg: false, volume: 400 },
    { symbol: "XAGUSDT", price: "90.16", change: "+0.86%", neg: false, volume: 300 },
    { symbol: "DOGEUSDT", price: "0.15", change: "-1.2%", neg: true, volume: 200 },
    { symbol: "XRPUSDT", price: "0.58", change: "+0.1%", neg: false, volume: 100 },
];

const NAV_ITEMS = [
    {
        label: "Markets",
        href: "#",
        dropdown: {
            sections: [
                {
                    title: "Asset Classes",
                    items: [
                        { icon: "₿", label: "Crypto", desc: "Perpetuals and Spot", badge: null },
                        { icon: "£", label: "Forex", desc: "Synthetic FX pairs", badge: "Soon" },
                        { icon: "📈", label: "Equities", desc: "Tokenized stocks", badge: "Soon" }
                    ]
                }
            ]
        },
    },
    {
        label: "Trade",
        href: "#",
        dropdown: {
            sections: [
                {
                    title: "Spot & Margin",
                    items: [
                        { icon: "◈", label: "Spot", desc: "Trade crypto freely", badge: null },
                        { icon: "⟠", label: "Margin", desc: "Magnify profit with leverage", badge: null },
                        { icon: "⇌", label: "Convert", desc: "Swap any pair, zero slippage", badge: "0 Fee" },
                        { icon: "⊞", label: "ETF", desc: "Leveraged exposure simplified", badge: null },
                        { icon: "◐", label: "Pre-Market", desc: "Trade tokens before listing", badge: "New" },
                    ],
                },
                {
                    title: "Advanced",
                    items: [
                        { icon: "⬡", label: "Futures", desc: "USDT-settled perpetuals", badge: null },
                        { icon: "⊛", label: "Options", desc: "European-style vanilla options", badge: "Hot" },
                        { icon: "⟳", label: "Bots", desc: "Auto-running smart strategies", badge: null },
                        { icon: "⊕", label: "Copy Trade", desc: "Mirror expert traders", badge: null },
                        { icon: "◎", label: "Paper Trade", desc: "Risk-free simulation mode", badge: "Beta" },
                    ],
                },
            ],
        },
    },
    {
        label: "Indicators",
        href: "#",
        dropdown: {
            sections: [
                {
                    title: "Chart Overlays",
                    items: [
                        { icon: "▦", label: "Clusters", desc: "Liquidation heatmap on chart", badge: "Fixed" },
                        { icon: "~", label: "VWAP", desc: "Volume-weighted average price", badge: null },
                        { icon: "≋", label: "Sessions", desc: "Asia / London / NY boxes", badge: null },
                        { icon: "⊟", label: "Resting Liq", desc: "Order book walls visualized", badge: "Fixed" },
                        { icon: "⬟", label: "Funding", desc: "Rate histogram overlay", badge: null },
                    ],
                },
                {
                    title: "Sub-panels",
                    items: [
                        { icon: "∿", label: "CVD", desc: "Cumulative volume delta", badge: null },
                        { icon: "⊠", label: "OI", desc: "Open interest divergence", badge: null },
                        { icon: "⊡", label: "RSI", desc: "Relative strength index", badge: null },
                        { icon: "≈", label: "MACD", desc: "Momentum oscillator", badge: null },
                        { icon: "▣", label: "Vol Profile", desc: "Horizontal volume distribution", badge: "Soon" },
                    ],
                },
            ],
        },
    },
    {
        label: "Backtest",
        href: "#",
        dropdown: {
            sections: [
                {
                    title: "Modes",
                    items: [
                        { icon: "▶", label: "Backtest", desc: "Run strategy on historical data", badge: null },
                        { icon: "⊞", label: "Paper Trade", desc: "Drag to set start point, trade live", badge: null },
                        { icon: "⟳", label: "Replay", desc: "Market replay at custom speed", badge: null },
                        { icon: "⊕", label: "Optimize", desc: "Parameter sweep & heatmap", badge: "Soon" },
                    ],
                },
                {
                    title: "Analytics",
                    items: [
                        { icon: "◈", label: "Equity Curve", desc: "Strategy vs buy & hold", badge: null },
                        { icon: "⬡", label: "Trade Log", desc: "All entries, exits, P&L", badge: null },
                        { icon: "◐", label: "Drawdown", desc: "Max drawdown chart", badge: null },
                        { icon: "⊛", label: "Heatmap", desc: "Monthly returns grid", badge: null },
                    ],
                },
            ],
        },
    },
    {
        label: "Tools",
        href: "#",
        dropdown: {
            sections: [
                {
                    title: "Utilities",
                    items: [
                        { icon: "⊗", label: "Market Switcher", desc: "All crypto perps, hotkey switch", badge: null },
                        { icon: "⟠", label: "Alert Manager", desc: "Price, liq & pattern alerts", badge: null },
                        { icon: "⬟", label: "Multi-Chart", desc: "Up to 9 charts simultaneously", badge: "Soon" },
                        { icon: "◎", label: "Screener", desc: "Scan all markets by criteria", badge: "Soon" },
                    ],
                },
            ],
        },
    },
];

// ─── HELPERS ──────────────────────────────────────────────────
const C = {
    bg: "var(--bg-main)",
    surface: "var(--bg-panel)",
    border: "var(--border-color)",
    accent: "var(--accent-primary)",
    dim: "var(--text-muted)",
    text: "var(--text-primary)",
    muted: "var(--text-primary)",
    red: "var(--negative)",
    green: "var(--positive)",
    yellow: "var(--warning)",
};

const badge = (text: string) => {
    const colors: Record<string, string> = {
        "Hot": "badge-hot",
        "New": "badge-new",
        "Beta": "badge-warn",
        "Soon": "badge-pin",
        "Fixed": "badge-live",
        "0 Fee": "badge-new",
    };
    const cls = colors[text] || "badge-pin";
    return <span className={`badge ${cls}`}>{text}</span>;
};
// ─── TICKER STRIP ─────────────────────────────────────────────
function TickerStrip({ markets, onSelect, active }: { markets: any[], onSelect: (s: string) => void, active: string }) {
    const stripRef = useRef<HTMLDivElement>(null);

    return (
        <div id="ticker" style={{
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border-medium)",
            display: "flex", alignItems: "center",
            overflow: "hidden", position: "relative", height: "var(--h-ticker)",
        }}>
            {/* Favorites label */}
            <div style={{
                padding: "0 10px", fontSize: "var(--text-xs)", color: "var(--accent)",
                letterSpacing: 1, whiteSpace: "nowrap", fontWeight: "bold",
                borderRight: "1px solid var(--border-medium)",
                height: "100%", display: "flex", alignItems: "center",
                background: "var(--accent-dim)",
            }}>
                WATCHLIST
            </div>

            {/* Scrolling ticker */}
            <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
                <div
                    ref={stripRef}
                    style={{
                        display: "flex", gap: 0,
                        animation: "ticker-scroll 90s linear infinite",
                        width: "max-content", // necessary for scroll animation 
                    }}
                >
                    {[...markets, ...markets].map((m, i) => (
                        <button
                            key={i}
                            onClick={() => onSelect(m.symbol)}
                            style={{
                                padding: "0 14px", height: "var(--h-ticker)", border: "none",
                                background: active === m.symbol ? "rgba(255,255,255,0.05)" : "transparent",
                                borderRight: "1px solid var(--border-medium)",
                                cursor: "pointer", whiteSpace: "nowrap",
                                display: "flex", alignItems: "center", gap: 6,
                            }}
                        >
                            <span style={{ fontSize: "var(--text-xs)", fontWeight: "bold", color: "var(--text-primary)", fontFamily: "var(--font)" }}>
                                {m.symbol}
                            </span>
                            <span className={m.neg ? 'neg' : 'pos'} style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font)" }}>
                                {m.change}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
        </div>
    );
}

// ─── DROPDOWN ─────────────────────────────────────────────────
function Dropdown({ item }: { item: any }) {
    const setView = useSettingsStore(s => s.setView);
    if (!item.dropdown) return null;
    const { sections } = item.dropdown;

    return (
        <div style={{
            position: "absolute", top: "100%", left: 0,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-medium)",
            borderTop: "2px solid var(--accent)",
            borderRadius: "0 0 var(--r-lg) var(--r-lg)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
            display: "flex", gap: 0,
            zIndex: 9999, minWidth: 560,
            overflow: "hidden",
        }}>
            {sections.map((section: any, si: number) => (
                <div key={si} style={{
                    padding: "16px 0",
                    borderRight: si < sections.length - 1 ? "1px solid var(--border-medium)" : "none",
                    minWidth: 240, flex: 1,
                }}>
                    {/* Section title */}
                    <div className="label" style={{ padding: "0 16px 10px" }}>
                        {section.title}
                    </div>

                    {section.items.map((it: any, ii: number) => (
                        <button
                            key={ii}
                            className="dd-item"
                            onClick={() => {
                                if (it.label === 'Alert Manager') {
                                    window.dispatchEvent(new CustomEvent('TERMINUS_SHOW_ALERTS'));
                                } else if (it.label === 'Clusters') {
                                    window.dispatchEvent(new CustomEvent('TERMINUS_TOGGLE_INDICATOR', { detail: { indicator: 'liq_clusters' } }));
                                } else if (it.label === 'Resting Liq') {
                                    window.dispatchEvent(new CustomEvent('TERMINUS_TOGGLE_INDICATOR', { detail: { indicator: 'resting_liq' } }));
                                } else if (['Backtest', 'Paper Trade', 'Replay', 'Optimize', 'Equity Curve', 'Trade Log', 'Drawdown', 'Heatmap'].includes(it.label)) {
                                    setView('backtest');
                                } else if (it.label !== "Settings") {
                                    showToast(`Navigating to ${it.label}...`, 'info', 'system', true);
                                }
                            }}
                            style={{
                                display: "flex", alignItems: "flex-start", gap: 10,
                                padding: "8px 16px", width: "100%",
                                background: "transparent", border: "none",
                                cursor: "pointer", textAlign: "left",
                                transition: "background 0.1s",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                            {/* Icon */}
                            <span style={{
                                width: 28, height: 28, borderRadius: "var(--r-md)", flexShrink: 0,
                                background: "var(--bg-raised)",
                                border: "1px solid var(--border-medium)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 13, color: "var(--text-secondary)",
                            }}>
                                {it.icon}
                            </span>

                            {/* Text */}
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{
                                        fontSize: "var(--text-md)", fontWeight: "bold", color: "var(--text-primary)",
                                    }}>
                                        {it.label}
                                    </span>
                                    {it.badge && badge(it.badge)}
                                </div>
                                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2, lineHeight: 1.4 }}>
                                    {it.desc}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
}

// ─── NAV ITEM ─────────────────────────────────────────────────
function NavItem({ item }: { item: any }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div
            ref={ref}
            style={{ position: "relative" }}
            onMouseEnter={() => item.dropdown && setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            <button
                style={{
                    padding: "0 14px", height: "var(--h-topnav)", border: "none",
                    background: open ? "rgba(255,255,255,0.03)" : "transparent",
                    color: open ? "var(--text-primary)" : "var(--text-secondary)",
                    fontSize: "var(--text-md)", fontWeight: "bold", fontFamily: "var(--font)",
                    letterSpacing: 1, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                    borderBottom: open ? "2px solid var(--accent)" : "2px solid transparent",
                    transition: "all 0.15s",
                }}
                onMouseEnter={e => { if (!open) e.currentTarget.style.color = "var(--text-primary)" }}
                onMouseLeave={e => { if (!open) e.currentTarget.style.color = "var(--text-secondary)" }}
            >
                {item.label}
                {item.dropdown && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                )}
            </button>

            {open && item.dropdown && <Dropdown item={item} />}
        </div>
    );
}

// ─── MARKET SWITCHER MODAL ─────────────────────────────────────
function MarketSwitcher({ markets, onSelect, onClose }: { markets: any[], onSelect: (s: string) => void, onClose: () => void }) {
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState("volume");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    let filtered = markets.filter(m =>
        m.symbol.toLowerCase().includes(query.toLowerCase())
    );

    if (sort === "change") {
        filtered.sort((a, b) => parseFloat(b.change) - parseFloat(a.change));
    } else {
        filtered.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    }

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            paddingTop: 80,
        }} onClick={onClose}>
            <div
                style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderTop: `2px solid ${C.accent}`,
                    borderRadius: 8, width: 480,
                    boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
                    overflow: "hidden",
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Search */}
                <div style={{ padding: 12, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: C.muted, fontSize: 14 }}>⊗</span>
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search markets... (BTC, ETH, SOL)"
                        style={{
                            flex: 1, background: "transparent", border: "none", outline: "none",
                            color: C.text, fontSize: 13, fontFamily: "monospace",
                        }}
                    />
                    <span style={{ fontSize: 10, color: C.muted, border: `1px solid ${C.border}`, padding: "2px 5px", borderRadius: 3 }}>ESC</span>
                </div>

                {/* Sort tabs */}
                <div style={{ display: "flex", padding: "8px 12px", gap: 6, borderBottom: `1px solid ${C.border}` }}>
                    {["volume", "change", "oi"].map(s => (
                        <button key={s} onClick={() => setSort(s)} style={{
                            padding: "3px 10px", fontSize: 10, fontFamily: "monospace",
                            border: `1px solid ${sort === s ? C.accent : C.border}`,
                            background: sort === s ? "rgba(0,255,200,0.1)" : "transparent",
                            color: sort === s ? C.accent : C.muted,
                            borderRadius: 3, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase",
                        }}>{s}</button>
                    ))}
                    <span style={{ marginLeft: "auto", fontSize: 10, color: C.muted, alignSelf: "center" }}>
                        PERP only
                    </span>
                </div>

                {/* Results */}
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                    {filtered.map((m, i) => (
                        <button
                            key={i}
                            onClick={() => { onSelect(m.symbol); onClose(); }}
                            style={{
                                display: "flex", alignItems: "center", padding: "10px 16px",
                                width: "100%", border: "none", borderBottom: `1px solid ${C.border}`,
                                background: "transparent", cursor: "pointer", gap: 12,
                                transition: "background 0.1s",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,255,200,0.04)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                            <div style={{
                                width: 32, height: 32, borderRadius: 6,
                                background: "rgba(0,255,200,0.06)",
                                border: `1px solid ${C.border}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 10, fontWeight: "bold", color: C.accent, fontFamily: "monospace",
                            }}>
                                {m.symbol.replace("USDT", "").slice(0, 3)}
                            </div>
                            <div style={{ flex: 1, textAlign: "left" }}>
                                <div style={{ fontSize: 12, fontWeight: "bold", color: C.text, fontFamily: "monospace" }}>{m.symbol}</div>
                                <div style={{ fontSize: 10, color: C.muted }}>PERP · Binance</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 12, color: C.text, fontFamily: "monospace" }}>${m.price}</div>
                                <div style={{ fontSize: 11, color: m.neg ? C.red : C.green, fontFamily: "monospace" }}>{m.change}</div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Hotkeys hint */}
                <div style={{
                    padding: "8px 16px", display: "flex", gap: 16,
                    borderTop: `1px solid ${C.border}`,
                    fontSize: 10, color: C.muted,
                }}>
                    {[["1", "BTC"], ["2", "ETH"], ["3", "SOL"], ["4", "BNB"]].map(([k, v]) => (
                        <span key={k}>
                            <span style={{ border: `1px solid ${C.border}`, padding: "1px 5px", borderRadius: 3, marginRight: 4 }}>{k}</span>
                            {v}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── MAIN NAV ─────────────────────────────────────────────────
export function TerminusNav() {
    const {
        connected, lastPrice, priceDirection, symbol, send,
        setSymbol, setCandles, setOrderbook, setOptions,
        setLiquidations, setVwaf, setConfluenceZones
    } = useMarketStore();
    const currentView = useSettingsStore(s => s.currentView);
    const setView = useSettingsStore(s => s.setView);
    const exchangeView = useSettingsStore(s => s.exchangeView);
    const setExchangeView = useSettingsStore(s => s.setExchangeView);

    const [showSwitcher, setShowSwitcher] = useState(false);
    const [switching, setSwitching] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [markets, setMarkets] = useState<any[]>(
        defaultMarkets.map(m => ({ ...m, volume: 0, price: '—', change: '—' }))
    );
    const settingsBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        let ws: WebSocket;
        let isMounted = true;

        fetch('https://fapi.binance.com/fapi/v1/ticker/24hr')
            .then(res => res.json())
            .then(data => {
                if (!isMounted) return;
                const perps = data.filter((d: any) => d.symbol.endsWith('USDT'));
                perps.sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

                const top20 = perps.slice(0, 20);
                const initialMarkets = top20.map((p: any) => ({
                    symbol: p.symbol,
                    price: parseFloat(p.lastPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
                    change: `${parseFloat(p.priceChangePercent) > 0 ? '+' : ''}${parseFloat(p.priceChangePercent).toFixed(2)}%`,
                    neg: parseFloat(p.priceChangePercent) < 0,
                    volume: parseFloat(p.quoteVolume)
                }));

                setMarkets(initialMarkets);

                // Open WebSocket for live updates
                ws = new WebSocket('wss://fstream.binance.com/ws/!ticker@arr');
                ws.onmessage = (event) => {
                    if (!isMounted) return;
                    const msg = JSON.parse(event.data);
                    if (!Array.isArray(msg)) return;

                    setMarkets(prev => {
                        let updated = false;
                        const next = prev.map(m => {
                            const update = msg.find((t: any) => t.s === m.symbol);
                            if (update) {
                                updated = true;
                                return {
                                    ...m,
                                    price: parseFloat(update.c).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
                                    change: `${parseFloat(update.P) > 0 ? '+' : ''}${parseFloat(update.P).toFixed(2)}%`,
                                    neg: parseFloat(update.P) < 0,
                                    volume: parseFloat(update.q)
                                };
                            }
                            return m;
                        });
                        return updated ? next : prev;
                    });
                };
            })
            .catch(console.error);

        return () => {
            isMounted = false;
            if (ws) ws.close();
        };
    }, []);

    const activeMarket = symbol;

    const handleSelectMarket = (sym: string) => {
        if (sym === symbol) return;

        // Visual switching state
        setSwitching(true);

        // Optimistic UI update
        setSymbol(sym);

        // Clear stale data to show loading/blank states
        setCandles([]);
        setOrderbook({ bids: [], asks: [], walls: { bid_walls: [], ask_walls: [] } });
        setOptions(null);
        setLiquidations(null);
        setVwaf(null);
        setConfluenceZones([]);

        // Send to server
        send({ action: 'switch_symbol', symbol: sym });
        setShowSwitcher(false);

        // Clear switching state after timeout
        setTimeout(() => setSwitching(false), 2000);
    };
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Don't fire if typing in an input
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

            if (e.key === "Escape") setShowSwitcher(false);
            if (e.key === "/" && !e.ctrlKey) { e.preventDefault(); setShowSwitcher(true); }
            const shortcuts: Record<string, string> = { "1": "BTCUSDT", "2": "ETHUSDT", "3": "SOLUSDT", "4": "BNBUSDT" };
            if (shortcuts[e.key]) handleSelectMarket(shortcuts[e.key]);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [send, symbol, setSymbol, setCandles, setOrderbook, setOptions, setLiquidations, setVwaf, setConfluenceZones]);

    const activeDataFallback = markets.find(m => m.symbol === activeMarket) || markets[0];
    const displayPrice = lastPrice > 0 ? lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : activeDataFallback.price;
    const isNeg = priceDirection === 'bearish';

    return (
        <div style={{ fontFamily: "var(--font)", color: "var(--text-primary)" }}>
            {/* ── TOP NAV BAR ─────────────────────────────────────── */}
            <nav id="topnav" style={{
                background: "var(--bg-surface)",
                borderBottom: "1px solid var(--border-medium)",
                display: "flex", alignItems: "stretch",
                height: "var(--h-topnav)", position: "relative", zIndex: 100,
            }}>
                {/* Logo */}
                <div style={{
                    padding: "0 20px", display: "flex", alignItems: "center", gap: 8,
                    borderRight: "1px solid var(--border-medium)",
                }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: connected ? "var(--accent)" : "var(--negative)",
                        boxShadow: `0 0 8px ${connected ? "var(--accent)" : "var(--negative)"}`,
                    }} />
                    <span style={{ fontSize: "var(--text-lg)", fontWeight: "bold", color: "var(--accent)", letterSpacing: 3 }}>
                        TERMINUS
                    </span>
                    <span className={connected ? "badge badge-live" : "badge badge-hot"}>{connected ? 'LIVE' : 'OFFLINE'}</span>
                </div>

                {/* Breadcrumb / Nav toggle */}
                {currentView !== 'chart' && (
                    <div style={{
                        display: "flex", alignItems: "center", borderRight: "1px solid var(--border-medium)",
                        padding: "0 16px", background: "rgba(255,255,255,0.03)"
                    }}>
                        <button
                            onClick={() => setView('chart')}
                            style={{
                                color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer",
                                fontSize: "var(--text-md)", fontWeight: "bold", display: "flex", alignItems: "center", gap: 8,
                                letterSpacing: 1
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
                            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
                        >
                            <span>←</span> CHART
                        </button>
                        <span style={{ margin: "0 12px", color: "var(--border-strong)" }}>/</span>
                        <span style={{ color: "var(--accent)", fontSize: "var(--text-md)", fontWeight: "bold", letterSpacing: 1, textTransform: "uppercase" }}>
                            {currentView === 'backtest' ? 'BACKTEST' :
                                currentView === 'exchange' ? exchangeView :
                                    currentView}
                        </span>
                    </div>
                )}

                {/* Market display — clickable */}
                <button
                    onClick={() => setShowSwitcher(true)}
                    style={{
                        padding: "0 24px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                        background: "transparent", border: "none", borderRight: "1px solid var(--border-medium)",
                        opacity: switching ? 0.6 : 1, transition: "opacity 0.2s"
                    }}
                >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", display: 'flex', alignItems: 'center', gap: 6 }}>
                            {switching ? (
                                <span style={{ animation: 'spin 0.6s linear infinite', display: 'inline-block' }}>◌</span>
                            ) : null}
                            {symbol.replace('USDT', '')}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>/USDT PERP</span>
                    </div>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: "var(--text-muted)" }}>
                        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>

                {/* Exchange Pills */}
                <div style={{ display: "flex", alignItems: "center", borderRight: "1px solid var(--border-medium)", padding: "0 12px", gap: 4 }}>
                    {[
                        { id: 'binance', label: 'Binance' },
                        { id: 'bybit', label: 'Bybit' },
                        { id: 'okx', label: 'OKX' },
                        { id: 'hyperliquid', label: 'Hyperliquid' }
                    ].map(ex => (
                        <button
                            key={ex.id}
                            onClick={() => {
                                setExchangeView(ex.id as any);
                                setView('exchange');
                            }}
                            style={{
                                background: exchangeView === ex.id && currentView === 'exchange' ? 'rgba(0, 255, 200, 0.1)' : 'transparent',
                                color: exchangeView === ex.id && currentView === 'exchange' ? 'var(--accent)' : 'var(--text-muted)',
                                border: `1px solid ${exchangeView === ex.id && currentView === 'exchange' ? 'var(--accent)' : 'var(--border-medium)'}`,
                                borderRadius: 'var(--r-md)', padding: '2px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font)',
                                transition: "all 0.15s", whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={e => {
                                if (!(exchangeView === ex.id && currentView === 'exchange')) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!(exchangeView === ex.id && currentView === 'exchange')) {
                                    e.currentTarget.style.background = 'transparent';
                                }
                            }}
                        >
                            {ex.label}
                        </button>
                    ))}
                </div>

                {/* Nav items */}
                <div style={{ display: "flex", alignItems: "stretch", borderRight: "1px solid var(--border-medium)" }}>
                    {NAV_ITEMS.map((item, i) => <NavItem key={i} item={item} />)}
                </div>

                {/* Right side controls */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16, paddingRight: 16 }}>

                    {/* Top right icons */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="btn btn-icon" title="Fullscreen">
                            <button
                                className="btn btn-icon"
                                style={{ border: 'none', background: 'transparent' }}
                                onClick={() => showToast('Fullscreen toggled', 'info', 'system', true)}
                            >
                                ◱
                            </button>
                        </div>
                        <button
                            ref={settingsBtnRef}
                            onClick={() => setSettingsOpen(true)}
                            className={`btn btn-icon ${settingsOpen ? 'active' : ''}`}
                            style={{ border: 'none', background: 'transparent' }}
                        >
                            ⚙
                        </button>
                        <div className="btn btn-icon" title="Widgets">
                            <button
                                className="btn btn-icon"
                                style={{ border: 'none', background: 'transparent' }}
                                onClick={() => showToast('Widgets panel toggled', 'info', 'system', true)}
                            >
                                ⊞
                            </button>
                        </div>
                    </div>

                    <div className="divider" />

                    {/* Search shortcut */}
                    <button
                        onClick={() => setShowSwitcher(true)}
                        style={{
                            padding: "4px 10px", border: "1px solid var(--border-medium)",
                            background: "transparent", color: "var(--text-muted)",
                            fontSize: "var(--text-sm)", fontFamily: "var(--font)", borderRadius: "var(--r-md)",
                            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                        }}
                    >
                        ⊗ Search
                        <span style={{
                            border: "1px solid var(--border-medium)", padding: "1px 4px",
                            borderRadius: "var(--r-sm)", fontSize: "var(--text-xs)", color: "var(--text-secondary)",
                        }}>/</span>
                    </button>

                    {/* Price */}
                    <div className={`value-num ${isNeg ? 'neg' : 'pos'}`} style={{ minWidth: '100px', textAlign: 'right' }}>
                        ${displayPrice}
                    </div>
                </div>
            </nav>

            {/* ── TICKER STRIP ────────────────────────────────────── */}
            <TickerStrip markets={markets} onSelect={handleSelectMarket} active={activeMarket} />

            {/* ── MARKET SWITCHER MODAL ───────────────────────────── */}
            {showSwitcher && (
                <MarketSwitcher
                    markets={markets}
                    onSelect={handleSelectMarket}
                    onClose={() => setShowSwitcher(false)}
                />
            )}

            {/* ── SETTINGS POPOVER ─────────────────────────────────────── */}
            <SettingsPopover
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                anchorEl={settingsBtnRef.current}
            />
        </div>
    );
}
