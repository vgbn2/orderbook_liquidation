import { registerOverlay } from './overlayRegistry';

registerOverlay({
    key: 'session_boxes',
    timeframes: ['1m', '2m', '3m', '5m', '15m', '30m', '1h', '4h'],
    zIndex: 1,
    fn: ({ ctx, cw, chart, toY, candles, indicators }) => {
        if (!Array.isArray(indicators) || !indicators.includes('session_boxes')) return;

        const ts = chart.timeScale();
        const range = ts.getVisibleLogicalRange();
        if (!range || candles.length === 0) return;

        const fromIdx = Math.max(0, Math.floor(range.from));
        const toIdx = Math.min(candles.length - 1, Math.ceil(range.to));

        const sessions: Record<string, { high: number, low: number, startIdx: number, endIdx: number, color: string, name: string }> = {};

        for (let i = fromIdx; i <= toIdx; i++) {
            const c = candles[i];
            const d = new Date(c.time * 1000);
            const h = d.getUTCHours();
            const dayKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;

            const updateSession = (name: string, color: string) => {
                const key = `${dayKey}_${name}`;
                if (!sessions[key]) {
                    sessions[key] = { high: c.high, low: c.low, startIdx: i, endIdx: i, color, name };
                } else {
                    sessions[key].high = Math.max(sessions[key].high, c.high);
                    sessions[key].low = Math.min(sessions[key].low, c.low);
                    sessions[key].endIdx = i;
                }
            };

            if (h >= 0 && h < 8) updateSession('ASIA', 'rgba(255, 193, 7, 0.1)'); // yellow
            if (h >= 7 && h < 16) updateSession('LONDON', 'rgba(33, 150, 243, 0.1)'); // blue
            if (h >= 13 && h < 22) updateSession('NY', 'rgba(244, 67, 54, 0.1)'); // red
        }

        for (const s of Object.values(sessions)) {
            const x1 = ts.timeToCoordinate(candles[s.startIdx].time as any);
            let x2 = ts.timeToCoordinate(candles[s.endIdx].time as any);

            const y1 = toY(s.high);
            const y2 = toY(s.low);

            if (x1 == null || y1 == null || y2 == null) continue;
            const xx1 = x1 as number;
            let xx2 = x2 != null ? x2 as number : cw;
            const yy1 = y1 as number;
            const yy2 = y2 as number;

            const bx = Math.min(xx1, xx2);
            const bw = Math.abs(xx2 - xx1) || (cw / 100);
            const by = Math.min(yy1, yy2);
            const bh = Math.abs(yy2 - yy1);

            ctx.fillStyle = s.color;
            ctx.fillRect(bx, by, bw, Math.max(bh, 1));

            const borderColor = s.color.replace('0.1', '0.4');
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, bw, Math.max(bh, 1));

            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(bx + bw, by); ctx.lineTo(cw, by);
            ctx.moveTo(bx + bw, by + bh); ctx.lineTo(cw, by + bh);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.font = '10px sans-serif';
            ctx.fillStyle = borderColor;
            ctx.fillText(s.name, bx + 5, by + 12);
        }
    }
});
