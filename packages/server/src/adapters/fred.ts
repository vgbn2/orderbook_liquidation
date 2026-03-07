import { logger } from '../logger.js';
import { redis } from '../db/redis.js';
import { config } from '../config.js';
import { finnhubAdapter } from './finnhub.js';

// ══════════════════════════════════════════════════════════════
//  FRED Adapter — Federal Reserve Economic Data
// ══════════════════════════════════════════════════════════════

const BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';
const CACHE_KEY = 'signal:fred';
const FAST_CACHE_KEY = 'signal:fred:fast'; // Weekly/Daily data
const SLOW_CACHE_KEY = 'signal:fred:slow'; // Monthly/Quarterly data

const FAST_TTL = 12 * 60 * 60; // 12 hours
const SLOW_TTL = 48 * 60 * 60; // 48 hours

// FRED Series IDs
export const FRED_SERIES_MAP = {
    // Labor
    NFP: 'PAYEMS',                 // Non-Farm Payrolls (monthly)
    ADP: 'ADPMNUSNERSA',           // private private payrolls
    UNEMPLOYMENT: 'UNRATE',        // Unemployment Rate
    JOBLESS_CLAIMS: 'ICSA',        // Initial Jobless Claims (weekly)
    JOLTS: 'JTSJOL',               // Job Openings (monthly)

    // Inflation
    CORE_CPI: 'CPILFESL',          // Consumer Price Index (Ex Food/Energy)
    PPI: 'PPIIDC',                 // Producer Price Index

    // Growth
    GDP: 'A191RP1Q027SBEA',        // Real GDP Growth (QoQ)
    MFG_PMI: 'NAPM',               // ISM Manufacturing PMI
    SERVICES_PMI: 'NMFCI',         // ISM Services PMI
    UMich: 'UMCSENT',              // UMich Consumer Sentiment
    RETAIL_SALES: 'RSXFS',         // Advance Retail Sales

    // Yields / Credit
    GS10: 'GS10',                  // 10-Year Treasury
    GS2: 'DGS2',                   // 2-Year Treasury
    REAL_YIELD: 'DFII10',          // 10Y TIPS Real Yield
    CREDIT_SPREAD: 'BAMLC0A0CM',   // ICE BofA US Corp OAS
} as const;

export interface FredIndicator {
    seriesId: string;
    label: string;
    category: 'growth' | 'inflation' | 'jobs' | 'yields' | 'credit';
    value: number;
    date: string;
    previousValue: number;
    change: number;
    bias: 'bullish' | 'bearish' | 'neutral';
    forecast: number | null;
    surprise: number | null;
    surpriseScore: number | null;
    surpriseGrade: 'Massive Beat' | 'Minor Beat' | 'In-line' | 'Minor Miss' | 'Massive Miss' | null;
}

export interface FredSnapshot {
    timestamp: number;
    indicators: FredIndicator[];
    realYield: number;
    yieldSpread: number;
    creditSpread: number;
    overallBias: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
    overallScore: number;
    macroSurpriseScore: number | null;
}

// Track global FRED throttle state
let fredThrottledUntil = 0;

