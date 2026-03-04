import { useState, useRef, useEffect } from "react";
import { TABS, BADGE_COLOR, DEFAULT_SHARED, SharedState } from "./constants";
import { GuidedTab } from "./GuidedTab";
import { BlocksTab } from "./BlocksTab";
import { NaturalTab } from "./NaturalTab";
import { VisualBuilderTab } from "./VisualBuilderTab";
import { ExpertTab } from "./ExpertTab";
import { Sidebar } from "./Sidebar";

const TIMEFRAMES = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
  { value: "1M", label: "1M" },
];

interface Props {
  onRun?: (config: any) => void;
  onImportCSV?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  timeframe: string;
  setTimeframe: (tf: string) => void;
  backtestDays: number | 'all' | null;
  setBacktestDays: (v: number | 'all' | null) => void;
  error?: string | null;
}

export default function StrategyBuilder({
  onRun, onImportCSV, timeframe, setTimeframe, backtestDays, setBacktestDays, error
}: Props) {
  const [tab, setTab] = useState("visual");
  const [shared, setShared] = useState<SharedState>(DEFAULT_SHARED);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRunClick = () => {
    if (!onRun) return;

    // Convert shared state to backtester config format
    const config: any = {
      ...shared, // capture extra fields, especially symbols if portfolio mode from expert tab
      name: (shared as any).name || shared.selectedPreset || "Custom Strategy",
      initialBalance: shared.balance,
      buyCondition: shared.buyCondition,
      sellCondition: shared.sellCondition,
      stopLossPct: shared.stopLoss,
      takeProfitPct: shared.takeProfit,
      entryFeePct: shared.entryFee,
      exitFeePct: shared.exitFee,
      slippagePct: shared.slippage,
      indicators: shared.indicators,
    };

    delete config.balance;
    delete config.stopLoss;
    delete config.takeProfit;
    delete config.entryFee;
    delete config.exitFee;
    delete config.slippage;
    delete config.selectedPreset;

    onRun(config);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Calculate new width relative to the container right edge
      const newWidth = rect.right - e.clientX;
      // Constrain sidebar width between 200px and 60% of container
      setSidebarWidth(Math.max(200, Math.min(newWidth, Math.floor(rect.width * 0.6))));
    };

    const handleMouseUp = () => setIsResizing(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  return (
    <div ref={containerRef} style={{ background: "#0a0a0f", minHeight: "100%", fontFamily: "'JetBrains Mono','Courier New',monospace", color: "#e0e0f0", display: "flex", flexDirection: "column", cursor: isResizing ? 'col-resize' : 'default', userSelect: isResizing ? 'none' : 'auto' }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(0,255,200,0.1)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,255,200,0.015)", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#00ffc8", fontSize: 10, letterSpacing: "0.2em", whiteSpace: "nowrap" }}>◈ STRATEGY BUILDER</span>
          <span style={{ fontSize: 8, padding: "2px 7px", background: "rgba(0,255,200,0.1)", border: "1px solid rgba(0,255,200,0.2)", color: "#00ffc8", letterSpacing: "0.15em" }}>BETA</span>

          <div style={{ display: "flex", gap: 4, marginLeft: 16 }}>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                style={{
                  background: timeframe === tf.value ? "rgba(255,255,255,0.1)" : "transparent",
                  color: timeframe === tf.value ? "#ffffff" : "#6b6b80",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 9, padding: "3px 6px", cursor: "pointer", fontFamily: "inherit"
                }}> {tf.label} </button>
            ))}
          </div>

          <select
            style={{ background: "rgba(0,0,0,0.3)", color: "#c0c0d0", border: "1px solid rgba(255,255,255,0.1)", fontSize: 9, padding: "3px 6px", outline: "none", cursor: "pointer", fontFamily: "inherit" }}
            value={backtestDays === null ? "" : backtestDays}
            onChange={e => setBacktestDays(e.target.value === 'all' ? 'all' : (e.target.value ? Number(e.target.value) : null))}
          >
            <option value="">Current Chart</option>
            <option value="1">Last 1 Day</option>
            <option value="3">Last 3 Days</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="180">Last 180 Days</option>
            <option value="365">Last 365 Days</option>
            <option value="all">All Available</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {error && <span style={{ color: "#ff3b5c", fontSize: 10, marginRight: 8, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{error}</span>}

          <label style={{ cursor: "pointer" }}>
            <input type="file" accept=".csv" style={{ display: "none" }} onChange={onImportCSV} />
            <div style={{ background: "transparent", border: "1px dashed rgba(255,255,255,0.2)", color: "#6b6b80", fontSize: 10, padding: "5px 12px", letterSpacing: "0.1em", fontFamily: "inherit" }}>
              IMPORT CSV
            </div>
          </label>
          <button style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#6b6b80", fontSize: 10, padding: "6px 14px", cursor: "pointer", letterSpacing: "0.1em", fontFamily: "inherit" }}>
            SAVE DRAFT
          </button>
          <button onClick={handleRunClick} style={{ background: "#00ffc8", border: "none", color: "#000", fontSize: 10, padding: "6px 18px", cursor: "pointer", letterSpacing: "0.1em", fontWeight: 700, fontFamily: "inherit" }}>
            ▶ RUN BACKTEST
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 24px", overflowX: "auto", flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "transparent", border: "none",
            borderBottom: tab === t.id ? "2px solid #00ffc8" : "2px solid transparent",
            color: tab === t.id ? "#00ffc8" : "#8b8ba0",
            fontSize: 10, padding: "12px 18px", cursor: "pointer",
            letterSpacing: "0.12em", fontFamily: "inherit", transition: "color 0.15s",
            display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
          }}>
            <span>{t.icon} {t.label}</span>
            <span style={{
              fontSize: 8, padding: "1px 5px",
              background: tab === t.id ? `${ BADGE_COLOR[t.badge] } 18` : "rgba(255,255,255,0.03)",
              color: tab === t.id ? BADGE_COLOR[t.badge] : "#a0a0b0",
              border: `1px solid ${ tab === t.id ? BADGE_COLOR[t.badge] + "30" : "rgba(255,255,255,0.04)" } `,
            }}>
              {t.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ padding: 24, overflowY: "auto", flex: 1, minWidth: 0 }}>
          {tab === "wizard" && <GuidedTab shared={shared} setShared={setShared} />}
          {tab === "blocks" && <BlocksTab shared={shared} setShared={setShared} />}
          {tab === "natural" && <NaturalTab shared={shared} setShared={setShared} />}
          {tab === "visual" && <VisualBuilderTab shared={shared} setShared={setShared} />}
          {tab === "expert" && <ExpertTab shared={shared} setShared={setShared} />}
        </div>

        {/* Resizer */}
        <div
          onMouseDown={startResize}
          style={{
            width: 4,
            background: isResizing ? "rgba(0,255,200,0.5)" : "transparent",
            cursor: "col-resize",
            transition: "background 0.2s",
            borderLeft: "1px solid rgba(255,255,255,0.04)",
            borderRight: "1px solid rgba(255,255,255,0.04)"
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,255,200,0.2)")}
          onMouseLeave={e => (e.currentTarget.style.background = isResizing ? "rgba(0,255,200,0.5)" : "transparent")}
        />

        <div style={{ width: sidebarWidth, flexShrink: 0, display: "flex", flexDirection: "column" }}>
          <Sidebar shared={shared} tab={tab} />
        </div>
      </div>

      <style>{`
@keyframes spin { to { transform: rotate(360deg); } }
        * { box- sizing: border - box; }
        :: -webkit - scrollbar { width: 4px; }
        :: -webkit - scrollbar - thumb { background: rgba(255, 255, 255, 0.07); }
`}</style>
    </div>
  );
}

