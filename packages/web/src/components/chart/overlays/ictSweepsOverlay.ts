import { registerOverlay } from './overlayRegistry';
import { useMarketDataStore } from '../../../stores/marketDataStore';

registerOverlay({
    key: 'ict_sweeps',
    zIndex: 5,
    fn: ({ ctx, toX, toY, indicators }) => {
        const { ictData } = useMarketDataStore.getState();
        if (!ictData || !Array.isArray(indicators) || !indicators.includes('ict_sweeps')) return;

        // ── Sweeps ──
        ictData.sweeps.forEach(sweep => {
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
