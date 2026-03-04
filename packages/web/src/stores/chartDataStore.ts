import { create } from 'zustand';
import type { CandleData } from '../types';

interface ChartDataState {
    historicalData: CandleData[];
    isFetchingHistory: boolean;
    oldestKnownTime: number | null;

    loadInitialData: (symbol: string, interval: string) => Promise<void>;
    fetchHistoricalChunk: (symbol: string, interval: string) => Promise<void>;
    handleLiveTick: (candle: CandleData) => void;
}

export const useChartDataStore = create<ChartDataState>((set, get) => ({
    historicalData: [],
    isFetchingHistory: false,
    oldestKnownTime: null,

    async loadInitialData(symbol, interval) {
        const endTime = Math.floor(Date.now() / 1000);
        // Step 1: Load most recent 100 for instant display
        const res = await fetch(`/api/ohlcv?symbol=${symbol}&interval=${interval}&limit=100&endTime=${endTime}`);
        if (!res.ok) return;
        const data: CandleData[] = await res.json();
        if (data.length === 0) return;

        const oldest = data[0].time;
        set({
            historicalData: data,
            oldestKnownTime: oldest,
        });

        // Step 2: Incrementally load 100 more at a time in background until we hit ~1500
        // We do this without blocking the UI
        const fillTo1500 = async () => {
            let currentCount = data.length;
            while (currentCount < 1500) {
                const { oldestKnownTime, historicalData } = get();
                if (!oldestKnownTime) break;

                const chunkRes = await fetch(
                    `/api/ohlcv?symbol=${symbol}&interval=${interval}&limit=100&endTime=${oldestKnownTime}`
                );
                if (!chunkRes.ok) break;
                const chunk: CandleData[] = await chunkRes.json();
                if (chunk.length === 0) break;

                const nextOldest = chunk[0].time;
                const merged = [...chunk, ...historicalData];
                // Keep it sorted and capped at 1500
                const capped = merged.sort((a, b) => a.time - b.time).slice(-1500);

                set({
                    historicalData: capped,
                    oldestKnownTime: nextOldest,
                });

                currentCount = capped.length;
                if (chunk.length < 100) break; // Reached beginning of history

                // Small delay to prevent hammering the API too hard
                await new Promise(r => setTimeout(r, 100));
            }
        };

        fillTo1500().catch(err => console.error('Incremental load failed:', err));
    },

    async fetchHistoricalChunk(symbol, interval) {
        const { isFetchingHistory, oldestKnownTime, historicalData } = get();
        if (isFetchingHistory || !oldestKnownTime) return;

        set({ isFetchingHistory: true });
        try {
            const res = await fetch(
                `/api/ohlcv?symbol=${symbol}&interval=${interval}&limit=100&endTime=${oldestKnownTime}`,
            );
            if (!res.ok) return;
            const chunk: CandleData[] = await res.json();
            if (chunk.length === 0) return;

            const nextOldest = chunk[0].time;
            const merged = [...chunk, ...historicalData];
            const capped = merged.slice(-1500);

            set({
                historicalData: capped,
                oldestKnownTime: nextOldest,
            });
        } finally {
            set({ isFetchingHistory: false });
        }
    },

    handleLiveTick(candle) {
        const { historicalData } = get();
        if (historicalData.length === 0) {
            set({ historicalData: [candle] });
            return;
        }

        const last = historicalData[historicalData.length - 1];
        let updated = historicalData;

        if (candle.time === last.time) {
            updated = [...historicalData.slice(0, -1), candle];
        } else if (candle.time > last.time) {
            updated = [...historicalData, candle];
        } else {
            return;
        }

        set({ historicalData: updated });
    },
}));

