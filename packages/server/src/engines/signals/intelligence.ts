import { EventEmitter } from 'events';
import { logger } from '../../logger.js';
import { redis } from '../../db/redis.js';
import { marketState } from '../market/state.js';
import { clientHub } from '../../ws/client-hub.js';
import { fredAdapter } from '../../adapters/fred.js';
import { finnhubAdapter } from '../../adapters/finnhub.js';
import { gdeltAdapter } from '../../adapters/gdelt.js';
import { geminiAdapter } from '../../adapters/gemini.js';
// sentimentAdapter, etc.

export interface GeopoliticalEvent {
    title: string;
    url: string;
    source: string;
    date: string;
    riskTheme: 'CONFLICT' | 'SANCTIONS' | 'NUCLEAR' | 'ELECTION' | 'TERRORISM' | 'COUP' | 'MILITARY' | 'PROTEST' | 'GEOPOLITICAL';
}

export interface IntelligenceSnapshot {
    timestamp: number;
    overallScore: number;
    overallBias: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
    macroSurpriseScore: number;
    dataAge: {
        macroUpdatedAt: number | null;
        geoUpdatedAt: number | null;
        taUpdatedAt: number | null;
    };
    fearGreed: {
        value: number; // 0-100
        classification: string;
    };
    geopolitics: {
        riskScore: number; // 0-10
        summary: string;
        hotZones: string[];
        events: GeopoliticalEvent[];
    };
    ta: {
        rsi: number;
        smaAlignment: { trend: string } | null;
        adTrend: string;
        marketStructure: string;
        divergence: { type: string } | null;
    };
    categories: {
        name: string;
        score: number;
        weight: number;
        bias: string;
        details: any;
    }[];
    aiSummary: string;
    fred?: any;
}

const REDIS_SNAPSHOT_KEY = (symbol: string) => `signal:intelligence:${symbol}`;
const REDIS_GEO_CACHE_KEY = 'signal:gdelt:full';
const GEO_CACHE_TTL = 2 * 60 * 60; // 2 hours
const COMPUTE_INTERVAL_MS = 60 * 1000; // 60 seconds
const MACRO_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const GEO_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000;
const STARTUP_FALLBACK_DELAY_MS = 30 * 1000;
const MIN_BROADCAST_INTERVAL_MS = 15 * 1000;

class SignalIntelligenceEngine extends EventEmitter {
    private isRunning = false;
    private computeInterval: NodeJS.Timeout | null = null;
    private activeSymbol = 'BTCUSDT';
    private lastBroadcastAt = 0;

    // Macro state
    private lastMacroScore = 0;
    private lastRealYield = 0;
    private lastCreditSpread = 0;
    private lastFredSnapshot: any | null = null;
    private lastMacroUpdate = 0;
    private macroReady = false;

    // Geo state
    private lastGeoScore = 0;
    private lastGeoSummary = 'Awaiting geopolitical analysis...';
    private lastGeoHotZones: string[] = [];
    private lastGeoEvents: GeopoliticalEvent[] = [];
    private lastGeoUpdate = 0;
    private geoReady = false;

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        // STEP 0: Load last Redis snapshot immediately
        try {
            const cached = await redis.get(REDIS_SNAPSHOT_KEY(this.activeSymbol));
            if (cached) {
                const snapshot = JSON.parse(cached);
                clientHub.broadcast(`signal.intelligence.${this.activeSymbol}` as any, snapshot);
                logger.info('Intelligence: served cached snapshot on startup');
            }
        } catch (err) {
            // Non-fatal, might be first boot
        }

        // STEP 1: Fire both fetches independently
        this.fetchMacroData();
        this.fetchGeoData();

        // STEP 2: Fallback broadcast after 30 seconds
        setTimeout(() => {
            if (!this.macroReady && !this.geoReady) {
                logger.warn('Intelligence: slow data timeout — broadcasting with defaults');
            }
            this.computeAndBroadcast();
        }, STARTUP_FALLBACK_DELAY_MS);

