import { useState } from "react";
import { NL_EXAMPLES, SharedState } from "./constants";
import { SectionLabel } from "./ui";

interface ParseResult {
  buyCondition: string;
  sellCondition: string;
  indicators: string[];
  confidence: number;
}

interface Props {
  shared: SharedState;
  setShared: React.Dispatch<React.SetStateAction<SharedState>>;
}

export function NaturalTab({ setShared }: Props) {
  const [nlInput, setNlInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);

  const parse = () => {
    setProcessing(true);
    // TODO: replace timeout with real AI API call
    setTimeout(() => {
      setProcessing(false);
      setResult({ buyCondition: "sma20 > sma50", sellCondition: "sma20 < sma50", indicators: ["SMA(20)", "SMA(50)"], confidence: 94 });
    }, 1800);
  };

  const applyResult = () => {
    if (!result) return;
    setShared(s => ({
      ...s,
      buyCondition: result.buyCondition,
      sellCondition: result.sellCondition,
      indicators: [{ name: "sma20", type: "SMA", period: 20 }, { name: "sma50", type: "SMA", period: 50 }],
    }));
  };

  return (
    <div>
      <div style={{ fontSize: 10, color: "#3a3a50", letterSpacing: "0.15em", marginBottom: 4 }}>
        DESCRIBE YOUR STRATEGY IN PLAIN ENGLISH
      </div>
      <div style={{ fontSize: 9, color: "#2a2a3a", marginBottom: 16, lineHeight: 1.7 }}>
        Write how you'd explain your trade to a friend. AI converts it to executable logic.
      </div>

      <SectionLabel>EXAMPLES — click to use</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {NL_EXAMPLES.map((ex, i) => (
          <div key={i} onClick={() => setNlInput(ex)}
            style={{ padding: "8px 12px", border: "1px solid rgba(255,255,255,0.05)", fontSize: 10, color: "#4a4a60", cursor: "pointer", transition: "all 0.1s" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(0,255,200,0.2)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)")}>
            "{ex}"
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid rgba(0,255,200,0.2)", background: "rgba(0,0,0,0.3)", padding: 14, marginBottom: 12 }}>
        <textarea
          value={nlInput} onChange={e => setNlInput(e.target.value)}
          placeholder="e.g. Buy when the 20-period moving average crosses above the 50-period average. Sell when it crosses back below. Use a 2% stop loss."
          style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#c0c0d0", fontSize: 11, fontFamily: "inherit", resize: "none", lineHeight: 1.7, minHeight: 72 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontSize: 9, color: "#2a2a3a" }}>{nlInput.length} chars</span>
          <button onClick={parse} disabled={!nlInput.trim()} style={{
            background: nlInput.trim() ? "#00ffc8" : "rgba(255,255,255,0.05)",
            border: "none", color: nlInput.trim() ? "#000" : "#2a2a3a",
            fontSize: 10, padding: "6px 16px", cursor: nlInput.trim() ? "pointer" : "default",
            fontFamily: "inherit", letterSpacing: "0.1em", fontWeight: 700,
          }}>
            {processing ? "PARSING..." : "✦ PARSE STRATEGY"}
          </button>
        </div>
      </div>

      {processing && (
        <div style={{ border: "1px solid rgba(0,255,200,0.1)", padding: 14, display: "flex", alignItems: "center", gap: 12, fontSize: 10, color: "#3a3a50" }}>
          <div style={{ width: 12, height: 12, border: "1px solid #00ffc8", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
          Interpreting strategy logic...
        </div>
      )}

      {result && !processing && (
        <div style={{ border: "1px solid rgba(0,255,200,0.25)", background: "rgba(0,255,200,0.03)", padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: "#00ffc8", letterSpacing: "0.12em" }}>✓ PARSED SUCCESSFULLY</span>
            <span style={{ fontSize: 9, background: "rgba(0,255,200,0.1)", color: "#00ffc8", padding: "2px 8px" }}>{result.confidence}% CONFIDENCE</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            {[{ label: "BUY CONDITION", val: result.buyCondition, accent: "#00ffc8" }, { label: "SELL CONDITION", val: result.sellCondition, accent: "#ff3b5c" }].map(f => (
              <div key={f.label} style={{ background: "rgba(0,0,0,0.3)", padding: 10 }}>
                <div style={{ fontSize: 9, color: f.accent, letterSpacing: "0.12em", marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 11, color: "#c0c0d0", fontFamily: "monospace" }}>{f.val}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9, color: "#3a3a50", marginBottom: 12 }}>INDICATORS: {result.indicators.join(" · ")}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={applyResult} style={{ flex: 1, background: "#00ffc8", border: "none", color: "#000", fontSize: 10, padding: "8px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, letterSpacing: "0.1em" }}>
              ▶ USE THIS STRATEGY
            </button>
            <button onClick={() => setResult(null)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#6b6b80", fontSize: 10, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit" }}>
              DISCARD
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
