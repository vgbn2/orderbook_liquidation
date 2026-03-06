import { logger } from '../../logger.js';
import { redis } from '../../db/redis.js';
import { clientHub } from '../../ws/client-hub.js';
import { alternativeMeAdapter, type FearGreedData } from '../../adapters/alternative-me.js';
import { fredAdapter, type FredSnapshot } from '../../adapters/fred.js';
import { marketCapAdapter, type MarketCapSnapshot, type AltcoinIndexSnapshot } from '../../adapters/market-cap.js';
import { computeTASnapshot, type TASnapshot, type OHLCV } from '../analytics/ta.js';
import { binanceAdapter } from '../../adapters/binance.js';

// ══════════════════════════════════════════════════════════════
//  Signal Intelligence Engine
//  Aggregates: Sentiment + Macro + TA + Market Structure
//  Outputs: EdgeFinder Score (-10 to +10) per category & overall
// ══════════════════════════════════════════════════════════════

const CACHE_KEY = 'signal:intelligence';
const CACHE_TTL = 30 * 60; // 30 minutes
const SLOW_INTERVAL = 6 * 60 * 60 * 1000;  // 6 hours (macro/sentiment)
const FAST_INTERVAL = 5 * 60 * 1000;        // 5 minutes (TA)

export interface CategoryScore {
    name: string;
    score: number;  // -10 to +10
    bias: 'bullish' | 'bearish' | 'neutral';
    weight: number; // 0-1
    details: Record<string, any>;
}

export interface IntelligenceSnapshot {
    timestamp: number;
    symbol: string;
    categories: CategoryScore[];
    overallScore: number;    // -10 to +10
    overallBias: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
    riskReward: {
        upsidePotential: number;
        downsidePotential: number;
        ratio: number;
    } | null;
    // Raw data for UI
    fearGreed: FearGreedData | null;
    fred: FredSnapshot | null;
    marketCap: MarketCapSnapshot | null;
    altcoinIndex: AltcoinIndexSnapshot | null;
    ta: TASnapshot | null;
}

function scoreToBias(score: number): CategoryScore['bias'] {
    if (score > 1.5) return 'bullish';
    if (score < -1.5) return 'bearish';
    return 'neutral';
}

function overallBias(score: number): IntelligenceSnapshot['overallBias'] {
    if (score >= 6) return 'strong_buy';
    if (score >= 2) return 'buy';
    if (score <= -6) return 'strong_sell';
    if (score <= -2) return 'sell';
    return 'neutral';
}

class SignalIntelligenceEngine {
    private lastSnapshot: IntelligenceSnapshot | null = null;
    private slowTimer: ReturnType<typeof setInterval> | null = null;
    private fastTimer: ReturnType<typeof setInterval> | null = null;
    private activeSymbol = 'BTCUSDT';

    async start(symbol = 'BTCUSDT') {
        this.activeSymbol = symbol;
        logger.info({ symbol }, 'SignalIntelligenceEngine starting...');

        // Load from Redis first for instant UI
        try {
            const cached = await redis.get(`${CACHE_KEY}:${symbol}`);
            if (cached) {
                this.lastSnapshot = JSON.parse(cached);
                logger.debug('Intelligence: Loaded snapshot from Redis');
            }
        } catch { /* ignore */ }

        // Fetch slow data (sentiment, macro, market cap) on startup
        this.fetchSlowData();

        // Schedule recurring fetches
        this.slowTimer = setInterval(() => this.fetchSlowData(), SLOW_INTERVAL);
        this.fastTimer = setInterval(() => this.computeAndBroadcast(), FAST_INTERVAL);
    }

    stop() {
        if (this.slowTimer) clearInterval(this.slowTimer);
        if (this.fastTimer) clearInterval(this.fastTimer);
    }

    async switchSymbol(newSymbol: string) {
        this.activeSymbol = newSymbol;
        // Re-compute TA with new symbol candles
        await this.computeAndBroadcast();
    }