async function fetchSeries(seriesId: string, units?: string): Promise<{ value: number; date: string; previousValue: number } | null> {
    const apiKey = config.FRED_API_KEY;
    if (!apiKey) return null;

    // Abort if we're in a throttle window
    if (Date.now() < fredThrottledUntil) return null;

    try {
        let url = `${BASE_URL}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`;
        if (units) url += `&units=${units}`;

        const res = await fetch(url);

        if (res.status === 429) {
            logger.warn('FRED 429 Rate Limit — cooldown 30m');
            fredThrottledUntil = Date.now() + 30 * 60 * 1000;
            return null;
        }

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

function determineBias(seriesId: string, category: string, value: number, change: number): 'bullish' | 'bearish' | 'neutral' {
    const threshold = 0.01; // 1% change threshold (default)
    const tightThreshold = 0.005; // 0.5% for claims

    // PMI series need absolute-value logic, not change-based
    if (seriesId === FRED_SERIES_MAP.MFG_PMI || seriesId === FRED_SERIES_MAP.SERVICES_PMI) {
        if (value > 52) return 'bullish';
        if (value < 48) return 'bearish';
        return 'neutral';
    }

    // Jobless Claims: rising = bearish
    if (seriesId === FRED_SERIES_MAP.JOBLESS_CLAIMS) {
        if (change > tightThreshold) return 'bearish';
        if (change < -tightThreshold) return 'bullish';
        return 'neutral';
    }

    // Unemployment: rising = bearish
    if (category === 'jobs' && seriesId === FRED_SERIES_MAP.UNEMPLOYMENT) {
        if (change > tightThreshold) return 'bearish';
        if (change < -tightThreshold) return 'bullish';
        return 'neutral';
    }

    switch (category) {
        case 'growth':
            return change > threshold ? 'bullish' : change < -threshold ? 'bearish' : 'neutral';
        case 'inflation':
            // Rising inflation = bearish for risk assets
            return change > threshold ? 'bearish' : change < -threshold ? 'bullish' : 'neutral';
        case 'jobs':
            // High NFP/ADP/JOLTS = bullish
            return change > threshold ? 'bullish' : change < -threshold ? 'bearish' : 'neutral';
        case 'yields':
            // Rising yields = bearish
            return change > threshold ? 'bearish' : change < -threshold ? 'bullish' : 'neutral';
        case 'credit':
            // Widening credit spreads = bearish
            return change > threshold ? 'bearish' : change < -threshold ? 'bullish' : 'neutral';
        default:
            return 'neutral';
    }
}

// ── Surprise Meter Logic ─────────────────────────────────────

function computeSurprise(seriesId: string, actual: number, forecast: number): { surprise: number; score: number; grade: FredIndicator['surpriseGrade'] } {
    const rawDiff = actual - forecast;

    // For most indicators, (actual - forecast) / forecast
    // For unemployment/claims, positive rawDiff is BAD (bearish)
    const isInverse = [FRED_SERIES_MAP.UNEMPLOYMENT, FRED_SERIES_MAP.JOBLESS_CLAIMS].includes(seriesId as any);

    let surprise = forecast !== 0 ? (rawDiff / Math.abs(forecast)) : 0;

    // Specialized PMI handling (50.0 threshold is key)
    let scoreMultiplier = 1.0;
    if (seriesId === FRED_SERIES_MAP.MFG_PMI || seriesId === FRED_SERIES_MAP.SERVICES_PMI) {
        // Did we cross 50.0?
        if ((actual >= 50 && forecast < 50) || (actual < 50 && forecast >= 50)) {
            scoreMultiplier = 1.5; // High impact cross
        }
    }

    // Normalise to -10 to +10
    // Generally, a 1% surprise in NFP is much larger than a 1% surprise in GDP
    // We'll use heuristic scaling
    let score = surprise * 100 * scoreMultiplier;
    if (isInverse) score = -score;

    // Cap at 10
    score = Math.max(-10, Math.min(10, score));

    // Grading
    let grade: FredIndicator['surpriseGrade'] = 'In-line';
    if (score > 4) grade = 'Massive Beat';
    else if (score > 1.5) grade = 'Minor Beat';
    else if (score < -4) grade = 'Massive Miss';
    else if (score < -1.5) grade = 'Minor Miss';

    return { surprise, score, grade };
}

class FredAdapter {
    private lastSnapshot: FredSnapshot | null = null;

    async fetch(): Promise<FredSnapshot | null> {
        if (!config.FRED_API_KEY) {
            logger.debug('FRED_API_KEY not set — skipping FRED fetch');
            return this.lastSnapshot;
        }

        // Global throttle check
        if (Date.now() < fredThrottledUntil) {
            logger.debug('FRED fetch skipped — throttle active');
            return this.lastSnapshot;
        }

        try {
            // Check Redis cache
            const cached = await redis.get(CACHE_KEY);
            if (cached) {
                this.lastSnapshot = JSON.parse(cached);
                return this.lastSnapshot;
            }

            const seriesConfig: Array<{ id: string; label: string; category: FredIndicator['category']; units?: string }> = [
                { id: FRED_SERIES_MAP.NFP, label: 'Non-Farm Payrolls', category: 'jobs' },
                { id: FRED_SERIES_MAP.ADP, label: 'ADP Employment', category: 'jobs' },
                { id: FRED_SERIES_MAP.UNEMPLOYMENT, label: 'Unemployment Rate', category: 'jobs' },
                { id: FRED_SERIES_MAP.JOBLESS_CLAIMS, label: 'Jobless Claims (Wkly)', category: 'jobs' },
                { id: FRED_SERIES_MAP.JOLTS, label: 'Job Openings (JOLTS)', category: 'jobs' },
                { id: FRED_SERIES_MAP.CORE_CPI, label: 'Core CPI', category: 'inflation', units: 'pc1' },
                { id: FRED_SERIES_MAP.PPI, label: 'PPI Final Demand', category: 'inflation', units: 'pc1' },
                { id: FRED_SERIES_MAP.GDP, label: 'GDP Growth Rate', category: 'growth' },
                { id: FRED_SERIES_MAP.MFG_PMI, label: 'ISM Mfg PMI', category: 'growth' },
                { id: FRED_SERIES_MAP.SERVICES_PMI, label: 'ISM Services PMI', category: 'growth' },
                { id: FRED_SERIES_MAP.UMich, label: 'UMich Sentiment', category: 'growth' },
                { id: FRED_SERIES_MAP.RETAIL_SALES, label: 'Retail Sales', category: 'growth' },
                { id: FRED_SERIES_MAP.GS10, label: '10Y Treasury', category: 'yields' },
                { id: FRED_SERIES_MAP.GS2, label: '2Y Treasury', category: 'yields' },
                { id: FRED_SERIES_MAP.REAL_YIELD, label: '10Y Real Yield (TIPS)', category: 'yields' },
                { id: FRED_SERIES_MAP.CREDIT_SPREAD, label: 'IG Credit Spread', category: 'credit' },
            ];

            // Fetch Forecasts from Finnhub
            const forecasts = await finnhubAdapter.fetchForecasts();

            const indicators: FredIndicator[] = [];

            // Parallel batch fetch (3 at a time) to stay under rate limit but improve speed
            const batchSize = 3;
            for (let i = 0; i < seriesConfig.length; i += batchSize) {
                const batch = seriesConfig.slice(i, i + batchSize);
                const results = await Promise.all(batch.map(s => fetchSeries(s.id, (s as any).units)));

                results.forEach((data, idx) => {
                    const s = batch[idx];
                    if (data) {
                        const change = data.previousValue !== 0
                            ? (data.value - data.previousValue) / Math.abs(data.previousValue)
                            : 0;

                        const fcst = forecasts.get(s.id);
                        let surpriseInfo: { surprise: number | null; score: number | null; grade: FredIndicator['surpriseGrade'] } = {
                            surprise: null, score: null, grade: null
                        };

                        if (fcst && fcst.estimate !== null) {
                            surpriseInfo = computeSurprise(s.id, data.value, fcst.estimate);
                        }

                        indicators.push({
                            seriesId: s.id,
                            label: s.label,
                            category: s.category,
                            value: data.value,
                            date: data.date,
                            previousValue: data.previousValue,
                            change,
                            bias: determineBias(s.id, s.category, data.value, change),
                            forecast: fcst?.estimate ?? null,
                            surprise: surpriseInfo.surprise,
                            surpriseScore: surpriseInfo.score,
                            surpriseGrade: surpriseInfo.grade
                        });
                    }
                });

                // Buffer between batches
                await new Promise(r => setTimeout(r, 450));
            }

            // Calculate Metrics
            const realYieldInd = indicators.find(i => i.seriesId === FRED_SERIES_MAP.REAL_YIELD);
            const gs10 = indicators.find(i => i.seriesId === FRED_SERIES_MAP.GS10);
            const gs2 = indicators.find(i => i.seriesId === FRED_SERIES_MAP.GS2);
            const coreCpi = indicators.find(i => i.seriesId === FRED_SERIES_MAP.CORE_CPI);
            const creditSpreadInd = indicators.find(i => i.seriesId === FRED_SERIES_MAP.CREDIT_SPREAD);

            const realYield = realYieldInd?.value ?? (gs10 && coreCpi ? gs10.value - coreCpi.value : 0);
            const yieldSpread = gs10 && gs2 ? gs10.value - gs2.value : 0;
            const creditSpread = creditSpreadInd?.value ?? 0;

            // ── Overall Scoring — Combining Regime + Surprise ────────────────

            // 1. Regime Score (-10 to +10)
            const regimeScore = indicators.reduce((acc, ind) => {
                const val = ind.bias === 'bullish' ? 1 : ind.bias === 'bearish' ? -1 : 0;
                return acc + val;
            }, 0) / indicators.length * 10;

            // 2. Average Surprise Score
            const surpriseIndicators = indicators.filter(i => i.surpriseScore !== null);
            const macroSurpriseScore = surpriseIndicators.length > 0
                ? surpriseIndicators.reduce((acc, i) => acc + (i.surpriseScore ?? 0), 0) / surpriseIndicators.length
                : 0;

            // 3. Blended Overall Score
            // Weight: 70% Regime (Long term) | 30% Surprise (Short term momentum)
            const overallScore = (regimeScore * 0.7) + (macroSurpriseScore * 0.3);

            // Map score to bias
            let overallBias: FredSnapshot['overallBias'] = 'neutral';
            if (overallScore > 6) overallBias = 'strong_buy';
            else if (overallScore > 2) overallBias = 'buy';
            else if (overallScore < -6) overallBias = 'strong_sell';
            else if (overallScore < -2) overallBias = 'sell';

            const snapshot: FredSnapshot = {
                timestamp: Date.now(),
                indicators,
                realYield: parseFloat(realYield.toFixed(2)),
                yieldSpread: parseFloat(yieldSpread.toFixed(2)),
                creditSpread: parseFloat(creditSpread.toFixed(1)),
                overallBias,
                overallScore: parseFloat(overallScore.toFixed(2)),
                macroSurpriseScore: parseFloat(macroSurpriseScore.toFixed(2)),
            };

            this.lastSnapshot = snapshot;

            // Tiered caching
            await redis.set(CACHE_KEY, JSON.stringify(snapshot), 'EX', 24 * 60 * 60); // Default wrapper

            logger.info({
                metrics: indicators.length,
                realYield: snapshot.realYield,
                credit: snapshot.creditSpread,
                bias: overallBias
            }, 'Super Macro FRED data fetched');

            return snapshot;
        } catch (err) {
            logger.warn({ err }, 'Failed to fetch FRED data — using fallback');
            return this.lastSnapshot;
        }
    }

    getLastSnapshot(): FredSnapshot | null {
        return this.lastSnapshot;
    }
}

export const fredAdapter = new FredAdapter();
