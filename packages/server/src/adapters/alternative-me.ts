import { logger } from '../logger.js';

export interface FearGreedData {
    value: number;
    value_classification: string;
    timestamp: string;
    time_until_update: string;
}

class AlternativeMeAdapter {
    private lastData: FearGreedData | null = null;
    private lastFetch = 0;

    async fetch(): Promise<FearGreedData | null> {
        // Cache for 4 hours
        if (Date.now() - this.lastFetch < 14400000 && this.lastData) {
            return this.lastData;
        }

        try {
            const res = await fetch('https://api.alternative.me/fng/');
            const json = await res.json() as { data: FearGreedData[] };

            if (json.data && json.data.length > 0) {
                this.lastData = {
                    ...json.data[0],
                    value: parseInt(json.data[0].value as any)
                };
                this.lastFetch = Date.now();
                return this.lastData;
            }
        } catch (err) {
            logger.warn({ err }, 'Fear & Greed fetch failed');
        }

        return this.lastData;
    }
}

export const alternativeMeAdapter = new AlternativeMeAdapter();
