// ─────────────────────────────────────────────────────────────────────────────
// components/chart/overlays/liquidityOverlay.ts
//
// 3-zone resting liquidity overlay + Liquidation Clusters.
// Zone 3: Liquidation heatmap
// Zone 2: Deep orderbook walls (dashed)
// Zone 1: Live book walls (animated)
// Zone 0: Liquidation Clusters
// ─────────────────────────────────────────────────────────────────────────────

import { registerOverlay } from './overlayRegistry';

registerOverlay({
    key: 'resting_liq',
    timeframes: ['5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'],
    zIndex: 10,
    fn: ({ ctx, cw, toY, getState, candles, indicators }) => {
        const { orderbook, deepOrderbook, liquidations, liqClusters } = getState();
        const currentPrice = candles[candles.length - 1]?.close || 0;
        if (!Array.isArray(indicators)) return;

        // Zone 3: Liquidation heatmap
        if (indicators.includes('liq_overlay') && liquidations?.heatmap?.length) {
            const maxTotal = Math.max(...liquidations.heatmap.map((h: any) => h.total), 1);
            for (const node of liquidations.heatmap) {
                if (!node || node.total < maxTotal * 0.1) continue;
                const y = toY(node.price);
                if (y == null) continue;

                const intensity = node.total / maxTotal;
                ctx.strokeStyle = node.long_liq_usd > node.short_liq_usd
                    ? `rgba(255, 45, 78, ${0.1 + intensity * 0.2})`
                    : `rgba(0, 230, 118, ${0.1 + intensity * 0.2})`;
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
            }
        }

        // Zone 2: Deep orderbook walls (dashed)
        if (indicators.includes('resting_liq') && deepOrderbook) {
            const renderDeep = (levels: { price: number; qty: number }[], isBid: boolean) => {
                if (!levels?.length) return;
                const top30 = [...levels].sort((a, b) => b.qty - a.qty).slice(0, 30);
                const maxQty = Math.max(...top30.map(l => l.qty), 1);
                for (const level of top30) {
                    const y = toY(level.price);
                    if (y == null) continue;

                    const intensity = level.qty / maxQty;
                    if (intensity < 0.2) continue;
                    ctx.strokeStyle = isBid
                        ? `rgba(0, 230, 118, ${0.2 + intensity * 0.4})`
                        : `rgba(255, 45, 78, ${0.2 + intensity * 0.4})`;
                    ctx.lineWidth = Math.max(1, intensity * 3);
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
                    ctx.setLineDash([]);
                }
            };
            renderDeep(deepOrderbook.bids || [], true);
            renderDeep(deepOrderbook.asks || [], false);
        }

        // Zone 1: Live book walls (animated)
        if (indicators.includes('resting_liq') && orderbook?.walls) {
            const allWalls = [
                ...(orderbook.walls.bid_walls ?? []).map((w: any) => ({ ...w, side: 'bid' as const })),
                ...(orderbook.walls.ask_walls ?? []).map((w: any) => ({ ...w, side: 'ask' as const })),
            ];
            const maxWallQty = Math.max(...allWalls.map((w: any) => w.qty), 1);
            for (const wall of allWalls) {
                if (wall.side === 'bid' && currentPrice < wall.price) continue;
                if (wall.side === 'ask' && currentPrice > wall.price) continue;

                const y = toY(wall.price);
                if (y == null) continue;

                const ratio = wall.qty / maxWallQty;
                const pulse = ratio > 0.8 ? Math.sin(Date.now() / 200) * 0.2 : 0;
                ctx.strokeStyle = wall.side === 'bid'
                    ? `rgba(0, 230, 118, ${0.6 + ratio * 0.4 + pulse})`
                    : `rgba(255, 45, 78, ${0.6 + ratio * 0.4 + pulse})`;
                ctx.lineWidth = Math.min(Math.max(ratio * 6, 1), 6);
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();

                const distPct = Math.abs((wall.price - currentPrice) / currentPrice * 100);
                ctx.font = '9px JetBrains Mono, monospace';
                ctx.fillStyle = ctx.strokeStyle;
                ctx.fillText(`${wall.qty.toFixed(2)} (${distPct.toFixed(2)}%)`, cw - 100, y - 4);
            }
        }

        // Zone 0: Liquidation Clusters
        if (indicators.includes('liq_clusters') && liqClusters?.length) {
            for (const cluster of liqClusters) {
                const y = toY(cluster.price);
                if (y == null) continue;

                const thickness = Math.max(2, Math.min(20, cluster.intensity * 20));
                ctx.strokeStyle = cluster.side === 'long'
                    ? `rgba(255, 45, 78, ${0.2 + cluster.ageFactor * 0.6})`
                    : `rgba(0, 230, 118, ${0.2 + cluster.ageFactor * 0.6})`;
                ctx.lineWidth = thickness;
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();

                ctx.font = '9px JetBrains Mono, monospace';
                ctx.fillStyle = ctx.strokeStyle;
                ctx.fillText(`$${(cluster.totalSize / 1e6).toFixed(1)}M`, cw - 50, y - Math.max(4, thickness / 2 + 2));
            }
        }
    }
});
