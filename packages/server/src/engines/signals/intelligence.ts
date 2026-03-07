import { EventEmitter } from 'events';
import { logger } from '../../logger.js';
import { marketState } from '../market/state.js';
import { clientHub } from '../../ws/client-hub.js';
import { fredAdapter } from '../../adapters/fred.js';
import { finnhubAdapter } from '../../adapters/finnhub.js';
import { gdeltAdapter } from '../../adapters/gdelt.js';
import { geminiAdapter } from '../../adapters/gemini.js';
// sentimentAdapter, etc.

export interface IntelligenceSnapshot {
    timestamp: number;
    overallScore: number;
    overallBias: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
    macroSurpriseScore: number;
    fearGreed: {
        value: number; // 0-100
        classification: string;
    };
    geopolitics: {
        riskScore: number; // 0-10
        summary: string;
        hotZones: string[];
    };
    ta: {
        rsi: number;
        smaAlignment: { trend: string } | null;
        adTrend: string;
        marketStructure: string;
        divergence: { type: string } | null;
    };
    categories: { name: string; score: number }[];
    aiSummary: string;
    fred?: any;
}

class SignalIntelligenceEngine extends EventEmitter {
    private isRunning = false;
    private computeInterval: NodeJS.Timeout | null = null;
    private activeSymbol = 'BTCUSDT'; // Default to king crypto for general market intelligence

    // Trackers for asynchronous slow data
    private lastMacroScore = 0;
    private lastRealYield = 0;
    private lastCreditSpread = 0;

    private lastGeoScore = 0;
    private lastGeoRiskLevel: 'low' | 'elevated' | 'high' | 'extreme' = 'low';
    private lastGeoSummary = 'No significant geopolitical risks detected.';
    private lastFredSnapshot: any | null = null;

    private lastMacroUpdate = 0;
    private lastGeoUpdate = 0;


    async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        // Fetch slow data immediately
        await this.fetchSlowData();

        // Compute blended snapshot every 5 minutes
        this.computeInterval = setInterval(() => {
            this.computeAndBroadcast();
        }, 5 * 60 * 1000);

        // Slow data updates (FRED is daily/monthly mostly, GDELT varies)
        // Refresh macro every 12 hours, geopolitics every 2 hours
        setInterval(() => this.fetchSlowData(), 2 * 60 * 60 * 1000);

