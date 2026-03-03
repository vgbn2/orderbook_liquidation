// ─────────────────────────────────────────────────────────────────────────────
// components/chart/overlays/overlayRegistry.ts
//
// Plugin system for chart overlays.
// Allows adding new visual layers without touching Chart.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { CandleData } from '../../../types';

export interface OverlayContext {
    ctx: CanvasRenderingContext2D;
    cw: number;
    ch: number;
    chart: IChartApi;
    candleSeries: ISeriesApi<'Candlestick'>;
    candles: CandleData[];
    indicators: any;
    timeframe: string;
    toX: (time: number) => number | null;
    toY: (price: number) => number | null;
    getState: () => any;
}

export interface Overlay {
    key: string;
    timeframes?: string[];
    zIndex?: number;
    fn: (ctx: OverlayContext) => void;
}

const overlays: Overlay[] = [];

/** Register a new overlay renderer */
export function registerOverlay(overlay: Overlay) {
    // Prevent duplicate registration on fast refreshes
    if (overlays.find(o => o.key === overlay.key)) return;

    overlays.push(overlay);

    // Sort by zIndex so lower values draw first (background)
    overlays.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
}

/** Execute all registered overlays for the current context */
export function runOverlays(context: OverlayContext) {
    for (const overlay of overlays) {
        // Only run if the current timeframe is supported (or all supported if null)
        if (!overlay.timeframes || overlay.timeframes.includes(context.timeframe)) {
            try {
                overlay.fn(context);
            } catch (err) {
                console.error(`Overlay [${overlay.key}] failed:`, err);
            }
        }
    }
}