    getLastSnapshot(): IntelligenceSnapshot | null {
        return this.lastSnapshot;
    }

    // ── Slow Data (6-hour interval) ──────────────────────────

    private async fetchSlowData() {
        logger.debug('Intelligence: Fetching slow data (sentiment + macro)...');

        try {
            await Promise.allSettled([
                alternativeMeAdapter.fetch(),
                fredAdapter.fetch(),
                marketCapAdapter.fetchMarketCaps(),
                marketCapAdapter.fetchAltcoinIndex(),
            ]);
        } catch (err) {
            logger.warn({ err }, 'Intelligence: Error fetching slow data');
        }

        // Compute and broadcast after slow data is ready
        await this.computeAndBroadcast();
    }

    // ── Compute & Broadcast ──────────────────────────────────

    private async computeAndBroadcast() {
        try {
            const fearGreed = alternativeMeAdapter.getLastData();
            const fred = fredAdapter.getLastSnapshot();
            const marketCap = marketCapAdapter.getLastMarketCap();
            const altcoinIndex = marketCapAdapter.getLastAltcoinIndex();

            // Fetch TA from Binance daily candles
            let ta: TASnapshot | null = null;
            try {
                const candles = await binanceAdapter.fetchKlines(this.activeSymbol, '1d', 200);
                if (candles.length >= 100) {
                    // Fetch HTF RSI
                    let weeklyRSI: number | undefined;
                    let monthlyRSI: number | undefined;

                    try {
                        const weeklyCandles = await binanceAdapter.fetchKlines(this.activeSymbol, '1w', 30);
                        if (weeklyCandles.length >= 15) {
                            const { calculateRSI } = await import('../analytics/ta.js');
                            const rsiArr = calculateRSI(weeklyCandles, 14);
                            weeklyRSI = rsiArr[rsiArr.length - 1];
                        }
                    } catch { /* non-critical */ }

                    try {
                        const monthlyCandles = await binanceAdapter.fetchKlines(this.activeSymbol, '1M', 20);
                        if (monthlyCandles.length >= 15) {
                            const { calculateRSI } = await import('../analytics/ta.js');
                            const rsiArr = calculateRSI(monthlyCandles, 14);
                            monthlyRSI = rsiArr[rsiArr.length - 1];
                        }
                    } catch { /* non-critical */ }

                    ta = computeTASnapshot(candles as OHLCV[], weeklyRSI, monthlyRSI);
                }
            } catch (err) {
                logger.debug({ err }, 'Intelligence: TA computation skipped');
            }

            // ── Build Category Scores ────────────────────────

            const categories: CategoryScore[] = [];

            // 1. Sentiment (weight: 0.20)
            let sentimentScore = 0;
            if (fearGreed) sentimentScore += fearGreed.contrarianBias * 5; // -5 to +5
            if (altcoinIndex) {
                // Altcoin season = retail mania = slightly bearish contrarian
                if (altcoinIndex.index > 75) sentimentScore -= 2;
                else if (altcoinIndex.index < 25) sentimentScore += 2;
            }
            sentimentScore = Math.max(-10, Math.min(10, sentimentScore));
            categories.push({
                name: 'Sentiment',
                score: sentimentScore,
                bias: scoreToBias(sentimentScore),
                weight: 0.20,
                details: { fearGreed: fearGreed?.value, altSeason: altcoinIndex?.index },
            });

            // 2. Macro/Economic (weight: 0.25)
            let macroScore = 0;
            if (fred) {
                // Bias-based scoring
                const biasMap = { bullish: 1, neutral: 0, bearish: -1 };
                macroScore = fred.indicators.reduce((s, i) => s + biasMap[i.bias], 0);
                // Normalize to -10 to +10
                macroScore = (macroScore / Math.max(1, fred.indicators.length)) * 10;
                // Real yield penalty: high real yield = bearish for risk assets
                if (fred.realYield > 2) macroScore -= 2;
                else if (fred.realYield < 0) macroScore += 2;
                // Inverted yield curve = recession
                if (fred.yieldSpread < 0) macroScore -= 3;
            }
            macroScore = Math.max(-10, Math.min(10, macroScore));
            categories.push({
                name: 'Macro',
                score: macroScore,
                bias: scoreToBias(macroScore),
                weight: 0.25,
                details: {
                    realYield: fred?.realYield,
                    yieldSpread: fred?.yieldSpread,
                    overallBias: fred?.overallBias,
                },
            });

            // 3. Market Structure (weight: 0.15)
            let structureScore = 0;
            if (marketCap) {
                // BTC dominance context
                if (marketCap.btcDominance > 60) structureScore += 2; // BTC strength
                else if (marketCap.btcDominance < 40) structureScore -= 1; // Fragmented

                // Stablecoin divergence
                if (marketCap.divergenceRatio > 15) structureScore -= 2; // Over-leveraged
                else if (marketCap.divergenceRatio < 8) structureScore += 2; // Strong stablecoin backing
            }
            structureScore = Math.max(-10, Math.min(10, structureScore));
            categories.push({
                name: 'Market Structure',
                score: structureScore,
                bias: scoreToBias(structureScore),
                weight: 0.15,
                details: {
                    btcDom: marketCap?.btcDominance,
                    divRatio: marketCap?.divergenceRatio,
                    stableCap: marketCap?.stablecoinMarketCap,
                },
            });

            // 4. Technical (weight: 0.40)
            let techScore = ta?.score ?? 0;
            // HTF RSI override: cap upside if overbought on Weekly/Monthly
            if (ta?.htfRSI) {
                if (ta.htfRSI.weekly > 80 || ta.htfRSI.monthly > 80) {
                    techScore = Math.min(techScore, 3); // Cap at mildly bullish
                }
                if (ta.htfRSI.weekly < 20 || ta.htfRSI.monthly < 20) {
                    techScore = Math.max(techScore, -3); // Cap at mildly bearish
                }
            }
            techScore = Math.max(-10, Math.min(10, techScore));
            categories.push({
                name: 'Technical',
                score: techScore,
                bias: scoreToBias(techScore),
                weight: 0.40,
                details: {
                    rsi: ta?.rsi,
                    sma: ta?.smaAlignment?.trend,
                    ad: ta?.adTrend,
                    divergence: ta?.divergence?.type,
                    htfRSI: ta?.htfRSI,
                },
            });

            // ── Overall Score (weighted) ──────────────────────
            const overallScore = categories.reduce((s, c) => s + c.score * c.weight, 0);
            const clampedScore = Math.max(-10, Math.min(10, overallScore));

            const snapshot: IntelligenceSnapshot = {
                timestamp: Date.now(),
                symbol: this.activeSymbol,
                categories,
                overallScore: parseFloat(clampedScore.toFixed(1)),
                overallBias: overallBias(clampedScore),
                riskReward: null, // Populated by ConfluenceEngine later
                fearGreed,
                fred,
                marketCap,
                altcoinIndex,
                ta,
            };

            this.lastSnapshot = snapshot;

            // Cache in Redis
            await redis.set(`${CACHE_KEY}:${this.activeSymbol}`, JSON.stringify(snapshot), 'EX', CACHE_TTL);

            // Broadcast to clients
            clientHub.broadcast(`signal.intelligence.${this.activeSymbol}` as any, snapshot);
            // Also broadcast on generic topic for backward compat
            clientHub.broadcast('signal.intelligence' as any, snapshot);

            logger.info({
                symbol: this.activeSymbol,
                score: snapshot.overallScore,
                bias: snapshot.overallBias,
                cats: categories.map(c => `${c.name}:${c.score.toFixed(1)}`).join(', '),
            }, 'Intelligence snapshot computed');

        } catch (err) {
            logger.error({ err }, 'Intelligence: Failed to compute snapshot');
        }
    }
}

export const signalIntelligenceEngine = new SignalIntelligenceEngine();
