import { getCachedCandles, saveCandles, mergeGapCandles } from './candleCache';

const PREWARM_DELAY_MS = 500;
let isPrewarming = false;

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestIdleCallbackPolyfill(): Promise<void> {
    return new Promise((resolve) => {
        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => resolve());
        } else {
            setTimeout(() => resolve(), 1);
        }
    });
}

export async function startPrewarm(ranked: { symbol: string; timeframe: string }[]): Promise<void> {
    if (ranked.length === 0 || isPrewarming) return;

    const connection = (navigator as any).connection;
    if (connection) {
        if (connection.saveData === true) return;
        if (['2g', 'slow-2g'].includes(connection.effectiveType)) return;
    }

    isPrewarming = true;
    try {
        for (const combo of ranked) {
            await requestIdleCallbackPolyfill();
            const existing = await getCachedCandles(combo.symbol, combo.timeframe);

            if (existing.fromCache === 'none') {
                await prewarmFull(combo.symbol, combo.timeframe);
                await sleep(PREWARM_DELAY_MS);
            } else if (existing.stale) {
                await prewarmGapFill(combo.symbol, combo.timeframe, existing.lastTime);
                await sleep(200);
            }
        }
    } finally {
        isPrewarming = false;
    }
}

async function prewarmFull(symbol: string, timeframe: string): Promise<void> {
    try {
        const res = await fetch(`/api/ohlcv?symbol=${symbol}&interval=${timeframe}&limit=2000`);
        if (!res.ok) return;
        const candles = await res.json();
        if (candles.length > 0) {
            await saveCandles(symbol, timeframe, candles);
        }
    } catch (err) {
        // Silent fail
    }
}

async function prewarmGapFill(symbol: string, timeframe: string, lastTime: number): Promise<void> {
    try {
        const sinceMs = lastTime * 1000;
        const res = await fetch(`/api/ohlcv?symbol=${symbol}&interval=${timeframe}&since=${sinceMs}&limit=300`);
        if (!res.ok) return;
        const fresh = await res.json();
        if (fresh.length > 0) {
            const existing = await getCachedCandles(symbol, timeframe);
            await mergeGapCandles(symbol, timeframe, fresh, existing.candles);
        }
    } catch (err) {
        // Silent fail
    }
}
