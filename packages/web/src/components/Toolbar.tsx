import { useState, useRef } from "react";
import { usePerfStore } from "../stores/usePerfStore";
import { useMarketStore } from "../stores/marketStore";
import { useSettingsStore } from "../stores/settingsStore";
import { SettingsPopover } from "./SettingsPopover";

interface Props {
    activeTool: string;
    setActiveTool: (tool: any) => void;
    drawingsCount: number;
    clearDrawings: () => void;
    activeIndicators: Set<string>;
    toggleIndicator: (key: string) => void;
}

const TIMEFRAMES = [
    { value: "1m", label: "1m" },
    { value: "5m", label: "5m" },
    { value: "15m", label: "15m" },
    { value: "1h", label: "1h" },
    { value: "4h", label: "4h" },
    { value: "1d", label: "1D" },
];

const PRIMARY_INDICATORS = [
    { id: "volume", label: "Volume" },
    { id: "cvd", label: "CVD" },
    { id: "delta", label: "Delta" },
    { id: "rsi", label: "RSI" },
    { id: "macd", label: "MACD" },
];

const MORE_INDICATORS = [
    {
        section: "CHART OVERLAYS",
        items: [
            { id: 'liq_clusters', label: 'Clusters', desc: 'Liquidation heatmap on chart', badge: 'FIXED' },
            { id: 'vwap', label: 'VWAP', desc: 'Volume-weighted average price' },
            { id: 'session_boxes', label: 'Sessions', desc: 'Asia / London / NY boxes' },
            { id: 'resting_liq', label: 'Resting Liq', desc: 'Order book walls visualized', badge: 'FIXED' },
            { id: 'funding_rate', label: 'Funding', desc: 'Rate histogram overlay' },
        ]
    },
    {
        section: "SUB-PANELS",
        items: [
            { id: 'cvd', label: 'CVD', desc: 'Cumulative volume delta' },
            { id: 'open_interest', label: 'OI', desc: 'Open interest divergence' },
            { id: 'rsi', label: 'RSI', desc: 'Relative strength index' },
            { id: 'macd', label: 'MACD', desc: 'Momentum oscillator' },
            { id: 'vol_profile', label: 'Vol Profile', desc: 'Horizontal volume distribution', badge: 'SOON' },
        ]
    },
    {
        section: "SCALE",
        items: [
            { id: 'log_scale', label: 'Log Scale', desc: 'Logarithmic right price axis' },
        ]
    }
];

