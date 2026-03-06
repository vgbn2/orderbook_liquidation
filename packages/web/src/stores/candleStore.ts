// ─────────────────────────────────────────────────────────────────────────────
// stores/candleStore.ts
//
// Owns: candles, HTF candles, HTF bias, aggregated candles, CVD.
// Nothing else. If you're looking for orderbook data — wrong store.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { CandleData, HTFBias } from '../types';

function lsGet(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            try { localStorage.removeItem(key); localStorage.setItem(key, value); } catch { }
        }
    }
}

const MAX_CANDLES = 1500;
const MAX_HTF_CANDLES = 500;
const PERSIST_HTF_COUNT = 50; // safe to store, enough for RSI/SMA seed

interface CandleState {
    // Active symbol/timeframe
    symbol: string;
    setSymbol: (s: string) => void;
    timeframe: string;
    setTimeframe: (tf: string) => void;

    // Primary candles
    candles: CandleData[];
    setCandles: (candles: CandleData[]) => void;
    addCandle: (candle: CandleData) => void;
    updateLastCandle: (candle: CandleData) => void;

    // Aggregated candles (multi-exchange VWAP)
    showAggregated: boolean;
    setShowAggregated: (v: boolean) => void;
    aggregatedCandles: CandleData[];
    setAggregatedCandles: (candles: CandleData[]) => void;
    addAggregatedCandle: (candle: CandleData) => void;
    updateLastAggregatedCandle: (candle: CandleData) => void;

    // Higher timeframe candles keyed by tf ('4h', '1d', '1w')
    htfCandles: Record<string, CandleData[]>;
    setHtfCandles: (tf: string, candles: CandleData[]) => void;
    addHtfCandle: (tf: string, candle: CandleData) => void;

    // HTF bias (computed server-side)
    htfBias: Record<string, HTFBias>;
    setHtfBias: (tf: string, bias: HTFBias) => void;

    // Multi-timeframe CVD — in-memory only, never persisted
    multiTfCvd: Record<string, { time: number; value: number }[]>;
    setMultiTfCvd: (tf: string, data: { time: number; value: number }[]) => void;
}

export const useCandleStore = create<CandleState>((set) => ({
    symbol: lsGet('terminus_market_symbol') || 'BTCUSDT',
    setSymbol: (symbol) => { lsSet('terminus_market_symbol', symbol); set({ symbol }); },

    timeframe: lsGet('terminus_market_timeframe') || '1h',
    setTimeframe: (timeframe) => {
        lsSet('terminus_market_timeframe', timeframe);
        set({ timeframe, candles: [], aggregatedCandles: [] });
    },

    candles: [],
    setCandles: (incoming) => set((s) => {
        if (incoming.length === 0) return { candles: [] };
        const map = new Map(s.candles.map(c => [c.time, c]));
        for (const c of incoming) map.set(c.time, c);
        const merged = Array.from(map.values()).sort((a, b) => a.time - b.time).slice(-MAX_CANDLES);
        return { candles: merged };
    }),
    addCandle: (candle) => set((s) => {
        if (s.candles.length > 0 && s.candles[s.candles.length - 1].time === candle.time) return s;
        const next = [...s.candles, candle];
        if (next.length > MAX_CANDLES) next.shift();
        return { candles: next };
    }),
    updateLastCandle: (candle) => set((s) => {
        const next = [...s.candles];
        if (next.length > 0) next[next.length - 1] = candle;
        else next.push(candle);
        return { candles: next };
    }),

    showAggregated: lsGet('terminus_show_aggregated') === 'true',
    setShowAggregated: (v) => { lsSet('terminus_show_aggregated', String(v)); set({ showAggregated: v }); },

    aggregatedCandles: [],
    setAggregatedCandles: (incoming) => set((s) => {
        if (incoming.length === 0) return { aggregatedCandles: [] };
        const map = new Map(s.aggregatedCandles.map(c => [c.time, c]));
        for (const c of incoming) map.set(c.time, c);
        const merged = Array.from(map.values()).sort((a, b) => a.time - b.time).slice(-MAX_CANDLES);
        return { aggregatedCandles: merged };
    }),
    addAggregatedCandle: (candle) => set((s) => {
        if (s.aggregatedCandles.length > 0 && s.aggregatedCandles[s.aggregatedCandles.length - 1].time === candle.time) return s;
        const next = [...s.aggregatedCandles, candle];
        if (next.length > MAX_CANDLES) next.shift();
        return { aggregatedCandles: next };
    }),
    updateLastAggregatedCandle: (candle) => set((s) => {
        const next = [...s.aggregatedCandles];
        if (next.length > 0) next[next.length - 1] = candle;
        else next.push(candle);
        return { aggregatedCandles: next };
    }),

    htfCandles: (() => {
        if (typeof window === 'undefined') return {};
        try {
            const initial: Record<string, CandleData[]> = {
                '4h': JSON.parse(lsGet('terminus_htf_4h_last') || '[]'),
                '1d': JSON.parse(lsGet('terminus_htf_1d_last') || '[]'),
                '1w': JSON.parse(lsGet('terminus_htf_1w_last') || '[]'),
            };
            return initial;
        } catch { return {}; }
    })(),
    setHtfCandles: (tf, incoming) => set((s) => {
        const existing = s.htfCandles[tf] || [];
        const map = new Map(existing.map(c => [c.time, c]));
        for (const c of incoming) map.set(c.time, c);
        const merged = Array.from(map.values()).sort((a, b) => a.time - b.time).slice(-MAX_HTF_CANDLES);
        lsSet(`terminus_htf_${tf}_last`, JSON.stringify(merged.slice(-PERSIST_HTF_COUNT)));
        return { htfCandles: { ...s.htfCandles, [tf]: merged } };
    }),
    addHtfCandle: (tf, candle) => set((s) => {
        const existing = s.htfCandles[tf] ?? [];
        const last = existing[existing.length - 1];
        const updated = last?.time === candle.time
            ? [...existing.slice(0, -1), candle]
            : [...existing, candle].slice(-MAX_HTF_CANDLES);
        lsSet(`terminus_htf_${tf}_last`, JSON.stringify(updated.slice(-PERSIST_HTF_COUNT)));
        return { htfCandles: { ...s.htfCandles, [tf]: updated } };
    }),

    htfBias: {},
    setHtfBias: (tf, bias) => set((s) => ({ htfBias: { ...s.htfBias, [tf]: bias } })),

    // CVD is high-frequency streaming data — never persisted to localStorage
    multiTfCvd: {},
    setMultiTfCvd: (tf, data) => set((s) => ({
        multiTfCvd: { ...s.multiTfCvd, [tf]: data.slice(-500) }
    })),
}));
