import { usePerfStore } from "../stores/usePerfStore";
import { useMarketStore } from "../stores/marketStore";

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

const INDICATORS = [
    { id: "volume", label: "Volume" },
    { id: "cvd", label: "CVD" },
    { id: "delta", label: "Delta" },
    { id: "liq_clusters", label: "Clusters" },
    { id: "rsi", label: "RSI" },
];

export function Toolbar({
    activeTool,
    setActiveTool,
    drawingsCount,
    clearDrawings,
    activeIndicators,
    toggleIndicator,
}: Props) {
    const isPerfHudActive = usePerfStore((s) => s.showPerfHud);
    const togglePerfHud = usePerfStore((s) => s.toggleHud);
    const timeframe = useMarketStore((s) => s.timeframe);
    const setTimeframe = useMarketStore((s) => s.setTimeframe);

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
                <button className="btn btn-icon active">📊</button>
                <button className="btn btn-icon">📈</button>
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
            <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, overflowX: "auto" }}>
                <span className="label" style={{ marginRight: 6 }}>INDICATORS</span>
                {INDICATORS.map(ind => (
                    <button
                        key={ind.id}
                        className={`btn btn-sm ${activeIndicators.has(ind.id) ? "active" : ""}`}
                        onClick={() => toggleIndicator(ind.id)}
                    >
                        {ind.label}
                    </button>
                ))}
                <button className="btn btn-sm">
                    <span style={{ color: "var(--accent)" }}>+ More</span>
                </button>
            </div>

            <div className="divider"></div>

            {/* Settings & Extras */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                    className={`btn btn-icon ${isPerfHudActive ? "active" : ""}`}
                    onClick={togglePerfHud}
                    title="Performance Stats"
                >⚡</button>
                <button className="btn btn-icon" title="Chart Settings">⚙</button>
                <button className="btn btn-icon" title="Take Snapshot">📷</button>
            </div>
        </div>
    );
}
