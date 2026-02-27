import { logger } from '../logger.js';
import { clientHub } from '../ws/client-hub.js';
import { query } from '../db/timescale.js';
import type { LiquidationEvent, LiquidationHeatmapEntry } from '../adapters/types.js';

// ══════════════════════════════════════════════════════════════
//  Liquidation Engine — Event Tracking + Heatmap
// ══════════════════════════════════════════════════════════════

const HEATMAP_BUCKETS = 25;
const HEATMAP_RANGE_PCT = 0.05;  // ±5% around spot
const BROADCAST_INTERVAL = 3_000;

export class LiquidationEngine {
    private events: LiquidationEvent[] = [];
    private broadcastTimer: ReturnType<typeof setInterval> | null = null;
    private spotPrice = 0;
    private dirty = false;

    setSpot(price: number): void {
        this.spotPrice = price;
    }

    /**
     * Record a liquidation event.
     */
    addEvent(event: LiquidationEvent): void {
        this.events.push(event);
        // Keep last 500 events in memory
        if (this.events.length > 500) {
            this.events = this.events.slice(-500);
        }
        this.dirty = true;

        // Persist to TimescaleDB
        query(
            `INSERT INTO liquidation_events (time, exchange, symbol, price, size_usd, side)
       VALUES (to_timestamp($1), $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
            [
                Math.floor(event.time / 1000),
                event.exchange,
                event.symbol,
                event.price,
                event.size_usd,
                event.side,
            ],
        ).catch((err) => logger.error({ err }, 'Failed to persist liquidation'));

        // Broadcast individual event
        clientHub.broadcast('liquidations' as any, event);
    }

    /**
     * Build estimated liquidation heatmap around current spot.
     */
    buildHeatmap(): LiquidationHeatmapEntry[] {
        if (this.spotPrice === 0) return [];

        const low = this.spotPrice * (1 - HEATMAP_RANGE_PCT);
        const high = this.spotPrice * (1 + HEATMAP_RANGE_PCT);
        const step = (high - low) / HEATMAP_BUCKETS;

        const buckets: LiquidationHeatmapEntry[] = [];
        for (let i = 0; i < HEATMAP_BUCKETS; i++) {
            const bucketLow = low + i * step;
            const bucketHigh = bucketLow + step;
            const price = (bucketLow + bucketHigh) / 2;

            // Sum liquidation volume that falls in this bucket
            let longLiq = 0;
            let shortLiq = 0;
            for (const ev of this.events) {
                if (ev.price >= bucketLow && ev.price < bucketHigh) {
                    if (ev.side === 'long') longLiq += ev.size_usd;
                    else shortLiq += ev.size_usd;
                }
            }

            buckets.push({
                price: Math.round(price),
                long_liq_usd: longLiq,
                short_liq_usd: shortLiq,
                total: longLiq + shortLiq,
            });
        }
        return buckets;
    }

    /**
     * Start periodic heatmap broadcast.
     */
    startBroadcast(): void {
        if (this.broadcastTimer) return;

        this.broadcastTimer = setInterval(() => {
            if (!this.dirty && this.events.length === 0) return;
            this.dirty = false;

            const heatmap = this.buildHeatmap();
            const totalLiq = heatmap.reduce((s, b) => s + b.total, 0);

            clientHub.broadcast('liquidations.heatmap' as any, {
                heatmap,
                total_usd: totalLiq,
                event_count: this.events.length,
            });
        }, BROADCAST_INTERVAL);
    }

    /**
     * Get current heatmap (for confluence engine).
     */
    getHeatmap(): LiquidationHeatmapEntry[] {
        return this.buildHeatmap();
    }

    stop(): void {
        if (this.broadcastTimer) {
            clearInterval(this.broadcastTimer);
            this.broadcastTimer = null;
        }
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
    // Longs get liquidated below spot, shorts above
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

/**
 * Generate a batch of simulated historical liquidations to seed the heatmap.
 */
export function seedLiquidationHistory(spot: number, count = 100): LiquidationEvent[] {
    const events: LiquidationEvent[] = [];
    for (let i = 0; i < count; i++) {
        const ev = generateSimulatedLiquidation(spot);
        ev.time = Date.now() - rnd(0, 3600_000); // spread over last hour
        events.push(ev);
    }
    return events;
}
