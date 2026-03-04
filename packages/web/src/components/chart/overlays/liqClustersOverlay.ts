import { registerOverlay } from './overlayRegistry';

registerOverlay({
    key: 'liq_clusters',
    timeframes: ['5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'],
    zIndex: 10,
    fn: ({ ctx, cw, toY, getState, indicators }) => {
        const { liqClusters } = getState();
        if (!Array.isArray(indicators) || !indicators.includes('liq_clusters') || !liqClusters?.length) return;

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

        ctx.globalAlpha = 1.0;
    }
});
