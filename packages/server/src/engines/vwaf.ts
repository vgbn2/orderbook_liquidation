import { logger } from '../logger.js';
import { clientHub } from '../ws/client-hub.js';
import { redis } from '../db/redis.js';
import type { VWAFData, FundingSnapshot, Exchange } from '../adapters/types.js';

// ══════════════════════════════════════════════════════════════
//  VWAF Engine — Volume-Weighted Aggregate Funding
//  Aggregates funding rates across exchanges, weighted by OI
// ══════════════════════════════════════════════════════════════

const BROADCAST_INTERVAL = 5_000;

export class VWAFEngine {
    private snapshots: Map<Exchange, FundingSnapshot> = new Map();
    private broadcastTimer: ReturnType<typeof setInterval> | null = null;

    /**
     * Ingest a funding rate snapshot from an exchange.
     */
    update(snapshot: FundingSnapshot): void {
        this.snapshots.set(snapshot.exchange, snapshot);
    }

    /**
     * Compute VWAF and sentiment analysis.
     */
    compute(): VWAFData | null {
        if (this.snapshots.size === 0) return null;

        const entries = [...this.snapshots.values()];
        const totalOI = entries.reduce((s, e) => s + e.oi_usd, 0);
        if (totalOI === 0) return null;

        // Volume-weighted average funding
        let vwaf = 0;
        const byExchange: VWAFData['by_exchange'] = [];

        for (const e of entries) {
            const weight = e.oi_usd / totalOI;
            vwaf += e.rate * weight;
            byExchange.push({
                exchange: e.exchange,
                rate: e.rate,
                oi_usd: e.oi_usd,
                weight,
            });
        }

        // Annualize (3 funding periods per day × 365)
        const annualized = vwaf * 3 * 365;

        // 8h percentage
        const vwaf8hPct = vwaf * 100;

        // Divergence: max deviation from VWAF
        const maxDev = Math.max(...entries.map((e) => Math.abs(e.rate - vwaf)));

        // Sentiment classification
        let sentiment: VWAFData['sentiment'];
        if (vwaf > 0.0005) sentiment = 'extremely_long';
        else if (vwaf > 0.0002) sentiment = 'long_heavy';
        else if (vwaf < -0.0005) sentiment = 'extremely_short';
        else if (vwaf < -0.0002) sentiment = 'short_heavy';
        else sentiment = 'neutral';

        return {
            vwaf,
            vwaf_annualized: annualized,
            vwaf_8h_pct: vwaf8hPct,
            total_oi_usd: totalOI,
            divergence: maxDev,
            sentiment,
            by_exchange: byExchange.sort((a, b) => b.oi_usd - a.oi_usd),
        };
    }

    startBroadcast(): void {
        if (this.broadcastTimer) return;

        this.broadcastTimer = setInterval(() => {
            const data = this.compute();
            if (!data) return;

            // Cache in Redis
            redis.set('vwaf', JSON.stringify(data), 'EX', 30).catch(() => { });

            clientHub.broadcast('vwaf', data);
        }, BROADCAST_INTERVAL);
    }

    stop(): void {
        if (this.broadcastTimer) {
            clearInterval(this.broadcastTimer);
            this.broadcastTimer = null;
        }
    }

    clear(): void {
        this.snapshots.clear();
    }
}

export const vwafEngine = new VWAFEngine();

// ══════════════════════════════════════════════════════════════
//  Simulated funding snapshots (dev mode)
// ══════════════════════════════════════════════════════════════

function rnd(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

export function generateSimulatedFunding(): FundingSnapshot[] {
    const exchanges: Exchange[] = ['binance', 'bybit', 'okx'];
    const baseRate = rnd(-0.0004, 0.0006); // slight long bias

    return exchanges.map((exchange) => ({
        time: Date.now(),
        exchange,
        symbol: 'BTCUSDT',
        rate: baseRate + rnd(-0.0002, 0.0002), // slight variance between exchanges
        oi_usd: rnd(2e9, 8e9), // $2-8B OI
        next_funding_time: Math.floor(Date.now() / 1000) + 3600 * 8,
        annualized: (baseRate + rnd(-0.0002, 0.0002)) * 3 * 365,
    }));
}
