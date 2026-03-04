import { registerOverlay } from './overlayRegistry';
import { useMarketDataStore } from '../../../stores/marketDataStore';

registerOverlay({
    key: 'ict_fvg',
    zIndex: 5,
    fn: ({ ctx, cw, toX, toY, indicators }) => {
        const { ictData } = useMarketDataStore.getState();
        if (!ictData || !Array.isArray(indicators) || !indicators.includes('ict_fvg')) return;

        // ── FVGs ──
        ictData.fvgs.forEach(fvg => {
            const yTop = toY(fvg.top);
            const yBottom = toY(fvg.bottom);
            const xStart = toX(fvg.formedAt);

            if (yTop == null || yBottom == null || xStart == null) return;

            ctx.fillStyle = fvg.type === 'bullish' ? '#00ff88' : '#ff3366';
            ctx.globalAlpha = 0.1 - (fvg.partialFill * 0.08);
            ctx.fillRect(xStart, Math.min(yTop, yBottom), cw - xStart, Math.abs(yTop - yBottom));

            ctx.strokeStyle = fvg.type === 'bullish' ? '#00ff8844' : '#ff336644';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(xStart, Math.min(yTop, yBottom), cw - xStart, Math.abs(yTop - yBottom));

            // Midpoint
            const yMid = toY(fvg.midpoint);
            if (yMid != null) {
                ctx.beginPath();
                ctx.setLineDash([2, 2]);
                ctx.strokeStyle = fvg.type === 'bullish' ? '#00ff8822' : '#ff336622';
                ctx.moveTo(xStart, yMid);
                ctx.lineTo(cw, yMid);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });

        ctx.globalAlpha = 1.0;
    }
});
