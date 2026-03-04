import { useState, useRef } from "react";
import { INDICATOR_TYPES, OPERATORS, ENV_VARS, SharedState } from "./constants";
import { HDivider, SectionLabel, AddBtn, NumInput, inputStyle } from "./ui";

interface Rule {
  id: number;
  left: string;
  op: string;
  right: string;
  rightType: "var" | "const";
  join: "&&" | "||" | null;
}

interface Indicator {
  id: number;
  name: string;
  type: string;
  period: number;
}

function RuleRow({ rule, availableVars, onChange, onDelete }: {
  rule: Rule; availableVars: string[];
  onChange: (r: Rule) => void; onDelete: () => void;
}) {
  const allVars = [...ENV_VARS, ...availableVars];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <select value={rule.left} onChange={e => onChange({ ...rule, left: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
        {allVars.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <select value={rule.op} onChange={e => onChange({ ...rule, op: e.target.value })} style={{ ...inputStyle, width: 55, textAlign: "center" }}>
        {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <select value={rule.rightType} onChange={e => onChange({ ...rule, rightType: e.target.value as "var" | "const", right: "" })} style={{ ...inputStyle, width: 75 }}>
        <option value="var">Variable</option>
        <option value="const">Number</option>
      </select>
      {rule.rightType === "var"
        ? <select value={rule.right} onChange={e => onChange({ ...rule, right: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
            {allVars.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        : <input type="number" value={rule.right} onChange={e => onChange({ ...rule, right: e.target.value })} placeholder="value" style={{ ...inputStyle, width: 80 }} />
      }
      <button onClick={onDelete} style={{ background: "transparent", border: "none", color: "#3a3a50", cursor: "pointer", fontSize: 14, padding: "0 4px", flexShrink: 0 }}>✕</button>
    </div>
  );
}

function RuleBlock({ label, accent, sublabel, rules, availableVars, onAdd, onChange, onDelete, onToggleJoin, expr }: {
  label: string; accent: string; sublabel: string; rules: Rule[]; availableVars: string[];
  expr: string;
  onAdd: () => void;
  onChange: (id: number, r: Rule) => void;
  onDelete: (id: number) => void;
  onToggleJoin: (id: number) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 9, color: accent, letterSpacing: "0.15em" }}>{label}</span>
        <span style={{ fontSize: 9, color: "#2a2a3a" }}>{sublabel}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
        {rules.map((rule, idx) => (
          <div key={rule.id}>
            {idx > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.03)" }} />
                <button onClick={() => onToggleJoin(rule.id)} style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: rule.join === "&&" ? "#7b9fff" : "#ff9900",
                  fontSize: 9, padding: "1px 8px", cursor: "pointer", fontFamily: "inherit",
                }}>{rule.join === "&&" ? "AND" : "OR"}</button>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.03)" }} />
              </div>
            )}
            <RuleRow rule={rule} availableVars={availableVars}
              onChange={r => onChange(rule.id, r)} onDelete={() => onDelete(rule.id)} />
          </div>
        ))}
      </div>
      <AddBtn onClick={onAdd}>+ ADD CONDITION</AddBtn>
      {expr && (
        <div style={{ marginTop: 6, padding: "5px 10px", background: `${accent}08`, border: `1px solid ${accent}22`, fontSize: 9, color: accent, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          → {expr}
        </div>
      )}
    </div>
  );
}

interface Props {
  shared: SharedState;
  setShared: React.Dispatch<React.SetStateAction<SharedState>>;
}

const SNIPPETS: Record<string, { buy: Rule[]; sell: Rule[]; inds: Indicator[] }> = {
  sma_cross:  { buy: [{id:1,left:"sma20",op:">",right:"sma50",rightType:"var",join:null}],           sell: [{id:2,left:"sma20",op:"<",right:"sma50",rightType:"var",join:null}],          inds: [{id:1,name:"sma20",type:"SMA",period:20},{id:2,name:"sma50",type:"SMA",period:50}] },
  rsi_bounce: { buy: [{id:1,left:"rsi14",op:"<",right:"30",rightType:"const",join:null}],            sell: [{id:2,left:"rsi14",op:">",right:"70",rightType:"const",join:null}],           inds: [{id:1,name:"rsi14",type:"RSI",period:14}] },
  ict_fvg:    { buy: [{id:1,left:"ict_fvg_bull",op:"===",right:"1",rightType:"const",join:null}],    sell: [{id:2,left:"ict_fvg_bear",op:"===",right:"1",rightType:"const",join:null}],   inds: [{id:1,name:"ict",type:"ICT",period:10}] },
  vrvp_poc:   { buy: [{id:1,left:"vrvp_poc",op:">",right:"close",rightType:"var",join:null}],        sell: [{id:2,left:"vrvp_poc",op:"<",right:"close",rightType:"var",join:null}],       inds: [{id:1,name:"vrvp",type:"VRVP",period:50}] },
};

export function VisualBuilderTab({ shared, setShared }: Props) {
  const nextId = useRef(20);
  const [indicators, setIndicators] = useState<Indicator[]>(shared.indicators.map((ind, i) => ({ ...ind, id: i + 1 })));
  const [buyRules,  setBuyRules]  = useState<Rule[]>([{ id: 1, left: "sma20", op: ">", right: "sma50", rightType: "var", join: null }]);
  const [sellRules, setSellRules] = useState<Rule[]>([{ id: 2, left: "sma20", op: "<", right: "sma50", rightType: "var", join: null }]);
  const [activeSnippet, setActiveSnippet] = useState<string | null>(null);

  const availableVars = indicators.flatMap(ind => {
    if (ind.type === "ICT")  return [`${ind.name}_fvg_bull`, `${ind.name}_fvg_bear`, `${ind.name}_sweep_bsl`, `${ind.name}_sweep_ssl`];
    if (ind.type === "VRVP") return [`${ind.name}_poc`, `${ind.name}_vah`, `${ind.name}_val`];
    return [ind.name];
  });

  const rulesToExpr = (rules: Rule[]) =>
    rules.map((r, i) => (i === 0 ? `${r.left} ${r.op} ${r.right}` : `${r.join ?? "&&"} ${r.left} ${r.op} ${r.right}`)).join(" ");

  const syncToShared = (inds: Indicator[], buys: Rule[], sells: Rule[]) => {
    setShared(s => ({
      ...s,
      buyCondition:  rulesToExpr(buys),
      sellCondition: rulesToExpr(sells),
      indicators: inds.map(({ id, ...rest }) => rest),
    }));
  };

  const loadSnippet = (key: string) => {
    const s = SNIPPETS[key];
    if (!s) return;
    setActiveSnippet(key);
    setIndicators(s.inds);
    setBuyRules(s.buy);
    setSellRules(s.sell);
    syncToShared(s.inds, s.buy, s.sell);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <SectionLabel>QUICK LOAD</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(["sma_cross", "rsi_bounce", "ict_fvg", "vrvp_poc"] as const).map(key => (
            <button key={key} onClick={() => loadSnippet(key)} style={{
              background: activeSnippet === key ? "rgba(0,255,200,0.08)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${activeSnippet === key ? "rgba(0,255,200,0.25)" : "rgba(255,255,255,0.06)"}`,
              color: activeSnippet === key ? "#00ffc8" : "#4a4a60",
              fontSize: 10, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit",
            }}>{key.replace("_", " ").toUpperCase()}</button>
          ))}
        </div>
      </div>

      <HDivider />

      <div>
        <SectionLabel>INDICATORS</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {indicators.map(ind => (
            <div key={ind.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <input value={ind.name} placeholder="alias"
                onChange={e => { const next = indicators.map(i => i.id === ind.id ? { ...i, name: e.target.value } : i); setIndicators(next); syncToShared(next, buyRules, sellRules); }}
                style={{ ...inputStyle, width: 110 }} />
              <select value={ind.type}
                onChange={e => { const next = indicators.map(i => i.id === ind.id ? { ...i, type: e.target.value } : i); setIndicators(next); syncToShared(next, buyRules, sellRules); }}
                style={{ ...inputStyle, width: 75 }}>
                {INDICATOR_TYPES.map(t => <option key={t.type} value={t.type}>{t.type}</option>)}
              </select>
              <span style={{ fontSize: 9, color: "#2a2a3a", flexShrink: 0 }}>PERIOD</span>
              <input type="number" value={ind.period}
                onChange={e => { const next = indicators.map(i => i.id === ind.id ? { ...i, period: parseInt(e.target.value) } : i); setIndicators(next); syncToShared(next, buyRules, sellRules); }}
                style={{ ...inputStyle, width: 60 }} />
              <button onClick={() => { const next = indicators.filter(i => i.id !== ind.id); setIndicators(next); syncToShared(next, buyRules, sellRules); }}
                style={{ background: "transparent", border: "none", color: "#3a3a50", cursor: "pointer", fontSize: 14, padding: "0 4px", flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </div>
        <AddBtn onClick={() => setIndicators([...indicators, { id: nextId.current++, name: "", type: "SMA", period: 20 }])}>
          + ADD INDICATOR
        </AddBtn>
        {availableVars.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {availableVars.map(v => (
              <span key={v} style={{ fontSize: 9, padding: "2px 6px", background: "rgba(0,255,200,0.06)", border: "1px solid rgba(0,255,200,0.15)", color: "#00ffc8" }}>{v}</span>
            ))}
          </div>
        )}
      </div>

      <HDivider />

      <RuleBlock label="ENTRY RULES" accent="#00ffc8" sublabel="ALL must be true to BUY"
        rules={buyRules} availableVars={availableVars} expr={rulesToExpr(buyRules)}
        onAdd={() => { const r: Rule = { id: nextId.current++, left: "close", op: ">", right: "sma20", rightType: "var", join: "&&" }; const next = [...buyRules, r]; setBuyRules(next); syncToShared(indicators, next, sellRules); }}
        onChange={(id, r) => { const next = buyRules.map(x => x.id === id ? r : x); setBuyRules(next); syncToShared(indicators, next, sellRules); }}
        onDelete={id => { const next = buyRules.filter(x => x.id !== id); setBuyRules(next); syncToShared(indicators, next, sellRules); }}
        onToggleJoin={id => { const next = buyRules.map(x => x.id === id ? { ...x, join: x.join === "&&" ? "||" as const : "&&" as const } : x); setBuyRules(next); syncToShared(indicators, next, sellRules); }}
      />

      <RuleBlock label="EXIT RULES" accent="#ff3b5c" sublabel="ANY true will SELL"
        rules={sellRules} availableVars={availableVars} expr={rulesToExpr(sellRules)}
        onAdd={() => { const r: Rule = { id: nextId.current++, left: "close", op: "<", right: "sma20", rightType: "var", join: "||" }; const next = [...sellRules, r]; setSellRules(next); syncToShared(indicators, buyRules, next); }}
        onChange={(id, r) => { const next = sellRules.map(x => x.id === id ? r : x); setSellRules(next); syncToShared(indicators, buyRules, next); }}
        onDelete={id => { const next = sellRules.filter(x => x.id !== id); setSellRules(next); syncToShared(indicators, buyRules, next); }}
        onToggleJoin={id => { const next = sellRules.map(x => x.id === id ? { ...x, join: x.join === "&&" ? "||" as const : "&&" as const } : x); setSellRules(next); syncToShared(indicators, buyRules, next); }}
      />

      <HDivider />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <NumInput label="STOP LOSS"   unit="%" value={shared.stopLoss}   step={0.5}  accent="#ff3b5c" onChange={v => setShared(s => ({ ...s, stopLoss: v }))} />
        <NumInput label="TAKE PROFIT" unit="%" value={shared.takeProfit} step={0.5}  accent="#00ffc8" onChange={v => setShared(s => ({ ...s, takeProfit: v }))} />
        <NumInput label="BALANCE"     unit="$" value={shared.balance}    step={1000}               onChange={v => setShared(s => ({ ...s, balance: v }))} />
        <NumInput label="ENTRY FEE"   unit="%" value={shared.entryFee}   step={0.01}               onChange={v => setShared(s => ({ ...s, entryFee: v }))} />
        <NumInput label="EXIT FEE"    unit="%" value={shared.exitFee}    step={0.01}               onChange={v => setShared(s => ({ ...s, exitFee: v }))} />
        <NumInput label="SLIPPAGE"    unit="%" value={shared.slippage}   step={0.05}               onChange={v => setShared(s => ({ ...s, slippage: v }))} />
      </div>
    </div>
  );
}
