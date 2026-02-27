import { logger } from '../logger.js';
import { clientHub } from '../ws/client-hub.js';
import type { OptionsAnalytics, GEXData, Exchange } from '../adapters/types.js';

// ══════════════════════════════════════════════════════════════
//  Options Analytics Engine
//  Computes: Max Pain, GEX by Strike, GEX Flip, PCR, Regime
//  Data source: Deribit REST/WS (or simulated for dev)
// ══════════════════════════════════════════════════════════════

interface StrikeData {
    strike: number;
    callOI: number;
    putOI: number;
    iv: number;
    T: number; // time to expiry in years
}

const BROADCAST_INTERVAL = 5_000; // 5s — options don't change as fast as orderbook

export class OptionsEngine {
    private strikes: Map<number, StrikeData> = new Map();
    private broadcastTimer: ReturnType<typeof setInterval> | null = null;
    private spotPrice = 0;

    /**
     * Update spot price reference.
     */
    setSpot(price: number): void {
        this.spotPrice = price;
    }

    /**
     * Load options chain data (from Deribit API or simulation).
     */
    loadChain(data: StrikeData[]): void {
        this.strikes.clear();
        for (const d of data) {
            this.strikes.set(d.strike, d);
        }
    }

    /**
     * Compute max pain — the strike price minimizing total option value.
     */
    computeMaxPain(): number {
        const strikes = [...this.strikes.values()];
        if (strikes.length === 0) return 0;

        let minPain = Infinity;
        let maxPain = strikes[0].strike;

        for (const test of strikes) {
            let pain = 0;
            for (const s of strikes) {
                pain += Math.max(0, test.strike - s.strike) * s.callOI;
                pain += Math.max(0, s.strike - test.strike) * s.putOI;
            }
            if (pain < minPain) {
                minPain = pain;
                maxPain = test.strike;
            }
        }
        return maxPain;
    }

    /**
     * Compute GEX (Gamma Exposure) by strike.
     */
    computeGEX(): GEXData {
        const spot = this.spotPrice;
        if (spot === 0) return { gex_by_strike: {}, gex_flip: null, total_gex: 0 };

        const gexByStrike: Record<number, number> = {};
        let totalGex = 0;
        const sortedStrikes = [...this.strikes.entries()].sort((a, b) => a[0] - b[0]);

        for (const [strike, data] of sortedStrikes) {
            if (data.T <= 0) continue;

            const d1 = (Math.log(spot / strike) + (0.05 + 0.5 * data.iv * data.iv) * data.T)
                / (data.iv * Math.sqrt(data.T));
            const nd1 = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI);
            const gamma = nd1 / (spot * data.iv * Math.sqrt(data.T));
            const gex = (data.callOI - data.putOI) * gamma * spot * spot * 0.01;

            gexByStrike[strike] = gex;
            totalGex += gex;
        }

        // Find GEX flip (zero crossing)
        let prevGex = 0;
        let gexFlip: number | null = null;
        for (const [strike] of sortedStrikes) {
            const g = gexByStrike[strike] ?? 0;
            if (prevGex * g < 0) {
                gexFlip = strike;
                break;
            }
            prevGex = g;
        }

        return { gex_by_strike: gexByStrike, gex_flip: gexFlip, total_gex: totalGex };
    }

    /**
     * Compute full analytics snapshot.
     */
    compute(): OptionsAnalytics | null {
        if (this.strikes.size === 0 || this.spotPrice === 0) return null;

        const maxPain = this.computeMaxPain();
        const gex = this.computeGEX();

        const totalCallOI = [...this.strikes.values()].reduce((s, d) => s + d.callOI, 0);
        const totalPutOI = [...this.strikes.values()].reduce((s, d) => s + d.putOI, 0);
        const pcr = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

        const oiByStrike: Record<number, { call_oi: number; put_oi: number; total: number }> = {};
        for (const [strike, data] of this.strikes) {
            oiByStrike[strike] = {
                call_oi: data.callOI,
                put_oi: data.putOI,
                total: data.callOI + data.putOI,
            };
        }

        return {
            expiry: 'all',
            max_pain: maxPain,
            gex_flip: gex.gex_flip,
            total_gex: gex.total_gex,
            gex_by_strike: gex.gex_by_strike,
            oi_by_strike: oiByStrike,
            pcr,
            regime: gex.total_gex > 0 ? 'pinned' : 'explosive',
        };
    }

    /**
     * Start periodic broadcast to frontend clients.
     */
    startBroadcast(): void {
        if (this.broadcastTimer) return;

        this.broadcastTimer = setInterval(() => {
            const analytics = this.compute();
            if (!analytics) return;

            clientHub.broadcast('options.analytics' as any, analytics);
        }, BROADCAST_INTERVAL);
    }

    /**
     * Get latest computed analytics (for confluence engine).
     */
    getLatest(): OptionsAnalytics | null {
        return this.compute();
    }

    stop(): void {
        if (this.broadcastTimer) {
            clearInterval(this.broadcastTimer);
            this.broadcastTimer = null;
        }
    }
}

export const optionsEngine = new OptionsEngine();

// ══════════════════════════════════════════════════════════════
//  Simulated options chain generator (used when no Deribit key)
// ══════════════════════════════════════════════════════════════

function rnd(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

export function generateSimulatedChain(spot: number): StrikeData[] {
    const offsets = [-8, -6, -4, -2, -1, 0, 1, 2, 3, 4, 6, 8, 10, 12];
    return offsets.map((d) => {
        const strike = Math.round((spot + d * 1000) / 500) * 500;
        const T = rnd(5, 45) / 365;
        const iv = rnd(0.55, 1.2) * (1 + (Math.abs(strike - spot) / spot) * 3);
        const callOI = Math.max(0, rnd(-500, 5000) + (strike < spot ? 1500 : 500));
        const putOI = Math.max(0, rnd(-500, 5000) + (strike > spot ? 1500 : 500));
        return { strike, callOI, putOI, iv, T };
    });
}

/**
 * Generate a simulated large options trade.
 */
export function generateSimulatedTrade(spot: number) {
    const type = Math.random() > 0.5 ? 'call' : 'put';
    const dStrike = Math.round(rnd(-4, 6)) * 1000;
    const strike = Math.round((spot + dStrike) / 500) * 500;
    const size = Math.round(rnd(50, 500));
    const premiumUsd = size * rnd(0.01, 0.05) * spot;
    const expiries = ['28 Feb', '28 Mar', '25 Apr'];
    const expiry = expiries[Math.floor(Math.random() * 3)];
    const iv = rnd(0.55, 1.1);
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const aggressor = type === 'call'
        ? (side === 'buy' ? 'bullish' : 'bearish')
        : (side === 'buy' ? 'bearish' : 'bullish');

    return {
        time: Math.floor(Date.now() / 1000),
        instrument: `BTC-${expiry.replace(' ', '')}-${strike}-${type.charAt(0).toUpperCase()}`,
        strike,
        expiry: Math.floor(Date.now() / 1000) + 86400 * 30,
        type: type as 'call' | 'put',
        side: side as 'buy' | 'sell',
        size,
        premium_usd: premiumUsd,
        iv,
        aggressor: aggressor as 'bullish' | 'bearish',
    };
}
