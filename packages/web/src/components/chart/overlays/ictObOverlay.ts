import { registerOverlay } from './overlayRegistry';
import { useMarketDataStore } from '../../../stores/marketDataStore';

registerOverlay({
    key: 'ict_ob',
    zIndex: 5,
    fn: ({ ctx, cw, toX, toY, indicators }) => {
        const { ictData } = useMarketDataStore.getState();
        if (!ictData || !Array.isArray(indicators) || !indicators.includes('ict_ob')) return;

        // ── Order Blocks ──
        ictData.orderBlocks.forEach(ob => {
            const yTop = toY(ob.top);
            const yBottom = toY(ob.bottom);
            const xStart = toX(ob.formedAt);

            if (yTop == null || yBottom == null || xStart == null) return;

            ctx.fillStyle = ob.type === 'bullish' ? '#00ccff' : '#ff9900';
            ctx.globalAlpha = 0.15;
            ctx.fillRect(xStart, Math.min(yTop, yBottom), cw - xStart, Math.abs(yTop - yBottom));

            ctx.strokeStyle = ob.type === 'bullish' ? '#00ccff88' : '#ff990088';
            ctx.lineWidth = 1;
            if (ob.strength === 'tested') ctx.setLineDash([4, 2]);
            ctx.strokeRect(xStart, Math.min(yTop, yBottom), cw - xStart, Math.abs(yTop - yBottom));
            ctx.setLineDash([]);
        });

        ctx.globalAlpha = 1.0;
    }
});
