import { ReactNode } from "react";

export const inputStyle = {
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.08)",
  outline: "none",
  color: "#e0e0f0",
  fontSize: 10,
  fontFamily: "'JetBrains Mono','Courier New',monospace",
  padding: "4px 8px",
} as const;

export function SectionLabel({ children, style = {} }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 9, color: "#8b8ba0", letterSpacing: "0.15em", marginBottom: 8, ...style }}>
      {children}
    </div>
  );
}

export function HDivider({ label }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
      {label && <span style={{ fontSize: 9, color: "#8b8ba0", letterSpacing: "0.15em" }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
    </div>
  );
}

export function AddBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: "rgba(255,255,255,0.05)",
      border: "1px dashed rgba(255,255,255,0.2)",
      color: "#c0c0d0",
      fontSize: 9,
      padding: "5px 12px",
      cursor: "pointer",
      fontFamily: "inherit",
      letterSpacing: "0.1em",
      width: "100%",
    }}>
      {children}
    </button>
  );
}

export function NumInput({
  label, unit, value, step = 1, onChange, accent,
}: {
  label: string; unit?: string; value: number; step?: number;
  onChange: (v: number) => void; accent?: string;
}) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.05)", padding: 10 }}>
      <div style={{ fontSize: 9, color: accent || "#8b8ba0", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {unit && <span style={{ fontSize: 9, color: "#8b8ba0" }}>{unit}</span>}
        <input
          type="number" value={value} step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{ ...inputStyle, flex: 1, fontSize: 11 }}
        />
      </div>
    </div>
  );
}

export function RiskBar({
  label, value, max, color, format = "",
}: {
  label: string; value: number; max: number; color: string; format?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 9, color: "#8b8ba0", letterSpacing: "0.1em" }}>{label}</span>
        <span style={{ fontSize: 9, color }}>{format}{value.toFixed(0)}</span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.15)" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}
