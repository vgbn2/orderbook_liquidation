import { logger } from '../logger.js';
import { clientHub } from '../ws/client-hub.js';
import { query } from '../db/timescale.js';
import { redis } from '../db/redis.js';
import type { LiquidationEvent, LiquidationHeatmapEntry } from '../adapters/types.js';

// ══════════════════════════════════════════════════════════════
//  Advanced Liquidity Engine — DIY Heatmap
// ══════════════════════════════════════════════════════════════

const BROADCAST_INTERVAL = 30_000;

export class LiquidationEngine {
    private broadcastTimer: ReturnType<typeof setInterval> | null = null;
    private spotPrice = 0;
    private symbol = 'BTCUSDT';
    private lastHeatmap: any = null;
    private eventBuffer: LiquidationEvent[] = [];
    private persistTimer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        this.persistTimer = setInterval(() => this.persistBuffer(), 5000);
    }

    setSpot(price: number): void {
        this.spotPrice = price;
    }

    /**
     * Record an individual liquidation event.
     * Buffers events for batch insertion.
     */
    addEvent(event: LiquidationEvent): void {
        this.eventBuffer.push(event);

        // Broadcast individual event a scatter plot bubble layer immediately for UI responsiveness
        clientHub.broadcast('liquidations' as any, event);

        // If buffer gets too large, trigger early persist
        if (this.eventBuffer.length >= 500) {
            this.persistBuffer();
        }
    }

    private async persistBuffer() {
        if (this.eventBuffer.length === 0) return;

        const events = [...this.eventBuffer];
        this.eventBuffer = [];

        try {
            const values: any[] = [];
            const placeholders = events.map((ev, i) => {
                const base = i * 6;
                values.push(
                    Math.floor(ev.time / 1000),
                    ev.exchange,
                    ev.symbol,
                    ev.price,
                    ev.size_usd,
                    ev.side
                );
                return `(to_timestamp($${base + 1}), $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
            }).join(', ');

            await query(
                `INSERT INTO liquidation_events (time, exchange, symbol, price, size_usd, side)
                 VALUES ${placeholders}
                 ON CONFLICT DO NOTHING`,
                values
            );
        } catch (err) {
            logger.error({ err }, 'Failed to batch persist liquidations');
        }
    }

    /**
     * Start periodic heatmap broadcast.
     */
    startBroadcast(): void {
        if (this.broadcastTimer) return;

        this.broadcastTimer = setInterval(() => this.computeHeatmap(), BROADCAST_INTERVAL);
        this.computeHeatmap(); // run immediately
    }

    /**
     * Fetches Binance context and models the current liquidation heatmap.
     */
    private async computeHeatmap() {
        if (this.spotPrice === 0) return;

        try {
            const [oiRes, lsRes, frRes] = await Promise.all([
                fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${this.symbol}`),
                fetch(`https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${this.symbol}&period=5m&limit=1`),
                fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${this.symbol}`)
            ]);

            const oiData = await oiRes.json() as any;
            const lsData = await lsRes.json() as any;
            const frData = await frRes.json() as any;

            const totalOI = parseFloat(oiData.openInterest || "0");
            const ls = lsData[0] || { longAccount: "0.5", shortAccount: "0.5" };
            const longRatio = parseFloat(ls.longAccount);
            const shortRatio = parseFloat(ls.shortAccount);
            const fundingRate = parseFloat(frData.lastFundingRate || "0");

            const leverageWeights = [
                { lev: 100, weight: 0.05 },
                { lev: 50, weight: 0.15 },
                { lev: 25, weight: 0.20 },
                { lev: 20, weight: 0.25 },
                { lev: 10, weight: 0.20 },
                { lev: 5, weight: 0.10 },
                { lev: 3, weight: 0.05 },
            ];

            const heatmapMap = new Map<number, { long_liq_usd: number; short_liq_usd: number }>();
            const bucketSize = this.spotPrice * 0.001; // 0.1% bucket resolution

            const addLiq = (price: number, sizeUSD: number, side: 'long' | 'short') => {
                const bucket = Math.round(price / bucketSize) * bucketSize;
                const existing = heatmapMap.get(bucket) || { long_liq_usd: 0, short_liq_usd: 0 };
                if (side === 'long') existing.long_liq_usd += sizeUSD;
                else existing.short_liq_usd += sizeUSD;
                heatmapMap.set(bucket, existing);
            };

            const oiUsd = totalOI * this.spotPrice;
            const longOiUsd = oiUsd * longRatio;
            const shortOiUsd = oiUsd * shortRatio;

            for (const tier of leverageWeights) {
                // Approximate maintenance margin cascade
                const longLiqPrice = this.spotPrice * (1 - 1 / tier.lev);
                const shortLiqPrice = this.spotPrice * (1 + 1 / tier.lev);

                // Crowding bias: if high positive funding, longs are crowded relative to shorts
                const fundingBias = Math.max(1, 1 + (fundingRate * 1000));

                const longTierUsd = longOiUsd * tier.weight * (fundingRate > 0 ? fundingBias : 1);
                const shortTierUsd = shortOiUsd * tier.weight * (fundingRate < 0 ? fundingBias : 1);

                addLiq(longLiqPrice, longTierUsd, 'long');
                addLiq(shortLiqPrice, shortTierUsd, 'short');
            }

            // Apply Gaussian blur (kernel: 0.05, 0.15, 0.60, 0.15, 0.05)
            const blurredMap = new Map<number, { long_liq_usd: number; short_liq_usd: number }>();
            const kernel = [0.05, 0.15, 0.6, 0.15, 0.05];

            for (const [bucket, data] of heatmapMap.entries()) {
                for (let k = -2; k <= 2; k++) {
                    const targetBucket = bucket + (k * bucketSize);
                    const weight = kernel[k + 2];
                    const existing = blurredMap.get(targetBucket) || { long_liq_usd: 0, short_liq_usd: 0 };
                    existing.long_liq_usd += data.long_liq_usd * weight;
                    existing.short_liq_usd += data.short_liq_usd * weight;
                    blurredMap.set(targetBucket, existing);
                }
            }

            const heatmap = Array.from(blurredMap.entries()).map(([price, d]) => ({
                price: Math.round(price),
                long_liq_usd: Math.round(d.long_liq_usd),
                short_liq_usd: Math.round(d.short_liq_usd),
                total: Math.round(d.long_liq_usd + d.short_liq_usd)
            })).filter(b => b.total > 100_000).sort((a, b) => a.price - b.price);

            const totalLiq = heatmap.reduce((s, b) => s + b.total, 0);

            const payload = {
                heatmap,
                total_usd: totalLiq,
                event_count: 0,
            };

            this.lastHeatmap = payload.heatmap;
            clientHub.broadcast('liquidations.heatmap' as any, payload);
            redis.set('liquidations.heatmap', JSON.stringify(payload), 'EX', 60).catch(err => logger.error({ err }, 'Failed to cache heatmap'));

        } catch (err) {
            logger.error({ err }, 'Failed to compute Liquidation Heatmap via REST models');
        }
    }

    stop(): void {
        if (this.broadcastTimer) {
            clearInterval(this.broadcastTimer);
            this.broadcastTimer = null;
        }
    }

    getHeatmap() {
        return this.lastHeatmap;
    }
}

export const liquidationEngine = new LiquidationEngine();

// ══════════════════════════════════════════════════════════════
//  Simulated liquidation events (dev mode)
// ══════════════════════════════════════════════════════════════

function rnd(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

export function generateSimulatedLiquidation(spot: number): LiquidationEvent {
    const side = Math.random() > 0.5 ? 'long' : 'short';
    const offset = side === 'long'
        ? -rnd(0.002, 0.04) * spot
        : rnd(0.002, 0.04) * spot;

    return {
        time: Date.now(),
        exchange: (['binance', 'bybit', 'okx'] as const)[Math.floor(Math.random() * 3)],
        symbol: 'BTCUSDT',
        price: Math.round(spot + offset),
        size_usd: rnd(10_000, 5_000_000),
        side,
    };
}

export function seedLiquidationHistory(spot: number, count = 100): LiquidationEvent[] {
    const events: LiquidationEvent[] = [];
    for (let i = 0; i < count; i++) {
        const ev = generateSimulatedLiquidation(spot);
        ev.time = Date.now() - rnd(0, 3600_000); // spread over last hour
        events.push(ev);
    }
    return events;
}

