import { logger } from '../logger.js';
import axios from 'axios';

// ── Mapping Finnhub Event Names to FRED IDs ──────────────────

const FINNHUB_TO_FRED: Record<string, string> = {
    'Initial Jobless Claims': 'ICSA',
    'Non Farm Payrolls': 'PAYEMS',
    'Unemployment Rate': 'UNRATE',
    'CPI MoM': 'CPIAUCSL', // Headline for reference
    'CPI YoY': 'CPIAUCSL',
    'Core CPI MoM': 'CPILFESL',
    'Core CPI YoY': 'CPILFESL',
    'PPI Final Demand MoM': 'PPIACO',
    'GDP Annualized QoQ': 'GDPC1',
    'ISM Manufacturing PMI': 'NAPM',
    'ISM Services PMI': 'NMI',
    'JOLTs Job Openings': 'JTSJOL',
    'ADP Employment Change': 'ADPMAN',
    'Retail Sales': 'RSAFS',
    'GDP': 'GDPC1', // Duplicate, but keeping as per snippet's new entry
    'Consumer Price Index (CPI) YoY': 'CPILFESL', // Duplicate, but keeping as per snippet's new entry
    'Producer Price Index (PPI) YoY': 'PPIACO', // Duplicate, but keeping as per snippet's new entry
    'Michigan Consumer Sentiment': 'UMCSENT',
};

export interface FinnhubForecast {
    seriesId: string;
    event: string;
    actual: number | null;
    estimate: number | null;
    previous: number | null;
    date: string;
    unit: string;
}

class FinnhubAdapter {
    private apiKey = process.env.FINNHUB_API_KEY;
    private cache: Map<string, FinnhubForecast> = new Map();
    private lastFetch = 0;
    private throttledUntil = 0;

    async fetchForecasts(): Promise<Map<string, FinnhubForecast>> {
        if (!this.apiKey) return new Map();

        const now = Date.now();

        // 1. Check Cooldown (Rate Limit Protection)
        if (now < this.throttledUntil) {
            return this.cache;
        }

        // 2. Check Cache (1 hour)
        if (now - this.lastFetch < 3600000 && this.cache.size > 0) {
            return this.cache;
        }

        try {
            const startDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const endDate = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const url = `https://finnhub.io/api/v1/economic-calendar?from=${startDate}&to=${endDate}&token=${this.apiKey}`;
            const res = await axios.get(url);

            if (res.data) {
                const results = new Map<string, FinnhubForecast>();

                res.data.forEach((item: any) => {
                    if (item.country !== 'US') return;

                    const fredId = FINNHUB_TO_FRED[item.event];
                    if (fredId) {
                        const forecast: FinnhubForecast = {
                            seriesId: fredId,
                            event: item.event,
                            actual: item.actual,
                            estimate: item.estimate,
                            previous: item.prev,
                            date: item.time,
                            unit: item.unit
                        };

                        if (!results.has(fredId) || (forecast.actual !== null && results.get(fredId)?.actual === null)) {
                            results.set(fredId, forecast);
                        }
                    }
                });

                this.cache = results;
                this.lastFetch = now;
                return results;
            }
        } catch (err: any) {
            if (err.response?.status === 429) {
                logger.warn({ retryAfter: 300 }, 'Finnhub Rate Limit Hit — Cooldown active for 5m');
                this.throttledUntil = now + 5 * 60 * 1000;
            } else {
                logger.error({ err: err.message }, 'Finnhub fetch error');
            }
        }

        return this.cache;
    }


    getForecast(seriesId: string): FinnhubForecast | null {
        return this.cache.get(seriesId) || null;
    }
}

export const finnhubAdapter = new FinnhubAdapter();
