import { registerOverlay } from './overlayRegistry';

registerOverlay({
    key: 'liq_overlay',
    timeframes: ['5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'],
    zIndex: 10,
    fn: ({ ctx, cw, toY, getState, indicators }) => {
        const { liquidations } = getState();
        if (!Array.isArray(indicators) || !indicators.includes('liq_overlay') || !liquidations?.heatmap?.length) return;

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

        ctx.globalAlpha = 1.0;
    }
});
