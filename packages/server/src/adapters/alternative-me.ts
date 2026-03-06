import { logger } from '../logger.js';
import { redis } from '../db/redis.js';

// ══════════════════════════════════════════════════════════════
//  Alternative.me Adapter — Crypto Fear & Greed Index
// ══════════════════════════════════════════════════════════════

const CACHE_KEY = 'signal:fear_greed';
const CACHE_TTL = 6 * 60 * 60; // 6 hours
const API_URL = 'https://api.alternative.me/fng/?limit=1&format=json';

export interface FearGreedData {
    value: number;           // 0-100
    classification: string;  // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
    timestamp: number;
    /** Contrarian bias: -1 (extreme greed = bearish) to +1 (extreme fear = bullish) */
    contrarianBias: number;
}

function computeContrarianBias(value: number): number {
    // 0 = Extreme Fear → +1 (strong buy signal)
    // 50 = Neutral → 0
    // 100 = Extreme Greed → -1 (strong sell signal)
    return (50 - value) / 50;
}

class AlternativeMeAdapter {
    private lastData: FearGreedData | null = null;

    async fetch(): Promise<FearGreedData | null> {
        try {
            // Check Redis cache first
            const cached = await redis.get(CACHE_KEY);
            if (cached) {
                this.lastData = JSON.parse(cached);
                return this.lastData;
            }

            const res = await fetch(API_URL);
            if (!res.ok) throw new Error(`Alternative.me API ${res.status}`);

            const json = await res.json() as { data: Array<{ value: string; value_classification: string; timestamp: string }> };
            const entry = json.data?.[0];
            if (!entry) throw new Error('Empty response from Alternative.me');

            const value = parseInt(entry.value, 10);
            const data: FearGreedData = {
                value,
                classification: entry.value_classification,
                timestamp: parseInt(entry.timestamp, 10) * 1000,
                contrarianBias: computeContrarianBias(value),
            };

            this.lastData = data;
            await redis.set(CACHE_KEY, JSON.stringify(data), 'EX', CACHE_TTL);
            logger.info({ value: data.value, class: data.classification }, 'Fear & Greed fetched');
            return data;
        } catch (err) {
            logger.warn({ err }, 'Failed to fetch Fear & Greed — using last known value');
            return this.lastData;
        }
    }

    getLastData(): FearGreedData | null {
        return this.lastData;
    }
}

export const alternativeMeAdapter = new AlternativeMeAdapter();
