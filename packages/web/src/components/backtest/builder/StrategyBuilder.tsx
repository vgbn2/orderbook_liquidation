import { useState, useRef } from "react";
import { TABS, BADGE_COLOR, DEFAULT_SHARED, SharedState } from "./constants";
import { GuidedTab } from "./GuidedTab";
import { BlocksTab } from "./BlocksTab";
import { NaturalTab } from "./NaturalTab";
import { VisualBuilderTab } from "./VisualBuilderTab";
import { ExpertTab } from "./ExpertTab";
import { Sidebar } from "./Sidebar";

interface StrategyBuilderProps {
  onRun?: (config: any) => void;
  onImportCSV?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  timeframe?: string;
  setTimeframe?: (tf: string) => void;
  backtestDays?: number | "all" | null;
  setBacktestDays?: (val: number | "all" | null) => void;
  error?: string | null;
}

export default function StrategyBuilder({
  onRun, onImportCSV,
  timeframe, setTimeframe,
  backtestDays, setBacktestDays,
  error
}: StrategyBuilderProps) {
  const [tab, setTab] = useState("wizard");
  const [shared, setShared] = useState<SharedState>(DEFAULT_SHARED);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRunClick = () => {
    if (onRun) {
      // Create a config object that matches what runBacktest expects
      const config = {
        name: shared.selectedPreset || "Custom Strategy",
        initialBalance: shared.balance,
        buyCondition: shared.buyCondition,
        sellCondition: shared.sellCondition,
        stopLossPct: shared.stopLoss,
        stopLossExpr: shared.slExpr,
        takeProfitPct: shared.takeProfit,
        takeProfitExpr: shared.tpExpr,
        entryFeePct: shared.entryFee,
        exitFeePct: shared.exitFee,
        slippagePct: shared.slippage,
        indicators: shared.indicators,
      };
      onRun(config);
    }
  };

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", fontFamily: "'JetBrains Mono','Courier New',monospace", color: "#e0e0f0", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(0,255,200,0.1)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,255,200,0.015)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ color: "var(--accent)", fontSize: "var(--text-sm)", letterSpacing: "0.25em", fontWeight: 700 }}>◈ TERMINUS — STRATEGY BUILDER</span>
          <span style={{ fontSize: "var(--text-xs)", padding: "2px 8px", background: "var(--accent-dim)", border: "1px solid var(--accent-border)", color: "var(--accent)", letterSpacing: "0.15em", fontWeight: 700 }}>BETA</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Quick Settings */}
          <div style={{ display: "flex", gap: 14, alignItems: "center", paddingRight: 16, borderRight: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", opacity: 0.6, fontWeight: 700 }}>TIMEFRAME</span>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe?.(e.target.value)}
                style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: "var(--text-sm)", outline: "none", cursor: "pointer", fontWeight: 600 }}
              >
                {["1m", "5m", "15m", "1h", "4h", "1d"].map(tf => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", opacity: 0.6, fontWeight: 700 }}>DURATION</span>
              <select
                value={backtestDays?.toString() || "null"}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "null") setBacktestDays?.(null);
                  else if (val === "all") setBacktestDays?.("all");
                  else setBacktestDays?.(parseInt(val));
                }}
                style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: "var(--text-sm)", outline: "none", cursor: "pointer", fontWeight: 600 }}
              >
                <option value="null">Chart Data</option>
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
                <option value="90">90 Days</option>
                <option value="all">MAX</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={onImportCSV}
              accept=".csv"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#6b6b80", fontSize: 10, padding: "6px 14px", cursor: "pointer", letterSpacing: "0.1em", fontFamily: "inherit" }}
            >
              IMPORT CSV
            </button>
            <button
              onClick={handleRunClick}
              style={{ background: "#00ffc8", border: "none", color: "#000", fontSize: 10, padding: "6px 18px", cursor: "pointer", letterSpacing: "0.1em", fontWeight: 700, fontFamily: "inherit" }}
            >
              ▶ RUN BACKTEST
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ background: "rgba(255,59,92,0.1)", borderBottom: "1px solid rgba(255,59,92,0.2)", padding: "10px 24px", color: "#ff3b5c", fontSize: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 24px", overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "transparent", border: "none",
            borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
            color: tab === t.id ? "var(--accent)" : "var(--text-muted)",
            fontSize: "var(--text-sm)", padding: "14px 20px", cursor: "pointer",
            letterSpacing: "0.12em", fontFamily: "inherit", transition: "color 0.15s",
            display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
            fontWeight: 700,
          }}>
            <span>{t.icon} {t.label}</span>
            <span style={{
              fontSize: "var(--text-xs)", padding: "2px 6px",
              background: tab === t.id ? `${BADGE_COLOR[t.badge]}18` : "rgba(255,255,255,0.03)",
              color: tab === t.id ? BADGE_COLOR[t.badge] : "var(--text-muted)",
              border: `1px solid ${tab === t.id ? BADGE_COLOR[t.badge] + "40" : "var(--border-subtle)"}`,
              fontWeight: 700,
            }}>
              {t.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", flex: 1, overflow: "hidden" }}>
        <div style={{ padding: 24, overflowY: "auto", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
          {tab === "wizard" && <GuidedTab shared={shared} setShared={setShared} />}
          {tab === "blocks" && <BlocksTab shared={shared} setShared={setShared} />}
          {tab === "natural" && <NaturalTab shared={shared} setShared={setShared} />}
          {tab === "visual" && <VisualBuilderTab shared={shared} setShared={setShared} />}
          {tab === "expert" && <ExpertTab shared={shared} setShared={setShared} />}
        </div>
        <Sidebar shared={shared} tab={tab} />
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); }
        select option { background: #1a1a24; color: #fff; }
      `}</style>
    </div>
  );
}