        // STEP 3: Start regular compute loop
        this.computeInterval = setInterval(() => {
            this.computeAndBroadcast();
        }, COMPUTE_INTERVAL_MS);

        // STEP 4: Periodic slow data refreshes
        setInterval(() => this.fetchMacroData(), MACRO_REFRESH_INTERVAL_MS);
        setInterval(() => this.fetchGeoData(), GEO_REFRESH_INTERVAL_MS);

        logger.info('Signal Intelligence Engine started');
    }

    stop() {
        this.isRunning = false;
        if (this.computeInterval) clearInterval(this.computeInterval);
        logger.info('Signal Intelligence Engine stopped');
    }

    async switchSymbol(newSymbol: string) {
        if (newSymbol === this.activeSymbol) return;

        this.activeSymbol = newSymbol;
        logger.info(`Intelligence: switched to ${newSymbol}`);

        // Broadcast immediately with new symbol and existing global data
        this.computeAndBroadcast();

        try {
            const cached = await redis.get(REDIS_SNAPSHOT_KEY(newSymbol));
            if (cached) {
                clientHub.broadcast(`signal.intelligence.${newSymbol}` as any, JSON.parse(cached));
            }
        } catch (err) {
            // ignore
        }
    }

    private async fetchMacroData() {
        try {
            const fredSnapshot = await fredAdapter.fetch();

            if (fredSnapshot) {
                this.lastFredSnapshot = fredSnapshot;
                this.lastMacroScore = fredSnapshot.overallScore;
                this.lastRealYield = fredSnapshot.realYield;
                this.lastCreditSpread = fredSnapshot.creditSpread;
                this.lastMacroUpdate = Date.now();
                this.macroReady = true;
                logger.info('Intelligence: macro data updated');

                if (this.geoReady) {
                    this.computeAndBroadcast();
                }
            }
        } catch (err) {
            logger.warn({ err }, 'Intelligence: macro fetch failed (non-fatal)');
        }
    }

    private async fetchGeoData() {
        try {
            const cachedGeo = await redis.get(REDIS_GEO_CACHE_KEY);

            if (cachedGeo) {
                const geoCache = JSON.parse(cachedGeo);
                this.applyGeoAnalysis(geoCache.analysis, geoCache.news);
                this.geoReady = true;
                logger.info('Intelligence: geo data restored from Redis cache');

                if (this.macroReady) {
                    this.computeAndBroadcast();
                }
                return;
            }

            const news = await gdeltAdapter.fetchGlobalRiskNews();

            if (news.length === 0) {
                logger.warn('GDELT returned no articles — using default geo state');
                this.geoReady = true;
                if (this.macroReady) this.computeAndBroadcast();
                return;
            }

            const analysis = await geminiAdapter.analyzeGeopolitics(news);

            if (analysis) {
                this.applyGeoAnalysis(analysis, news);
                this.geoReady = true;
                this.lastGeoUpdate = Date.now();

                await redis.set(REDIS_GEO_CACHE_KEY, JSON.stringify({
                    analysis,
                    news,
                    savedAt: Date.now()
                }), 'EX', GEO_CACHE_TTL);

                logger.info({ riskScore: analysis.riskScore }, 'Intelligence: geo data updated');

                if (this.macroReady) {
                    this.computeAndBroadcast();
                }
            }
        } catch (err: any) {
            if (err.status === 429) {
                logger.warn('Intelligence: GDELT 429 — using cached/default geo state');
            } else {
                logger.warn({ err }, 'Intelligence: geo fetch failed (non-fatal)');
            }
            this.geoReady = true;
            if (this.macroReady) this.computeAndBroadcast();
        }
    }

    private applyGeoAnalysis(analysis: any, news: any[]) {
        let impact = -(analysis.riskScore);
        if (analysis.bias === 'bullish') {
            impact = Math.abs(impact * 0.5);
        }

        this.lastGeoScore = impact;
        this.lastGeoSummary = analysis.summary;
        this.lastGeoHotZones = analysis.hotZones || [];

        this.lastGeoEvents = news.slice(0, 10).map((article: any) => ({
            title: article.title,
            url: article.url,
            source: article.source,
            date: article.date,
            riskTheme: this.detectRiskTheme(article.title)
        }));
    }

    private detectRiskTheme(title: string): GeopoliticalEvent['riskTheme'] {
        const titleUpper = title.toUpperCase();
        if (titleUpper.includes('SANCTION')) return 'SANCTIONS';
        if (titleUpper.includes('NUCLEAR')) return 'NUCLEAR';
        if (titleUpper.includes('WAR') || titleUpper.includes('CONFLICT')) return 'CONFLICT';
        if (titleUpper.includes('ELECTION')) return 'ELECTION';
        if (titleUpper.includes('TERROR')) return 'TERRORISM';
        if (titleUpper.includes('COUP')) return 'COUP';
        if (titleUpper.includes('MILITARY')) return 'MILITARY';
        if (titleUpper.includes('PROTEST')) return 'PROTEST';
        return 'GEOPOLITICAL';
    }

    private async computeAndBroadcast() {
        if (!this.isRunning) return;

        const now = Date.now();
        if (now - this.lastBroadcastAt < MIN_BROADCAST_INTERVAL_MS) return;
        this.lastBroadcastAt = now;

        const ob = marketState.orderbook;
        const ta = marketState.technicals;
        const liq = marketState.liquidations;

        // -- Technical Score --
        let techScore = 0;
        if (ta) {
            if (ta.trend.weekly === 'bullish') techScore += 4;
            if (ta.trend.weekly === 'bearish') techScore -= 4;
            if (ta.trend.daily === 'bullish') techScore += 3;
            if (ta.trend.daily === 'bearish') techScore -= 3;
            if (ta.htfRSI.weekly > 80 || ta.htfRSI.monthly > 80) {
                techScore = Math.min(techScore, 3);
            } else if (ta.htfRSI.weekly < 20 || ta.htfRSI.monthly < 20) {
                techScore = Math.max(techScore, -3);
            }
        }

        // -- Sentiment Score --
        let sentScore = 0;
        if (ob) {
            const bidAskRatio = ob.totalBids / (ob.totalAsks || 1);
            if (bidAskRatio > 1.5) sentScore += 3;
            if (bidAskRatio < 0.6) sentScore -= 3;
        }
        if (liq) {
            if (liq.longsVsshortsRatio > 2) sentScore -= 2;
            if (liq.longsVsshortsRatio < 0.5) sentScore += 2;
        }

        // -- Macro Score --
        let macroScore = this.lastMacroScore;
        if (this.lastRealYield > 2.0) macroScore -= 2;
        if (this.lastRealYield < 0.5) macroScore += 2;

        // -- Geo Score --
        let geoScore = this.lastGeoScore;

        // -- Blend Score --
        const blended = (techScore * 0.4) + (macroScore * 0.3) + (sentScore * 0.2) + (geoScore * 0.1);
        const finalScore = Math.max(-10, Math.min(10, blended));

        let finalBias: IntelligenceSnapshot['overallBias'] = 'neutral';
        if (finalScore >= 5) finalBias = 'strong_buy';
        else if (finalScore >= 1.5) finalBias = 'buy';
        else if (finalScore <= -5) finalBias = 'strong_sell';
        else if (finalScore <= -1.5) finalBias = 'sell';

        const getBias = (s: number) => {
            if (s >= 5) return 'strong_bullish';
            if (s >= 1.5) return 'bullish';
            if (s <= -5) return 'strong_bearish';
            if (s <= -1.5) return 'bearish';
            return 'neutral';
        };

        const snapshot: IntelligenceSnapshot = {
            timestamp: now,
            overallScore: parseFloat(finalScore.toFixed(2)),
            overallBias: finalBias,
            macroSurpriseScore: this.lastFredSnapshot?.macroSurpriseScore ?? 0,
            dataAge: {
                macroUpdatedAt: this.lastMacroUpdate || null,
                geoUpdatedAt: this.lastGeoUpdate || null,
                taUpdatedAt: ta ? Date.now() : null
            },
            fearGreed: {
                value: Math.round(50 + (sentScore * 5)),
                classification: sentScore > 2 ? 'GREED' : sentScore < -2 ? 'FEAR' : 'NEUTRAL'
            },
            geopolitics: {
                riskScore: Math.abs(geoScore),
                summary: this.lastGeoSummary,
                hotZones: this.lastGeoHotZones,
                events: this.lastGeoEvents
            },
            ta: ta ? {
                rsi: ta.rsi,
                smaAlignment: ta.smaAlignment ? { trend: ta.smaAlignment.trend } : null,
                adTrend: ta.adTrend,
                marketStructure: ta.smaAlignment?.trend || 'neutral',
                divergence: ta.divergence ? { type: ta.divergence.type } : null
            } : {
                rsi: 0 as any, // fallback for UI without crashing
                smaAlignment: null,
                adTrend: 'neutral',
                marketStructure: 'neutral',
                divergence: null
            },
            categories: [
                {
                    name: 'Technical',
                    score: parseFloat(techScore.toFixed(2)),
                    weight: 40,
                    bias: getBias(techScore),
                    details: {
                        rsi: ta ? ta.rsi : null,
                        htfRsi: ta ? ta.htfRSI.weekly : null,
                        smaAlignment: ta?.smaAlignment?.trend || 'neutral'
                    }
                },
                {
                    name: 'Macro',
                    score: parseFloat(macroScore.toFixed(2)),
                    weight: 30,
                    bias: getBias(macroScore),
                    details: {
                        indicators: this.lastFredSnapshot?.indicators || [],
                        realYield: this.lastRealYield,
                        yieldSpread: (this.lastFredSnapshot?.yieldSpread) || 0,
                        creditSpread: this.lastCreditSpread
                    }
                },
                {
                    name: 'Sentiment',
                    score: parseFloat(sentScore.toFixed(2)),
                    weight: 20,
                    bias: getBias(sentScore),
                    details: {
                        fearGreedValue: 50 + (sentScore * 5),
                        fearGreedHeading: sentScore > 2 ? 'Greed' : sentScore < -2 ? 'Fear' : 'Neutral',
                        altcoinSeasonIndex: 50
                    }
                },
                {
                    name: 'Geopolitics',
                    score: parseFloat(geoScore.toFixed(2)),
                    weight: 10,
                    bias: getBias(geoScore),
                    details: {
                        riskScore: Math.abs(geoScore),
                        summary: this.lastGeoSummary
                    }
                }
            ],
            aiSummary: this.generateAiSummary(finalBias, techScore, macroScore, geoScore),
            fred: this.lastFredSnapshot
        };

        await redis.set(REDIS_SNAPSHOT_KEY(this.activeSymbol), JSON.stringify(snapshot), 'EX', 10 * 60)
            .catch(err => logger.warn({ err }, 'Failed to cache intelligence snapshot'));

        clientHub.broadcast(`signal.intelligence.${this.activeSymbol}` as any, snapshot);
    }

    private generateAiSummary(bias: string, tech: number, macro: number, geo: number): string {
        const parts = [];
        if (tech > 3) parts.push("Strong technical uptrend supports asset prices.");
        else if (tech < -3) parts.push("Technical structure remains broken, favoring bears.");

        if (macro > 2) parts.push("Macroeconomic environment is accommodative.");
        else if (macro < -2) parts.push("Macro headwinds (yields/inflation) suppressing risk appetite.");

        if (geo < -7) parts.push("Extreme geopolitical risk — markets in defensive posture.");
        else if (geo < -5) parts.push("Elevated geopolitical risk contributing to risk-off sentiment.");
        else if (geo < -3) parts.push("Mild geopolitical tension; monitoring for escalation.");

        if (parts.length === 0) return "Market forces are balanced; awaiting clear directional catalyst.";
        return parts.join(' ');
    }
}

export const signalIntelligenceEngine = new SignalIntelligenceEngine();

