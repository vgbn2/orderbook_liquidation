import { PRESETS } from "./constants";
import { HDivider, NumInput, SectionLabel, inputStyle } from "./ui";
import { SharedState } from "./constants";

interface Props {
  shared: SharedState;
  setShared: React.Dispatch<React.SetStateAction<SharedState>>;
}

export function GuidedTab({ shared, setShared }: Props) {
  return (
    <div>
      <SectionLabel>START FROM A TEMPLATE</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {PRESETS.map(p => (
          <div
            key={p.label}
            onClick={() => setShared(s => ({ ...s, selectedPreset: p.label, buyCondition: p.buyCondition, sellCondition: p.sellCondition, stopLoss: p.stopLoss, takeProfit: p.takeProfit, indicators: p.indicators }))}
            style={{
              border: shared.selectedPreset === p.label ? "1px solid rgba(0,255,200,0.4)" : "1px solid rgba(255,255,255,0.06)",
              padding: 14, cursor: "pointer", position: "relative",
              background: shared.selectedPreset === p.label ? "rgba(0,255,200,0.03)" : "rgba(255,255,255,0.01)",
              transition: "all 0.15s",
            }}
          >
            {shared.selectedPreset === p.label && (
              <div style={{ position: "absolute", top: 8, right: 8, width: 6, height: 6, background: "#00ffc8", borderRadius: "50%" }} />
            )}
            <div style={{ color: "var(--accent)", fontSize: "var(--text-xl)", marginBottom: 8 }}>{p.icon}</div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 700, marginBottom: 4 }}>{p.label}</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.6 }}>{p.desc}</div>
          </div>
        ))}
      </div>

      <HDivider label="CUSTOMIZE" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {([
          { label: "ENTRY CONDITION", sub: "When to BUY", key: "buyCondition", accent: "#00ffc8" },
          { label: "EXIT CONDITION", sub: "When to SELL", key: "sellCondition", accent: "#ff3b5c" },
        ] as const).map(f => (
          <div key={f.key} style={{ border: `1px solid ${f.accent}33`, padding: 14, background: `${f.accent}05` }}>
            <div style={{ fontSize: "var(--text-xs)", color: f.accent, letterSpacing: "0.15em", marginBottom: 4, fontWeight: 700 }}>{f.label}</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 10 }}>{f.sub}</div>
            <input
              value={(shared as any)[f.key] || ""}
              onChange={e => setShared(s => ({ ...s, [f.key]: e.target.value }))}
              placeholder="e.g. sma20 > sma50"
              style={{ ...inputStyle, width: "100%", border: `1px solid ${f.accent}44`, fontSize: "var(--text-md)" }}
            />
          </div>
        ))}
      </div>

      <HDivider label="RISK MANAGEMENT" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {([
          { label: "STOP LOSS", key: "stopLoss", unit: "%", accent: "#ff3b5c", min: 0.5, max: 15, step: 0.5 },
          { label: "TAKE PROFIT", key: "takeProfit", unit: "%", accent: "#00ffc8", min: 1, max: 30, step: 0.5 },
        ] as const).map(f => (
          <div key={f.key} style={{ border: "1px solid var(--border-medium)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", letterSpacing: "0.12em", fontWeight: 700 }}>{f.label}</span>
              <span style={{ fontSize: "var(--text-md)", color: f.accent, fontWeight: 700 }}>
                {(shared as any)[f.key] || 0}{f.unit}
              </span>
            </div>

            <input
              type="range" min={f.min} max={f.max} step={f.step} value={(shared as any)[f.key] || f.min}
              onChange={e => setShared(s => ({ ...s, [f.key]: parseFloat(e.target.value) }))}
              style={{ width: "100%", accentColor: f.accent, cursor: "pointer" }}
            />

            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 6, opacity: 0.7 }}>ADVANCED (EXPRESSION)</div>
              <input
                placeholder="e.g. low[i-1]"
                value={(shared as any)[f.key === "stopLoss" ? "slExpr" : "tpExpr"] || ""}
                onChange={e => setShared(s => ({ ...s, [f.key === "stopLoss" ? "slExpr" : "tpExpr"]: e.target.value }))}
                style={{ ...inputStyle, width: "100%", fontSize: "var(--text-sm)", border: "1px solid var(--border-medium)" }}
              />
            </div>
          </div>
        ))}
        <NumInput
          label="INITIAL BALANCE" unit="$" value={shared.balance} step={1000}
          onChange={v => setShared(s => ({ ...s, balance: v }))}
        />
      </div>
    </div>
  );
}
