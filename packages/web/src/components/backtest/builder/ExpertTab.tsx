import { useState, useRef, useEffect } from "react";
import { EXPERT_TEMPLATES, DOCS_VARS, SharedState } from "./constants";
import { SectionLabel } from "./ui";

interface Props {
  shared: SharedState;
  setShared: React.Dispatch<React.SetStateAction<SharedState>>;
}

export function ExpertTab({ shared, setShared }: Props) {
  const [activeTemplate, setActiveTemplate] = useState("sma");
  const [code, setCode] = useState(EXPERT_TEMPLATES.sma.code);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<any>(null);
  const [showDocs, setShowDocs] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const validate = (val: string) => {
    try {
      const p = JSON.parse(val);
      setParseError(null);
      setParsed(p);
      setShared(s => ({
        ...s, ...p,
        stopLoss: p.stopLossPct ?? s.stopLoss,
        slExpr: p.stopLossExpr ?? s.slExpr,
        takeProfit: p.takeProfitPct ?? s.takeProfit,
        tpExpr: p.takeProfitExpr ?? s.tpExpr,
        balance: p.initialBalance ?? s.balance,
        indicators: p.indicators ?? s.indicators,
      }));
    } catch (e: any) {
      setParseError(e.message.split("\n")[0]);
      setParsed(null);
    }
  };

  useEffect(() => { validate(code); }, []);

  const handleChange = (val: string) => { setCode(val); validate(val); };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = taRef.current!;
    const s = el.selectionStart, en = el.selectionEnd;
    const next = code.substring(0, s) + "  " + code.substring(en);
    handleChange(next);
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; });
  };

  const syncFromShared = () => {
    handleChange(JSON.stringify({
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
    }, null, 2));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Template bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Object.entries(EXPERT_TEMPLATES).map(([key, t]) => (
            <button key={key} onClick={() => { setActiveTemplate(key); handleChange(t.code); }} style={{
              background: activeTemplate === key ? "rgba(0,255,200,0.08)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${activeTemplate === key ? "rgba(0,255,200,0.25)" : "rgba(255,255,255,0.06)"}`,
              color: activeTemplate === key ? "#00ffc8" : "#4a4a60",
              fontSize: 10, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit",
            }}>{t.label}</button>
          ))}
        </div>
        <button onClick={syncFromShared} style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          color: "#4a4a60", fontSize: 9, padding: "5px 10px", cursor: "pointer",
          fontFamily: "inherit", letterSpacing: "0.1em", flexShrink: 0,
        }}>↓ IMPORT FROM BUILDER</button>
      </div>

      {/* Editor */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <SectionLabel style={{ marginBottom: 0 }}>STRATEGY JSON</SectionLabel>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {parseError
              ? <span style={{ fontSize: 9, color: "#ff3b5c" }}>✕ {parseError}</span>
              : <span style={{ fontSize: 9, color: "#00ffc8" }}>✓ VALID</span>}
            <button onClick={() => setShowDocs(d => !d)} style={{
              background: showDocs ? "rgba(0,255,200,0.08)" : "transparent",
              border: `1px solid ${showDocs ? "rgba(0,255,200,0.2)" : "rgba(255,255,255,0.06)"}`,
              color: showDocs ? "#00ffc8" : "#3a3a50",
              fontSize: 9, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.1em",
            }}>? DOCS</button>
          </div>
        </div>

        <div style={{ display: "flex", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.4)", fontFamily: "inherit" }}>
          {/* Line numbers */}
          <div style={{ padding: "12px 6px 12px 8px", background: "rgba(0,0,0,0.3)", borderRight: "1px solid rgba(255,255,255,0.04)", userSelect: "none", minWidth: 30 }}>
            {code.split("\n").map((_, i) => (
              <div key={i} style={{ fontSize: 9, color: "#2a2a3a", lineHeight: "1.6", textAlign: "right" }}>{i + 1}</div>
            ))}
          </div>
          <textarea
            ref={taRef} value={code}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#c0c0d0", fontSize: 11, fontFamily: "inherit", padding: 12, resize: "none", lineHeight: 1.6, minHeight: 300 }}
          />
        </div>
      </div>

      {/* Docs panel */}
      {showDocs && (
        <div style={{ border: "1px solid rgba(0,255,200,0.12)", background: "rgba(0,255,200,0.02)", padding: 14 }}>
          <div style={{ fontSize: 10, color: "#00ffc8", letterSpacing: "0.15em", marginBottom: 10 }}>AVAILABLE VARIABLES IN CONDITIONS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4 }}>
            {DOCS_VARS.map(d => (
              <div key={d.token} style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <span style={{ fontSize: 9, color: "#7b9fff", fontFamily: "monospace", minWidth: 120, flexShrink: 0 }}>{d.token}</span>
                <span style={{ fontSize: 9, color: "#3a3a50" }}>{d.desc}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 9, color: "#2a2a3a", lineHeight: 1.7 }}>
            Conditions support any JS expression. Examples:{" "}
            <code style={{ color: "#ffd080" }}>close &gt; sma20 &amp;&amp; rsi14 &lt; 70</code> ·{" "}
            <code style={{ color: "#ffd080" }}>ict_fvg_bull === 1</code>
          </div>
        </div>
      )}

      {/* Parsed summary */}
      {parsed && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[
            { label: "BUY", val: parsed.buyCondition, accent: "#00ffc8" },
            { label: "SELL", val: parsed.sellCondition, accent: "#ff3b5c" },
            {
              label: "SL / TP",
              val: `${parsed.stopLossExpr || (parsed.stopLossPct + "%")} · ${parsed.takeProfitExpr || (parsed.takeProfitPct + "%")}`,
              accent: "#ff9900"
            },
          ].map(item => (
            <div key={item.label} style={{ border: `1px solid ${item.accent}22`, padding: 10, background: `${item.accent}04` }}>
              <div style={{ fontSize: 9, color: item.accent, letterSpacing: "0.12em", marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 10, color: "#8b8ba0", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.val}</div>
            </div>
          ))}
          {parsed.symbols && (
            <div style={{ gridColumn: "1/-1", border: "1px solid rgba(255,153,0,0.2)", padding: 10, background: "rgba(255,153,0,0.03)" }}>
              <div style={{ fontSize: 9, color: "#ff9900", letterSpacing: "0.12em", marginBottom: 6 }}>PORTFOLIO MODE — {parsed.symbols.length} SYMBOLS</div>
              <div style={{ display: "flex", gap: 6 }}>
                {parsed.symbols.map((sym: string) => (
                  <span key={sym} style={{ fontSize: 10, padding: "2px 8px", background: "rgba(255,153,0,0.08)", border: "1px solid rgba(255,153,0,0.2)", color: "#ff9900" }}>{sym}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
