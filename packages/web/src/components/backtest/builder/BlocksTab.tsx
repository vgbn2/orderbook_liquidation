import { useState } from "react";
import { CONDITION_BLOCKS, SharedState } from "./constants";
import { HDivider } from "./ui";

interface Block {
  id: string;
  label: string;
  icon: string;
  category: string;
  expr: string;
  indRequired: { name: string; type: string; period: number }[];
}

function DraggableBlock({ block }: { block: Block }) {
  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData("text/plain", JSON.stringify(block))}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
        border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)",
        fontSize: 10, color: "#6b6b80", cursor: "grab", userSelect: "none",
      }}
    >
      <span style={{ color: "#00ffc8", fontSize: 11 }}>{block.icon}</span>
      {block.label}
    </div>
  );
}

function DropZone({ label, accent, blocks, onDrop, onRemove }: {
  label: string; accent: string; blocks: Block[];
  onDrop: (b: Block) => void; onRemove: (id: string) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); try { onDrop(JSON.parse(e.dataTransfer.getData("text/plain"))); } catch {} }}
      style={{ border: `1px solid ${over ? accent : accent + "33"}`, background: over ? `${accent}06` : `${accent}02`, padding: 12, minHeight: 110, transition: "all 0.15s" }}
    >
      <div style={{ fontSize: 9, color: accent, letterSpacing: "0.15em", marginBottom: 10 }}>{label}</div>
      {blocks.length === 0
        ? <div style={{ fontSize: 9, color: "#2a2a3a", textAlign: "center", padding: "18px 0" }}>DROP CONDITIONS HERE</div>
        : <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {blocks.map(b => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: `${accent}15`, border: `1px solid ${accent}44`, fontSize: 10, color: accent }}>
                {b.icon} {b.label}
                <span onClick={() => onRemove(b.id)} style={{ cursor: "pointer", opacity: 0.5, marginLeft: 4 }}>✕</span>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

interface Props {
  shared: SharedState;
  setShared: React.Dispatch<React.SetStateAction<SharedState>>;
}

export function BlocksTab({ shared, setShared }: Props) {
  const [buyBlocks, setBuyBlocks]   = useState<Block[]>([]);
  const [sellBlocks, setSellBlocks] = useState<Block[]>([]);

  const mergeIndicators = (blocks: Block[], existing: SharedState["indicators"]) => {
    const merged = [...existing];
    blocks.forEach(b => b.indRequired?.forEach(req => {
      if (!merged.find(i => i.name === req.name)) merged.push(req);
    }));
    return merged;
  };

  const blocksToExpr = (blocks: Block[]) => blocks.map(b => b.expr).join(" && ") || "";

  const handleBuyDrop = (block: Block) => {
    if (buyBlocks.find(b => b.id === block.id)) return;
    const next = [...buyBlocks, block];
    setBuyBlocks(next);
    setShared(s => ({ ...s, buyCondition: blocksToExpr(next), indicators: mergeIndicators(next, s.indicators) }));
  };

  const handleSellDrop = (block: Block) => {
    if (sellBlocks.find(b => b.id === block.id)) return;
    const next = [...sellBlocks, block];
    setSellBlocks(next);
    setShared(s => ({ ...s, sellCondition: blocksToExpr(next), indicators: mergeIndicators(next, s.indicators) }));
  };

  const categories = [...new Set(CONDITION_BLOCKS.map(b => b.category))];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <DropZone label="ENTRY — BUY WHEN..." accent="#00ffc8" blocks={buyBlocks}
          onDrop={handleBuyDrop}
          onRemove={id => { const next = buyBlocks.filter(b => b.id !== id); setBuyBlocks(next); setShared(s => ({ ...s, buyCondition: blocksToExpr(next) })); }} />
        <DropZone label="EXIT — SELL WHEN..." accent="#ff3b5c" blocks={sellBlocks}
          onDrop={handleSellDrop}
          onRemove={id => { const next = sellBlocks.filter(b => b.id !== id); setSellBlocks(next); setShared(s => ({ ...s, sellCondition: blocksToExpr(next) })); }} />
      </div>

      {buyBlocks.length > 0 && (
        <div style={{ marginBottom: 16, padding: "6px 10px", background: "rgba(0,255,200,0.04)", border: "1px solid rgba(0,255,200,0.1)", fontSize: 9, color: "#00ffc8", fontFamily: "monospace" }}>
          → {shared.buyCondition}
        </div>
      )}

      <HDivider label="CONDITION LIBRARY" />

      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: "#2a2a3a", letterSpacing: "0.2em", marginBottom: 8, textTransform: "uppercase" }}>{cat}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CONDITION_BLOCKS.filter(b => b.category === cat).map(block => (
              <DraggableBlock key={block.id} block={block} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
