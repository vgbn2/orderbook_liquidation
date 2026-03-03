import { registerOverlay } from './overlayRegistry';
import { useMarketDataStore } from '../../../stores/marketDataStore';

registerOverlay({
    key: 'ict',
    zIndex: 5,
    fn: ({ ctx, cw, toX, toY, indicators }) => {
        const { ictData } = useMarketDataStore.getState();
        if (!ictData || !Array.isArray(indicators)) return;

        const showFVG = indicators.includes('ict_fvg');
        const showOB = indicators.includes('ict_ob');
        const showSweeps = indicators.includes('ict_sweeps');

        // ── FVGs ──
        if (showFVG) ictData.fvgs.forEach(fvg => {
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

        // ── Order Blocks ──
        if (showOB) ictData.orderBlocks.forEach(ob => {
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

        // ── Sweeps ──
        if (showSweeps) ictData.sweeps.forEach(sweep => {
            const x = toX(sweep.sweepCandle.time);
            const y = toY(sweep.sweptLevel);

            if (x == null || y == null) return;

            const isBSL = sweep.type === 'BSL';
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = isBSL ? '#ff3366' : '#00ff88';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 20, y);
            ctx.lineTo(x + 50, y);
            ctx.stroke();

            ctx.fillStyle = isBSL ? '#ff3366' : '#00ff88';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(isBSL ? '✕ BSL SWEEP' : '✕ SSL SWEEP', x, y + (isBSL ? -10 : 20));

            ctx.beginPath();
            ctx.arc(x, y, sweep.confidence === 'high' ? 6 : 4, 0, Math.PI * 2);
            if (sweep.confidence === 'high') {
                ctx.fillStyle = '#ffcc00';
                ctx.fill();
            }
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        ctx.globalAlpha = 1.0;
    }
});
