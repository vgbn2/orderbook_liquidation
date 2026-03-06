import { logger } from '../logger.js';
import { redis } from '../db/redis.js';
import { config } from '../config.js';

// ══════════════════════════════════════════════════════════════
//  FRED Adapter — Federal Reserve Economic Data
// ══════════════════════════════════════════════════════════════

const BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';
const CACHE_KEY = 'signal:fred';
const CACHE_TTL = 24 * 60 * 60; // 24 hours

// FRED Series IDs
const SERIES = {
    // Growth
    GDP: 'GDP',                    // Gross Domestic Product (Quarterly)
    MFGPMI: 'MANEMP',            // Manufacturing Employment (proxy for PMI)
    RETAIL_SALES: 'RSXFS',        // Advance Retail Sales: Retail (Excluding Food Services)

    // Inflation
    CPI_YOY: 'CPIAUCSL',          // Consumer Price Index for All Urban Consumers
    PPI: 'PPIACO',                 // Producer Price Index
    PCE: 'PCEPI',                  // Personal Consumption Expenditures Price Index

    // Jobs
    NFP: 'PAYEMS',                 // All Employees: Total Nonfarm (Non-Farm Payrolls)
    UNEMPLOYMENT: 'UNRATE',        // Unemployment Rate

    // Yields
    GS10: 'GS10',                  // 10-Year Treasury Constant Maturity Rate
    GS2: 'GS2',                    // 2-Year Treasury Constant Maturity Rate
} as const;

export interface FredIndicator {
    seriesId: string;
    label: string;
    category: 'growth' | 'inflation' | 'jobs' | 'yields';
    value: number;
    date: string;
    previousValue: number;
    change: number;
    bias: 'bullish' | 'bearish' | 'neutral';
}

export interface FredSnapshot {
    timestamp: number;
    indicators: FredIndicator[];
    realYield: number;         // GS10 - CPI YoY
    yieldSpread: number;       // GS10 - GS2 (inverted = recession signal)
    overallBias: 'bullish' | 'bearish' | 'neutral';
}

async function fetchSeries(seriesId: string): Promise<{ value: number; date: string; previousValue: number } | null> {
    const apiKey = config.FRED_API_KEY;
    if (!apiKey) return null;

    try {
        const url = `${BASE_URL}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`FRED ${seriesId}: ${res.status}`);

        const json = await res.json() as { observations: Array<{ date: string; value: string }> };
        const obs = json.observations?.filter(o => o.value !== '.');
        if (!obs || obs.length === 0) return null;

        const current = parseFloat(obs[0].value);
        const previous = obs.length > 1 ? parseFloat(obs[1].value) : current;

        return { value: current, date: obs[0].date, previousValue: previous };
    } catch (err) {
        logger.warn({ err, seriesId }, 'FRED fetch failed for series');
        return null;
    }
}

function determineBias(category: string, change: number): 'bullish' | 'bearish' | 'neutral' {
    const threshold = 0.01; // 1% change threshold
    if (Math.abs(change) < threshold) return 'neutral';

    switch (category) {
        case 'growth':
            return change > 0 ? 'bullish' : 'bearish';
        case 'inflation':
            // Rising inflation = bearish for risk assets
            return change > 0 ? 'bearish' : 'bullish';
        case 'jobs':
            // Low unemployment, high NFP = bullish
            return change > 0 ? 'bullish' : 'bearish';
        case 'yields':
            // Rising yields = bearish for risk assets
            return change > 0 ? 'bearish' : 'bullish';
        default:
            return 'neutral';
    }
}

class FredAdapter {
    private lastSnapshot: FredSnapshot | null = null;

    async fetch(): Promise<FredSnapshot | null> {
        if (!config.FRED_API_KEY) {
            logger.debug('FRED_API_KEY not set — skipping FRED fetch');
            return this.lastSnapshot;
        }

        try {
            // Check Redis cache first
            const cached = await redis.get(CACHE_KEY);
            if (cached) {
                this.lastSnapshot = JSON.parse(cached);
                return this.lastSnapshot;
            }

            const seriesConfig: Array<{ id: string; label: string; category: FredIndicator['category'] }> = [
                { id: SERIES.GDP, label: 'GDP Growth', category: 'growth' },
                { id: SERIES.RETAIL_SALES, label: 'Retail Sales', category: 'growth' },
                { id: SERIES.CPI_YOY, label: 'CPI', category: 'inflation' },
                { id: SERIES.PPI, label: 'PPI', category: 'inflation' },
                { id: SERIES.PCE, label: 'PCE', category: 'inflation' },
                { id: SERIES.NFP, label: 'Non-Farm Payrolls', category: 'jobs' },
                { id: SERIES.UNEMPLOYMENT, label: 'Unemployment Rate', category: 'jobs' },
                { id: SERIES.GS10, label: '10Y Treasury', category: 'yields' },
                { id: SERIES.GS2, label: '2Y Treasury', category: 'yields' },
            ];

            const indicators: FredIndicator[] = [];

            // Fetch with delays to avoid rate limiting (120 requests/min for FRED)
            for (const s of seriesConfig) {
                const data = await fetchSeries(s.id);
                if (data) {
                    const change = data.previousValue !== 0
                        ? (data.value - data.previousValue) / Math.abs(data.previousValue)
                        : 0;

                    indicators.push({
                        seriesId: s.id,
                        label: s.label,
                        category: s.category,
                        value: data.value,
                        date: data.date,
                        previousValue: data.previousValue,
                        change,
                        bias: determineBias(s.category, change),
                    });
                }
                // Small delay between requests
                await new Promise(r => setTimeout(r, 150));
            }

            // Calculate Real Yield
            const gs10 = indicators.find(i => i.seriesId === SERIES.GS10);
            const cpi = indicators.find(i => i.seriesId === SERIES.CPI_YOY);
            const gs2 = indicators.find(i => i.seriesId === SERIES.GS2);

            const realYield = gs10 && cpi ? gs10.value - cpi.value : 0;
            const yieldSpread = gs10 && gs2 ? gs10.value - gs2.value : 0;

            // Overall bias: majority vote
            const biases = indicators.map(i => i.bias);
            const bullish = biases.filter(b => b === 'bullish').length;
            const bearish = biases.filter(b => b === 'bearish').length;
            const overallBias = bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral';

            const snapshot: FredSnapshot = {
                timestamp: Date.now(),
                indicators,
                realYield,
                yieldSpread,
                overallBias,
            };

            this.lastSnapshot = snapshot;
            await redis.set(CACHE_KEY, JSON.stringify(snapshot), 'EX', CACHE_TTL);
            logger.info({ indicators: indicators.length, realYield: realYield.toFixed(2), bias: overallBias }, 'FRED data fetched');
            return snapshot;
        } catch (err) {
            logger.warn({ err }, 'Failed to fetch FRED data — using last known value');
            return this.lastSnapshot;
        }
    }

    getLastSnapshot(): FredSnapshot | null {
        return this.lastSnapshot;
    }
}

export const fredAdapter = new FredAdapter();
