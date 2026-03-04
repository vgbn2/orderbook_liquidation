import { SharedState } from "./constants";
import { HDivider, RiskBar } from "./ui";

const TIPS: Record<string, string[]> = {
  wizard: ["A 1:2+ R:R stays profitable at just 40% win rate.", "Stop losses below 1% get triggered by market noise.", "Test over 200+ trades for statistical significance."],
  blocks: ["Drag conditions from the library into the buy/sell zones.", "Indicators are added automatically when you drop blocks.", "AND = both must be true. Conditions are AND'd by default."],
  natural: ["Be specific: name your indicators and their periods.", "Mention stop loss and take profit in your description.", "After parsing, switch to Visual Builder to fine-tune."],
  visual: ["Click AND/OR between rules to toggle the join operator.", "Indicator aliases auto-populate as available variables.", "The compiled expression shows exactly what will be executed."],
  expert: ["Use && for AND, || for OR inside condition strings.", "All condition variables are arrays indexed at position i.", "'Import from Builder' brings in your visual rules as JSON."],
};

const SYNTAX_EXAMPLES = [
  ["AND both", "condA && condB"],
  ["OR either", "condA || condB"],
  ["Crossover", "sma20 > sma50"],
  ["Exact", "ict_fvg_bull === 1"],
  ["Range", "rsi14 >= 30 && rsi14 <= 70"],
];

interface Props {
  shared: SharedState;
  tab: string;
}

export function Sidebar({ shared, tab }: Props) {
  const tips = TIPS[tab] ?? TIPS.wizard;
  const rrRatio = shared.takeProfit / (shared.stopLoss || 1);

  return (
    <div style={{ padding: 20, background: "rgba(0,0,0,0.2)", overflowY: "auto" }}>
      {/* Live summary */}
      <div style={{ fontSize: 9, color: "#8b8ba0", letterSpacing: "0.15em", marginBottom: 12 }}>STRATEGY SUMMARY</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 18 }}>
        {[
          { label: "BUY", val: shared.buyCondition || "—", mono: true },
          { label: "SELL", val: shared.sellCondition || "—", mono: true },
          { label: "STOP", val: `${shared.stopLoss}%`, color: "#ff3b5c" },
          { label: "TARGET", val: `${shared.takeProfit}%`, color: "#00ffc8" },
          { label: "BALANCE", val: `$${(shared.balance || 0).toLocaleString()}` },
          { label: "R:R", val: `1 : ${rrRatio.toFixed(1)}`, color: rrRatio >= 2 ? "#00ffc8" : "#ff9900" },
        ].map(row => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: "rgba(255,255,255,0.02)", gap: 8 }}>
            <span style={{ fontSize: 9, color: "#8b8ba0", flexShrink: 0 }}>{row.label}</span>
            <span style={{
              fontSize: 9, color: (row as any).color || "#6b6b80",
              textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: 140, fontFamily: (row as any).mono ? "monospace" : "inherit",
            }}>{row.val}</span>
          </div>
        ))}
      </div>

      <HDivider label="RISK" />
      <div style={{ marginBottom: 16 }}>
        <RiskBar label="MAX LOSS / TRADE" value={(shared.stopLoss / 100) * (shared.balance || 0)} max={(shared.balance || 1) * 0.1} color="#ff3b5c" format="$" />
        <RiskBar label="TARGET / TRADE" value={(shared.takeProfit / 100) * (shared.balance || 0)} max={(shared.balance || 1) * 0.3} color="#00ffc8" format="$" />
      </div>

      {shared.indicators?.length > 0 && (
        <>
          <HDivider label="INDICATORS" />
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
            {shared.indicators.map((ind, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 9, color: "#7b9fff", fontFamily: "monospace" }}>{ind.name}</span>
                <span style={{ fontSize: 9, color: "#8b8ba0" }}>{ind.type}({ind.period})</span>
              </div>
            ))}
          </div>
        </>
      )}

      <HDivider label="TIPS" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tips.map((tip, i) => (
          <div key={i} style={{ display: "flex", gap: 8, padding: 9, background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ color: "#00ffc8", fontSize: 9, flexShrink: 0 }}>◈</span>
            <span style={{ fontSize: 9, color: "#8b8ba0", lineHeight: 1.6 }}>{tip}</span>
          </div>
        ))}
      </div>

      {(tab === "visual" || tab === "expert") && (
        <>
          <HDivider label="SYNTAX" />
          {SYNTAX_EXAMPLES.map(([label, ex]) => (
            <div key={label} style={{ marginBottom: 7 }}>
              <div style={{ fontSize: 9, color: "#8b8ba0", marginBottom: 2 }}>{label}</div>
              <code style={{ fontSize: 9, color: "#ffd080", background: "rgba(255,208,128,0.05)", padding: "2px 6px", display: "block" }}>{ex}</code>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
