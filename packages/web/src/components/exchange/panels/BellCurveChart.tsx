import { useRef, useEffect } from 'react';
import { fmt, safe } from '../../../utils/safe';
import { gaussian } from '../../../utils/quantUtils';

export function BellCurveChart({ sigmaGrid }: { sigmaGrid: any[] }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sg = safe.arr(sigmaGrid);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || sg.length < 2) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);

        const sigmas = sg.map((r: any) => safe.num(r.sigma));
        const minS = Math.min(...sigmas);
        const maxS = Math.max(...sigmas);
        const range = maxS - minS || 1;

        const totalProb = sg.reduce((s, r) => s + safe.num(r.probability), 0) || 1;
        const meanSigma = sg.reduce((s, r) => s + safe.num(r.sigma) * safe.num(r.probability), 0) / totalProb;
        const stdSigma = Math.sqrt(
            sg.reduce((s, r) => s + safe.num(r.probability) * Math.pow(safe.num(r.sigma) - meanSigma, 2), 0) / totalProb
        ) || 1;

        const pad = { l: 4, r: 4, t: 8, b: 14 };
        const cw = W - pad.l - pad.r;
        const ch = H - pad.t - pad.b;
        const toX = (s: number) => pad.l + ((s - minS) / range) * cw;
        const toY = (v: number) => pad.t + (1 - v) * ch;

        const steps = 150;
        const pts: [number, number][] = [];
        let maxV = 0;
        for (let i = 0; i <= steps; i++) {
            const s = minS + (i / steps) * range;
            const v = gaussian(s, meanSigma, stdSigma);
            if (v > maxV) maxV = v;
            pts.push([s, v]);
        }

        const drawSide = (filterFn: (s: number) => boolean, r: string, g: string, b: string) => {
            const filtered = pts.filter(([s]) => filterFn(s));
            if (filtered.length < 2) return;
            const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
            grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0.04)`);
            ctx.beginPath();
            ctx.moveTo(toX(filtered[0][0]), toY(0));
            filtered.forEach(([s, v]) => ctx.lineTo(toX(s), toY(v / maxV)));
            ctx.lineTo(toX(filtered[filtered.length - 1][0]), toY(0));
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.beginPath();
            filtered.forEach(([s, v], i) => {
                const x = toX(s); const y = toY(v / maxV);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        };

        drawSide((s: any) => s <= 0, '255', '45', '78');
        drawSide((s: any) => s >= 0, '0', '232', '122');

        // Zero line
        ctx.beginPath();
        ctx.moveTo(toX(0), pad.t);
        ctx.lineTo(toX(0), pad.t + ch);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Peak marker
        ctx.beginPath();
        ctx.moveTo(toX(meanSigma), pad.t + 2);
        ctx.lineTo(toX(meanSigma), pad.t + ch);
        ctx.strokeStyle = 'rgba(255,235,59,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Labels
        ctx.font = '8px JetBrains Mono, monospace';
        ctx.fillStyle = 'rgba(100,100,130,0.85)';
        ctx.textAlign = 'center';

        sg.forEach((row: any) => {
            const x = toX(safe.num(row.sigma));
            ctx.fillText(fmt.price(row.price), x, H - 2);
            ctx.beginPath();
            ctx.moveTo(x, pad.t + ch);
            ctx.lineTo(x, pad.t + ch + 3);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.stroke();
        });

    }, [sg]);

    if (sg.length < 2) return <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 10 }}>Insufficient distribution data</div>;
    return <canvas ref={canvasRef} style={{ width: '100%', height: '110px', display: 'block' }} />;
}
