import { logger } from '../logger.js';
import { redis } from '../db/redis.js';
import { clientHub } from '../ws/client-hub.js';
import { binanceAdapter } from '../adapters/binance.js';
import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance();

import { computeQuantAnalytics, MacroPrices } from './quantMath.js';

const INTERVAL = 30 * 60 * 1000; // 30 minutes
const MAX_RETRIES = 3;

export interface QuantSnapshot {
    symbol: string;
    timestamp: number;
    currentPrice: number;
    meta: {
        baseDrift: number;
        macroDrag: number;
        adjustedDrift: number;
        stepVolatility: number;
        horizon: number;
    };
    kalman: number[];
    dates: string[];
    projections: number[];
    sigmaGrid: Array<{
        sigma: number;
        price: number;
        pctMove: number;
        probability: number;
    }>;
    quantiles: Record<string, { price: number; pctMove: number }>;
    macroBreakdown: Array<{
        ticker: string;
        correlation: number;
        zScore: number;
        impact: number;
    }>;
}

class QuantEngine {
    private cache: Map<string, QuantSnapshot> = new Map();
    private activeSymbol = 'BTCUSDT';
    private runningSymbols = new Set<string>();
    private timer: ReturnType<typeof setInterval> | null = null;

    // Default list of macro assets used for drag calculation
    private readonly MACRO_ASSETS = ['DX-Y.NYB', '^TNX', '^GSPC'];

    getLastSnapshot(symbol?: string): QuantSnapshot | null {
        return this.cache.get(symbol || this.activeSymbol) || null;
    }

    async switchSymbol(newSymbol: string) {
        if (this.activeSymbol === newSymbol) return;
        this.activeSymbol = newSymbol;

        const cached = this.cache.get(newSymbol);
        if (cached) {
            clientHub.broadcast(`quant.analytics.${newSymbol}` as any, cached);
        } else {
            // Try Redis cache first
            try {
                const redisCached = await redis.get(`quant:analytics:${newSymbol}`);
                if (redisCached) {
                    const snap = JSON.parse(redisCached) as QuantSnapshot;
                    this.cache.set(newSymbol, snap);
                    clientHub.broadcast(`quant.analytics.${newSymbol}` as any, snap);
                    return; // Don't run cycle immediately if found in redis
                }
            } catch (err) {
                logger.warn({ err }, `QuantEngine: Failed to read redis cache for ${newSymbol}`);
            }

            // Trigger run for new symbol
            this.runCycle(newSymbol, 1);
        }
    }

    async start(initialSymbol = 'BTCUSDT') {
        this.activeSymbol = initialSymbol;

        // Try to load latest from Redis to populate cache immediately
        try {
            const cached = await redis.get(`quant:analytics:${initialSymbol}`);
            if (cached) {
                const snapshot = JSON.parse(cached) as QuantSnapshot;
                this.cache.set(snapshot.symbol, snapshot);
                logger.debug({ symbol: snapshot.symbol }, 'QuantEngine: Loaded initial snapshot from Redis');
            }
        } catch (err) {
            logger.warn({ err }, 'QuantEngine: Failed to load initial snapshot from Redis');
        }

        logger.info(`QuantEngine started. Primary symbol: ${this.activeSymbol}`);
        this.runCycle(this.activeSymbol);

        // Setup recurring cycle for the currently active symbol
        this.timer = setInterval(() => this.runCycle(this.activeSymbol), INTERVAL);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private async runCycle(symbol: string, attempt = 1): Promise<void> {
        if (this.runningSymbols.has(symbol)) {
            logger.debug({ symbol }, 'QuantEngine: cycle already running for symbol, skipping');
            return;
        }
        this.runningSymbols.add(symbol);

        try {
            const snapshot = await this.fetchMacroData(symbol);
            this.cache.set(symbol, snapshot);

            // Persist to Redis
            await redis.set(`quant:analytics:${symbol}`, JSON.stringify(snapshot), 'EX', 7200); // 2hr TTL

            // Always broadcast on topic namespaced by symbol
            clientHub.broadcast(`quant.analytics.${symbol}` as any, snapshot);

            // For backward compatibility while UI connects, also broadcast on default topic if it's the active one
            if (this.activeSymbol === symbol) {
                clientHub.broadcast('quant.analytics' as any, snapshot);
            }

            logger.info({
                symbol,
                price: snapshot.currentPrice,
                drift: snapshot.meta.adjustedDrift,
            }, 'QuantEngine cycle complete');
        } catch (err) {
            logger.error({ err, attempt, symbol }, 'QuantEngine cycle failed');
            if (attempt < MAX_RETRIES) {
                this.runningSymbols.delete(symbol);
                setTimeout(() => this.runCycle(symbol, attempt + 1), 5000);
                return;
            }
            if (this.activeSymbol === symbol) {
                clientHub.broadcast('quant.error' as any, {
                    ts: Date.now(),
                    message: String(err),
                    retryIn: INTERVAL,
                });
            }
        } finally {
            this.runningSymbols.delete(symbol);
        }
    }

    private async fetchMacroData(symbol: string): Promise<QuantSnapshot> {
        // Look back roughly 180 days
        const limit = 180;
        const now = new Date();
        const period1Str = new Date(now.getTime() - limit * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // 1. Fetch target symbol klines
        const cryptoKlines = await binanceAdapter.fetchKlines(symbol, '1d', limit);
        if (cryptoKlines.length < 30) {
            throw new Error(`Insufficient crypto data for ${symbol}`);
        }

        const prices = cryptoKlines.map(k => k.close);
        const dates = cryptoKlines.map(k => new Date(k.time * 1000).toISOString().split('T')[0]);

        // 2. Fetch Macro indices
        const macroPrices: MacroPrices = {};
        for (const [idx, ticker] of this.MACRO_ASSETS.entries()) {
            try {
                // To avoid rate limits, small delay
                if (idx > 0) await new Promise(r => setTimeout(r, 200));

                const data = await yf.historical(ticker, {
                    period1: period1Str,
                    period2: now.toISOString().split('T')[0],
                    interval: '1d'
                }) as Array<{ close: number }>;

                if (data && data.length > 0) {
                    macroPrices[ticker] = data.map((d) => d.close);
                }
            } catch (err) {
                logger.warn({ err, ticker }, 'Failed to fetch macro ticker');
            }
        }

        // 3. Run pure TS analytics
        return computeQuantAnalytics(symbol, prices, dates, macroPrices);
    }
}

export const quantEngine = new QuantEngine();