export function Toolbar({
    activeTool,
    setActiveTool,
    drawingsCount,
    clearDrawings,
    activeIndicators,
    toggleIndicator,
}: Props) {
    const [showMoreIndicators, setShowMoreIndicators] = useState(false);
    const [showSettingsPopover, setShowSettingsPopover] = useState(false);
    const settingsBtnRef = useRef<HTMLButtonElement>(null);

    const isPerfHudActive = usePerfStore((s) => s.showPerfHud);
    const togglePerfHud = usePerfStore((s) => s.toggleHud);
    const timeframe = useMarketStore((s) => s.timeframe);
    const setTimeframe = useMarketStore((s) => s.setTimeframe);

    const showOrderbook = useSettingsStore(s => s.showOrderbook);
    const toggleOrderbook = useSettingsStore(s => s.toggleOrderbook);
    const notificationLevel = useSettingsStore(s => s.notificationLevel);
    const setNotificationLevel = useSettingsStore(s => s.setNotificationLevel);

    const cycleNotifications = () => {
        const next = {
            'all': 'critical_only',
            'critical_only': 'off',
            'off': 'all',
        }[notificationLevel] as 'all' | 'critical_only' | 'off';
        setNotificationLevel(next);
    };

    const NOTIF_ICON = { all: '🔔', critical_only: '🔕', off: '🔇' };
    const NOTIF_TITLE = {
        all: 'Notifications: ALL — click for critical only',
        critical_only: 'Notifications: CRITICAL ONLY — click to mute',
        off: 'Notifications: MUTED — click to enable all',
    };
    const NOTIF_ACTIVE_CLASS = {
        all: 'active',
        critical_only: 'active-warn',
        off: '',
    };

    return (
        <div id="toolbar" style={{
            height: "var(--h-toolbar)",
            borderBottom: "1px solid var(--border-medium)",
            background: "var(--bg-surface)",
            display: "flex", alignItems: "center", padding: "0 10px", gap: 16
        }}>
            {/* Timeframes */}
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {TIMEFRAMES.map((tf) => (
                    <button
                        key={tf.value}
                        className={`btn btn-sm ${timeframe === tf.value ? "active" : ""}`}
                        style={{ border: "none" }}
                        onClick={() => setTimeframe(tf.value)}
                    >
                        {tf.label}
                    </button>
                ))}
                <span className="divider" style={{ margin: "0 8px" }}></span>
                <button
                    className={`btn btn-sm ${timeframe === "1w" ? "active" : ""}`}
                    style={{ border: "none" }}
                    onClick={() => setTimeframe("1w")}
                >1W</button>
                <button
                    className={`btn btn-sm ${timeframe === "1M" ? "active" : ""}`}
                    style={{ border: "none" }}
                    onClick={() => setTimeframe("1M")}
                >1M</button>
            </div>

            <div className="divider"></div>

            {/* Chart Type (Candles vs Line) */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                    className={`btn btn-icon ${!activeIndicators.has('line_chart') ? "active" : ""}`}
                    onClick={() => { if (activeIndicators.has('line_chart')) toggleIndicator('line_chart'); }}
                    title="Candles"
                >📊</button>
                <button
                    className={`btn btn-icon ${activeIndicators.has('line_chart') ? "active" : ""}`}
                    onClick={() => { if (!activeIndicators.has('line_chart')) toggleIndicator('line_chart'); }}
                    title="Line"
                >📈</button>
            </div>

            <div className="divider"></div>

            {/* Scale */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                    className={`btn btn-sm ${activeIndicators.has('log_scale') ? "active" : ""}`}
                    onClick={() => toggleIndicator('log_scale')}
                    title="Toggle Logarithmic Scale"
                >
                    LOG
                </button>
            </div>

            <div className="divider"></div>

            {/* Drawing Tools */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span className="label" style={{ marginRight: 6 }}>DRAW</span>
                <button
                    className={`btn btn-icon ${activeTool === "line" ? "active" : ""}`}
                    onClick={() => setActiveTool(activeTool === "line" ? "none" : "line")}
                    title="Trend Line"
                >╲</button>
                <button
                    className={`btn btn-icon ${activeTool === "ray" ? "active" : ""}`}
                    onClick={() => setActiveTool(activeTool === "ray" ? "none" : "ray")}
                    title="Ray"
                >→</button>
                <button
                    className={`btn btn-icon ${activeTool === "hline" ? "active" : ""}`}
                    onClick={() => setActiveTool(activeTool === "hline" ? "none" : "hline")}
                    title="Horizontal Line"
                >─</button>
                <button
                    className={`btn btn-icon ${activeTool === "box" ? "active" : ""}`}
                    onClick={() => setActiveTool(activeTool === "box" ? "none" : "box")}
                    title="Box/Zone"
                >☐</button>
                <button
                    className={`btn btn-icon ${activeTool === "fib" ? "active" : ""}`}
                    onClick={() => setActiveTool(activeTool === "fib" ? "none" : "fib")}
                    title="Fibonacci Retracement"
                >%</button>
                {drawingsCount > 0 && (
                    <button className="btn btn-icon btn-danger" onClick={clearDrawings} title="Clear Drawings">✕</button>
                )}
            </div>

            <div className="divider"></div>

            {/* Indicators */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, overflowX: "auto", position: "relative" }}>
                <span className="label" style={{ marginRight: 6 }}>INDICATORS</span>
                {PRIMARY_INDICATORS.map(ind => (
                    <button
                        key={ind.id}
                        className={`btn btn-sm ${activeIndicators.has(ind.id) ? "active" : ""}`}
                        onClick={() => toggleIndicator(ind.id)}
                    >
                        {ind.label}
                    </button>
                ))}

                <div style={{ position: "relative" }}>
                    <button
                        className={`btn btn-sm ${showMoreIndicators ? "active" : ""}`}
                        onClick={() => setShowMoreIndicators(!showMoreIndicators)}
                    >
                        <span style={{ color: "var(--accent)" }}>+ More</span>
                    </button>

                    {showMoreIndicators && (
                        <>
                            <div
                                style={{ position: "fixed", inset: 0, zIndex: 90 }}
                                onClick={() => setShowMoreIndicators(false)}
                            />
                            <div
                                className="nav-dropdown"
                                style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    marginTop: 4,
                                    width: 250,
                                    zIndex: 100,
                                    maxHeight: "60vh",
                                    overflowY: "auto"
                                }}
                            >
                                {MORE_INDICATORS.map((section, i) => (
                                    <div key={i} style={{ padding: "8px 0" }}>
                                        <div className="label" style={{ padding: "4px 12px", marginBottom: 4 }}>{section.section}</div>
                                        {section.items.map(item => {
                                            const isSoon = item.badge === 'SOON';
                                            const isActive = !isSoon && activeIndicators.has(item.id);
                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`nav-item dropdown-item ${isSoon ? 'disabled' : ''}`}
                                                    onClick={() => {
                                                        if (!isSoon) {
                                                            toggleIndicator(item.id);
                                                        }
                                                    }}
                                                    style={{ display: "flex", flexDirection: "column", padding: "6px 12px", gap: 2, opacity: isSoon ? 0.5 : 1 }}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", width: "100%", position: "relative" }}>
                                                        <div
                                                            className="checkbox"
                                                            style={{
                                                                width: 14,
                                                                height: 14,
                                                                borderRadius: 3,
                                                                border: "1px solid var(--border-medium)",
                                                                marginRight: 8,
                                                                background: isActive ? "var(--accent)" : "transparent",
                                                                borderColor: isActive ? "var(--accent)" : "var(--border-medium)"
                                                            }}
                                                        />
                                                        <span style={{ color: isActive ? "var(--accent)" : "inherit", fontSize: 13, fontWeight: isActive ? 600 : 400 }}>
                                                            {item.label}
                                                        </span>
                                                        {item.badge && (
                                                            <div style={{
                                                                marginLeft: "auto",
                                                                fontSize: 9,
                                                                background: item.badge === 'SOON' ? "var(--primary-light)" : "rgba(0, 230, 118, 0.2)",
                                                                color: item.badge === 'SOON' ? "var(--primary)" : "#00e87a",
                                                                padding: "2px 6px",
                                                                borderRadius: 10,
                                                                fontWeight: 600
                                                            }}>
                                                                {item.badge}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span style={{ color: "var(--text-muted)", fontSize: 10, marginLeft: 22 }}>{item.desc}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="divider"></div>

            {/* Settings & Extras */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                    className={`btn btn-icon ${isPerfHudActive ? "active" : ""}`}
                    onClick={togglePerfHud}
                    title="Performance Stats"
                >⚡</button>
                <button
                    ref={settingsBtnRef}
                    className={`btn btn-icon ${showSettingsPopover ? "active" : ""}`}
                    onClick={() => setShowSettingsPopover(!showSettingsPopover)}
                    title="Chart Settings"
                >⚙</button>
                <button className="btn btn-icon" title="Take Snapshot">📷</button>

                <SettingsPopover
                    isOpen={showSettingsPopover}
                    onClose={() => setShowSettingsPopover(false)}
                    anchorEl={settingsBtnRef.current}
                />
            </div>

            <div className="divider"></div>

            {/* VIEW Settings */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="label" style={{ marginRight: 6 }}>VIEW</span>

                {/* Orderbook toggle */}
                <button
                    className={`btn btn-icon ${showOrderbook ? 'active' : ''}`}
                    onClick={toggleOrderbook}
                    title={showOrderbook ? 'Hide Orderbook' : 'Show Orderbook'}
                    style={{ fontSize: 11, letterSpacing: '0.04em' }}
                >
                    OB
                </button>

                {/* Notification level cycle button */}
                <button
                    className={`btn btn-icon ${NOTIF_ACTIVE_CLASS[notificationLevel]}`}
                    onClick={cycleNotifications}
                    title={NOTIF_TITLE[notificationLevel]}
                >
                    {NOTIF_ICON[notificationLevel]}
                </button>
            </div>
        </div>
    );
}