        logger.info('Signal Intelligence Engine started');
    }

    stop() {
        this.isRunning = false;
        if (this.computeInterval) clearInterval(this.computeInterval);
        logger.info('Signal Intelligence Engine stopped');
    }

    switchSymbol(symbol: string) {
        this.activeSymbol = symbol;
        this.fetchSlowData(); // Trigger fresh fetch for new symbol
    }

    private async fetchSlowData() {
        try {
            // 1. Fetch Macro Data (FRED + Finnhub Forecasts inside FredAdapter)
            const fredSnapshot = await fredAdapter.fetch();

            if (fredSnapshot) {
                this.lastFredSnapshot = fredSnapshot;
                this.lastMacroScore = fredSnapshot.overallScore;
                this.lastRealYield = fredSnapshot.realYield;
                this.lastCreditSpread = fredSnapshot.creditSpread;
                this.lastMacroUpdate = Date.now();
            }

            // 2. Fetch Geopolitical Data (GDELT + Gemini)
            const news = await gdeltAdapter.fetchGlobalRiskNews();
            if (news.length > 0) {
                const analysis = await geminiAdapter.analyzeGeopolitics(news);
                if (analysis) {
                    // Map 0-10 Risk Score to -10 to 0 impact (Risk is always bearish/neutral, rarely bullish)
                    // If AI says bias is 'bullish', we might invert it, but usually high risk = bearish
                    let impact = -(analysis.riskScore);
                    if (analysis.bias === 'bullish') impact = Math.abs(impact * 0.5); // Rare

                    this.lastGeoScore = impact;
                    this.lastGeoSummary = analysis.summary;

                    if (analysis.riskScore > 8) this.lastGeoRiskLevel = 'extreme';
                    else if (analysis.riskScore > 5) this.lastGeoRiskLevel = 'high';
                    else if (analysis.riskScore > 3) this.lastGeoRiskLevel = 'elevated';
                    else this.lastGeoRiskLevel = 'low';

                    this.lastGeoUpdate = Date.now();
                }
            }

        } catch (err) {
            logger.error({ err }, 'Error fetching slow intelligence data');
        }
    }

    private computeAndBroadcast() {
        // Gather fast data (Market State / Technicals / Orderbook)
        const ob = marketState.orderbook;
        const ta = marketState.technicals;
        const liq = marketState.liquidations;

        if (!ob || !ta || !liq) return; // Wait for warmup

        // 1. Technical Score (-10 to +10)
        let techScore = 0;
        if (ta.trend.weekly === 'bullish') techScore += 4;
        if (ta.trend.weekly === 'bearish') techScore -= 4;
        if (ta.trend.daily === 'bullish') techScore += 3;
        if (ta.trend.daily === 'bearish') techScore -= 3;

        // HTF RSI Oversold/Overbought
        if (ta.htfRSI.weekly > 80 || ta.htfRSI.monthly > 80) {
            techScore = Math.min(techScore, 3); // High timeframe overbought caps bullishness
        } else if (ta.htfRSI.weekly < 20 || ta.htfRSI.monthly < 20) {
            techScore = Math.max(techScore, -3); // High timeframe oversold caps bearishness
        }

        // 2. Sentinel/Orderbook Score (-10 to +10)
        let sentScore = 0;
        const bidAskRatio = ob.totalBids / (ob.totalAsks || 1);
        if (bidAskRatio > 1.5) sentScore += 3;
        if (bidAskRatio < 0.6) sentScore -= 3;

        // Liquidation momentum
        if (liq.longsVsshortsRatio > 2) sentScore -= 2; // Too many longs getting squeezed
        if (liq.longsVsshortsRatio < 0.5) sentScore += 2; // Too many shorts getting squeezed

        // 3. Macro Score (From FRED)
        let macroScore = this.lastMacroScore;

        // Adjust macro score based on immediate tightening/easing proxy
        if (this.lastRealYield > 2.0) macroScore -= 2; // Restrictive
        if (this.lastRealYield < 0.5) macroScore += 2; // Loose

        // 4. Geopolitical Score
        let geoScore = this.lastGeoScore;

        // --- BLEND SCORES ---
        // Weights: Tech 40%, Macro 30%, Sentinel 20%, Geo 10%
        const blendedScore = (techScore * 0.4) + (macroScore * 0.3) + (sentScore * 0.2) + (geoScore * 0.1);
        const finalScore = Math.max(-10, Math.min(10, blendedScore));

        let finalBias: IntelligenceSnapshot['overallBias'] = 'neutral';
        if (finalScore >= 5) finalBias = 'strong_buy';
        else if (finalScore >= 1.5) finalBias = 'buy';
        else if (finalScore <= -5) finalBias = 'strong_sell';
        else if (finalScore <= -1.5) finalBias = 'sell';

        const snapshot: IntelligenceSnapshot = {
            timestamp: Date.now(),
            overallScore: parseFloat(finalScore.toFixed(2)),
            overallBias: finalBias,
            macroSurpriseScore: this.lastFredSnapshot?.macroSurpriseScore ?? 0,
            fearGreed: {
                value: Math.round(50 + (sentScore * 5)),
                classification: sentScore > 2 ? 'GREED' : sentScore < -2 ? 'FEAR' : 'NEUTRAL'
            },
            geopolitics: {
                riskScore: Math.abs(geoScore), // Map back to 0-10 for UI
                summary: this.lastGeoSummary,
                hotZones: [] // Gemini analysis could populate this if we parse it
            },
            ta: {
                rsi: ta.rsi,
                smaAlignment: ta.smaAlignment ? { trend: ta.smaAlignment.trend } : null,
                adTrend: ta.adTrend,
                marketStructure: ta.smaAlignment?.trend || 'neutral', // Using trend as proxy for structure
                divergence: ta.divergence ? { type: ta.divergence.type } : null
            },
            categories: [
                { name: 'Technical', score: techScore },
                { name: 'Macro', score: macroScore },
                { name: 'Sentiment', score: sentScore },
                { name: 'Geopolitics', score: geoScore }
            ],
            aiSummary: this.generateAiSummary(finalBias, techScore, macroScore, geoScore),
            fred: this.lastFredSnapshot
        };

        clientHub.broadcast(`signal.intelligence.${this.activeSymbol}` as any, snapshot);
    }

    private generateAiSummary(bias: string, tech: number, macro: number, geo: number): string {
        const parts = [];
        if (tech > 3) parts.push("Strong technical uptrend supports asset prices.");
        else if (tech < -3) parts.push("Technical structure remains broken, favoring bears.");

        if (macro > 2) parts.push("Macroeconomic environment is accommodative.");
        else if (macro < -2) parts.push("Macro headwinds (yields/inflation) suppressing risk appetite.");

        if (geo < -5) parts.push("Elevated geopolitical risk is contributing to defensive positioning.");

        if (parts.length === 0) return "Market forces are balanced; awaiting clear directional catalyst.";
        return parts.join(' ');
    }
}

export const signalIntelligenceEngine = new SignalIntelligenceEngine();
