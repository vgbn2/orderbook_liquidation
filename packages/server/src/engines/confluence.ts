import { logger } from '../logger.js';
import { clientHub } from '../ws/client-hub.js';
import { redis } from '../db/redis.js';
import type {
    ConfluenceZone,
    ConfluenceReason,
    AggregatedOrderbook,
    OptionsAnalytics,
    LiquidationHeatmapEntry,
    VWAFData,
} from '../adapters/types.js';

// ══════════════════════════════════════════════════════════════
//  Confluence Engine — Multi-Signal Zone Detection
//  Aggregates: Orderbook Walls + Options GEX/MaxPain +
//              Liquidation Clusters + VWAF Sentiment
// ══════════════════════════════════════════════════════════════

const BROADCAST_INTERVAL = 4_000;
const ZONE_MERGE_PCT = 0.002; // 0.2% — merge zones within this range

interface EngineInputs {
    spot: number;
    orderbook?: AggregatedOrderbook;
    options?: OptionsAnalytics;
    liqHeatmap?: LiquidationHeatmapEntry[];
    vwaf?: VWAFData;
}

export class ConfluenceEngine {
    private inputs: EngineInputs = { spot: 0 };
    private broadcastTimer: ReturnType<typeof setInterval> | null = null;
    private lastZones: ConfluenceZone[] = [];

    setSpot(price: number): void {
        this.inputs.spot = price;
    }

    setOrderbook(ob: AggregatedOrderbook): void {
        this.inputs.orderbook = ob;
    }

    setOptions(opt: OptionsAnalytics): void {
        this.inputs.options = opt;
    }

    setLiqHeatmap(heatmap: LiquidationHeatmapEntry[]): void {
        this.inputs.liqHeatmap = heatmap;
    }

    setVWAF(vwaf: VWAFData): void {
        this.inputs.vwaf = vwaf;
    }

    getZones(): ConfluenceZone[] {
        return this.lastZones;
    }

