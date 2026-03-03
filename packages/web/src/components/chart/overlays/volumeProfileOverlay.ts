import { registerOverlay } from './overlayRegistry';
import { computeVRVP } from '../../../lib/vrvp';

registerOverlay({
    key: 'vol_profile',
    zIndex: 2,
    fn: ({ ctx, cw, chart, toY, candles, indicators }) => {
        if (!Array.isArray(indicators) || !indicators.includes('vol_profile')) return;

        const ts = chart.timeScale();
        const range = ts.getVisibleLogicalRange();
        if (!range || candles.length === 0) return;

        const fromIdx = Math.max(0, Math.floor(range.from));
        const toIdx = Math.min(candles.length - 1, Math.ceil(range.to));
        const visibleCandles = candles.slice(fromIdx, toIdx + 1);

        const profile = computeVRVP(visibleCandles, 50);
        if (profile) {
            const firstRow = profile.rows[0];
            const yHigh = toY(firstRow.priceHigh);
            const yLow = toY(firstRow.priceLow);

            if (yHigh !== null && yLow !== null) {
                const rowHeight = Math.abs(yHigh - yLow);
                const maxBarWidth = cw * 0.2;

                for (const row of profile.rows) {
                    const y = toY(row.priceMid);
                    if (y == null) continue;

                    const width = (row.volume / profile.maxVolume) * maxBarWidth;
                    const rx = cw - width - 50;

                    ctx.fillStyle = row.isPOC ? 'rgba(255, 235, 59, 0.2)' : 'rgba(255, 255, 255, 0.05)';
                    if (row.priceMid >= profile.val && row.priceMid <= profile.vah) {
                        ctx.fillStyle = row.isPOC ? 'rgba(255, 235, 59, 0.3)' : 'rgba(255, 255, 255, 0.1)';
                    }
                    ctx.fillRect(rx, y - rowHeight / 2, width, rowHeight - 1);

                    const buyWidth = (row.buyVolume / row.volume) * width;
                    ctx.fillStyle = 'rgba(0, 255, 136, 0.3)';
                    ctx.fillRect(rx, y - rowHeight / 2, buyWidth, rowHeight - 1);
                }

                const pocY = toY(profile.poc);
                if (pocY != null) {
                    ctx.strokeStyle = '#ffcc00';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(cw - maxBarWidth - 60, pocY);
                    ctx.lineTo(cw, pocY);
                    ctx.stroke();
                }
            }
        }
    }
});