    /**
     * Compute confluence zones from all available signals.
     */
    compute(): ConfluenceZone[] {
        const { spot, orderbook, options, liqHeatmap, vwaf } = this.inputs;
        if (spot === 0) return [];

        const candidates: { price: number; reason: ConfluenceReason }[] = [];

        // ── Signal 1: Orderbook Walls ─────────────────
        if (orderbook?.walls) {
            for (const w of orderbook.walls.bid_walls) {
                candidates.push({
                    price: w.price,
                    reason: {
                        signal: 'OB_BID_WALL',
                        detail: `${w.qty.toFixed(2)} BTC (${(w.pct * 100).toFixed(1)}% depth)`,
                        contribution: Math.min(w.pct * 100, 30),
                    },
                });
            }
            for (const w of orderbook.walls.ask_walls) {
                candidates.push({
                    price: w.price,
                    reason: {
                        signal: 'OB_ASK_WALL',
                        detail: `${w.qty.toFixed(2)} BTC (${(w.pct * 100).toFixed(1)}% depth)`,
                        contribution: Math.min(w.pct * 100, 30),
                    },
                });
            }
        }

        // ── Signal 2: Options Max Pain + GEX Flip ──────
        if (options) {
            if (options.max_pain > 0) {
                const dist = Math.abs(spot - options.max_pain) / spot;
                const contrib = dist < 0.03 ? 25 : dist < 0.05 ? 15 : 8;
                candidates.push({
                    price: options.max_pain,
                    reason: {
                        signal: 'OPTIONS_MAX_PAIN',
                        detail: `$${options.max_pain.toLocaleString()} (PCR: ${options.pcr.toFixed(2)})`,
                        contribution: contrib,
                    },
                });
            }

            if (options.gex_flip != null) {
                candidates.push({
                    price: options.gex_flip,
                    reason: {
                        signal: 'GEX_FLIP',
                        detail: `Gamma exposure flip at $${options.gex_flip.toLocaleString()}`,
                        contribution: 20,
                    },
                });
            }
        }

        // ── Signal 3: Liquidation Clusters ─────────────
        if (liqHeatmap && liqHeatmap.length > 0) {
            const maxLiq = Math.max(...liqHeatmap.map((e) => e.total));
            for (const entry of liqHeatmap) {
                if (entry.total > maxLiq * 0.3) {
                    const intensity = entry.total / maxLiq;
                    candidates.push({
                        price: entry.price,
                        reason: {
                            signal: entry.long_liq_usd > entry.short_liq_usd ? 'LIQ_LONG_CLUSTER' : 'LIQ_SHORT_CLUSTER',
                            detail: `$${(entry.total / 1e6).toFixed(1)}M liquidations`,
                            contribution: intensity * 25,
                        },
                    });
                }
            }
        }

        // ── Signal 4: VWAF Sentiment Bias ─────────────
        if (vwaf) {
            if (vwaf.sentiment === 'extremely_long' || vwaf.sentiment === 'long_heavy') {
                // Funding heavily long → short squeeze less likely, long liquidations more likely below
                candidates.push({
                    price: spot * 0.98,
                    reason: {
                        signal: 'VWAF_LONG_BIAS',
                        detail: `Funding ${(vwaf.vwaf * 100).toFixed(4)}% — cascade risk below`,
                        contribution: 10,
                    },
                });
            } else if (vwaf.sentiment === 'extremely_short' || vwaf.sentiment === 'short_heavy') {
                candidates.push({
                    price: spot * 1.02,
                    reason: {
                        signal: 'VWAF_SHORT_BIAS',
                        detail: `Funding ${(vwaf.vwaf * 100).toFixed(4)}% — squeeze risk above`,
                        contribution: 10,
                    },
                });
            }
        }

        // ── Merge nearby candidates into zones ──────────
        if (candidates.length === 0) return [];

        candidates.sort((a, b) => a.price - b.price);

        const zones: ConfluenceZone[] = [];
        let currentZone: { prices: number[]; reasons: ConfluenceReason[] } = {
            prices: [candidates[0].price],
            reasons: [candidates[0].reason],
        };

        for (let i = 1; i < candidates.length; i++) {
            const prev = currentZone.prices[currentZone.prices.length - 1];
            const curr = candidates[i].price;

            if (Math.abs(curr - prev) / prev < ZONE_MERGE_PCT) {
                // Merge into current zone
                currentZone.prices.push(curr);
                currentZone.reasons.push(candidates[i].reason);
            } else {
                // Finalize current zone and start new one
                zones.push(this.finalizeZone(currentZone));
                currentZone = {
                    prices: [curr],
                    reasons: [candidates[i].reason],
                };
            }
        }
        zones.push(this.finalizeZone(currentZone));

        // Sort by score descending
        zones.sort((a, b) => b.score - a.score);

        this.lastZones = zones;
        return zones.slice(0, 8); // Top 8 zones
    }

    private finalizeZone(data: { prices: number[]; reasons: ConfluenceReason[] }): ConfluenceZone {
        const minP = Math.min(...data.prices);
        const maxP = Math.max(...data.prices);
        const center = data.prices.reduce((s, p) => s + p, 0) / data.prices.length;
        const score = data.reasons.reduce((s, r) => s + r.contribution, 0);

        let strength: ConfluenceZone['strength'];
        if (score >= 40 || data.reasons.length >= 3) strength = 'high';
        else if (score >= 20 || data.reasons.length >= 2) strength = 'medium';
        else strength = 'low';

        return {
            price_low: minP,
            price_high: maxP === minP ? minP * 0.999 : maxP, // tiny spread if single point
            center,
            score,
            strength,
            reasons: data.reasons,
            timestamp: Date.now(),
        };
    }

    startBroadcast(): void {
        if (this.broadcastTimer) return;

        this.broadcastTimer = setInterval(() => {
            const zones = this.compute();
            if (zones.length === 0) return;

            redis.set('confluence', JSON.stringify(zones), 'EX', 30).catch(() => { });
            clientHub.broadcast('confluence', zones);
        }, BROADCAST_INTERVAL);
    }

    stop(): void {
        if (this.broadcastTimer) {
            clearInterval(this.broadcastTimer);
            this.broadcastTimer = null;
        }
    }
}

export const confluenceEngine = new ConfluenceEngine();
