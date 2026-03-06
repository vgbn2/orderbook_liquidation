import { logger } from '../../logger.js';
import { clientHub } from '../../ws/client-hub.js';
import { redis } from '../../db/redis.js';
import type { Candle } from '../../adapters/types.js';

// ── Types ──────────────────────────────────────────────────

export interface FVG {
    id: string;
    type: 'bullish' | 'bearish';
    top: number;
    bottom: number;
    midpoint: number;
    formedAt: number;
    filled: boolean;
    partialFill: number;
}

export interface OrderBlock {
    id: string;
    type: 'bullish' | 'bearish';
    top: number;
    bottom: number;
    formedAt: number;
    broken: boolean;
    strength: 'fresh' | 'tested' | 'broken';
}

export interface LiqBacking {
    usdAtLevel: number;
    longLiqUsd: number;
    shortLiqUsd: number;
    isSignificant: boolean;
}

export interface ConfirmedSweep {
    id: string;
    type: 'BSL' | 'SSL';
    sweptLevel: number;
    sweepCandle: Candle;
    reversalCandle: Candle;
    sweepCloseDistance: number;
    reversalBars: number;
    liqBacking: LiqBacking | null;
    confidence: 'high' | 'medium' | 'low';
}

interface PendingSweep {
    type: 'BSL' | 'SSL';
    sweptLevel: number;
    sweepCandle: Candle;
    sweepCloseDistance: number;
    barsElapsed: number;
    liqBacking: LiqBacking | null;
}

// ── Constants ──────────────────────────────────────────────
const SWEEP_CLOSE_TOLERANCE = 0.0005;
const SWEEP_REVERSAL_BARS = 3;
const SWEEP_REVERSAL_CLOSE = 0.001;
const MIN_LIQ_BACKING_USD = 500_000;
const SWING_LOOKBACK = 5;

interface MarketState {
    candles: Candle[];
    fvgs: FVG[];
    orderBlocks: OrderBlock[];
    swingHighs: { price: number; time: number; idx: number }[];
    swingLows: { price: number; time: number; idx: number }[];
    pendingSweeps: PendingSweep[];
    confirmedSweeps: ConfirmedSweep[];
    lastBroadcast: number;
}

export class PreciseIctEngine {
    private states = new Map<string, MarketState>();
    private liqHeatmap: any[] = [];

    private getOrCreateState(symbol: string, interval: string): MarketState {
        const key = `${symbol.toUpperCase()}:${interval}`;
        let state = this.states.get(key);
        if (!state) {
            state = {
                candles: [],
                fvgs: [],
                orderBlocks: [],
                swingHighs: [],
                swingLows: [],
                pendingSweeps: [],
                confirmedSweeps: [],
                lastBroadcast: 0
            };
            this.states.set(key, state);
        }
        return state;
    }

    setLiqHeatmap(heatmap: any[]): void {
        this.liqHeatmap = heatmap;
    }

    onCandle(candle: Candle & { symbol?: string; interval?: string }): void {
        const symbol = candle.symbol || 'UNKNOWN';
        const interval = candle.interval || '1m';
        const state = this.getOrCreateState(symbol, interval);

        state.candles.push(candle);
        if (state.candles.length > 500) state.candles = state.candles.slice(-500);
        if (state.candles.length < SWING_LOOKBACK * 2 + 1) return;

        this.updateSwings(state);
        this.detectFVGs(state);
        this.detectOrderBlocks(state);
        this.updateFVGFills(state);
        this.updateOBStatus(state);
        this.checkForNewSweeps(state, candle);
        this.tickPendingSweeps(state, candle);

        // Broadcast structural updates periodically
        if (Date.now() - state.lastBroadcast > 5_000) {
            state.lastBroadcast = Date.now();
            this.broadcast(symbol, interval, state);
        }
    }

    private updateSwings(state: MarketState): void {
        const n = state.candles.length;
        const checkIdx = n - SWING_LOOKBACK - 1;
        const c = state.candles[checkIdx];
        const before = state.candles.slice(checkIdx - SWING_LOOKBACK, checkIdx);
        const after = state.candles.slice(checkIdx + 1, checkIdx + SWING_LOOKBACK + 1);

        const isSwingHigh = before.every(x => x.high <= c.high) && after.every(x => x.high <= c.high);
        const isSwingLow = before.every(x => x.low >= c.low) && after.every(x => x.low >= c.low);

        if (isSwingHigh) {
            state.swingHighs.push({ price: c.high, time: c.time, idx: checkIdx });
            state.swingHighs = state.swingHighs.slice(-20);
        }
        if (isSwingLow) {
            state.swingLows.push({ price: c.low, time: c.time, idx: checkIdx });
            state.swingLows = state.swingLows.slice(-20);
        }
    }

    private detectFVGs(state: MarketState): void {
        const n = state.candles.length;
        const [c0, c1, c2] = [state.candles[n - 3], state.candles[n - 2], state.candles[n - 1]];

        // Bullish FVG
        if (c2.low > c0.high) {
            const size = c2.low - c0.high;
            if (size >= c1.close * 0.0003) {
                state.fvgs.push({
                    id: `fvg-bull-${c2.time}`,
                    type: 'bullish',
                    top: c2.low,
                    bottom: c0.high,
                    midpoint: (c2.low + c0.high) / 2,
                    formedAt: c2.time,
                    filled: false,
                    partialFill: 0,
                });
            }
        }

        // Bearish FVG
        if (c2.high < c0.low) {
            const size = c0.low - c2.high;
            if (size >= c1.close * 0.0003) {
                state.fvgs.push({
                    id: `fvg-bear-${c2.time}`,
                    type: 'bearish',
                    top: c0.low,
                    bottom: c2.high,
                    midpoint: (c0.low + c2.high) / 2,
                    formedAt: c2.time,
                    filled: false,
                    partialFill: 0,
                });
            }
        }
        state.fvgs = state.fvgs.filter(f => !f.filled).slice(-50);
    }

    private detectOrderBlocks(state: MarketState): void {
        const n = state.candles.length;
        if (n < 4) return;
        const c = state.candles[n - 1];
        const prev3 = state.candles.slice(n - 4, n - 1);
        const avgBody = state.candles.slice(-10).reduce((s, x) => s + Math.abs(x.close - x.open), 0) / 10;
        const displacement = Math.abs(c.close - c.open) > avgBody * 1.5;

        if (displacement && c.close > c.open) {
            const lastBearish = [...prev3].reverse().find(x => x.close < x.open);
            if (lastBearish) {
                state.orderBlocks.push({
                    id: `ob-bull-${lastBearish.time}`,
                    type: 'bullish',
                    top: Math.max(lastBearish.open, lastBearish.close),
                    bottom: Math.min(lastBearish.open, lastBearish.close),
                    formedAt: lastBearish.time,
                    broken: false,
                    strength: 'fresh',
                });
            }
        }
        if (displacement && c.close < c.open) {
            const lastBullish = [...prev3].reverse().find(x => x.close > x.open);
            if (lastBullish) {
                state.orderBlocks.push({
                    id: `ob-bear-${lastBullish.time}`,
                    type: 'bearish',
                    top: Math.max(lastBullish.open, lastBullish.close),
                    bottom: Math.min(lastBullish.open, lastBullish.close),
                    formedAt: lastBullish.time,
                    broken: false,
                    strength: 'fresh',
                });
            }
        }
        state.orderBlocks = state.orderBlocks.filter(ob => !ob.broken).slice(-30);
    }

    private updateFVGFills(state: MarketState): void {
        const current = state.candles[state.candles.length - 1];
        for (const fvg of state.fvgs) {
            if (fvg.type === 'bullish') {
                if (current.low <= fvg.top && current.high >= fvg.bottom) {
                    const entryDepth = fvg.top - Math.max(current.low, fvg.bottom);
                    fvg.partialFill = Math.min(1, entryDepth / (fvg.top - fvg.bottom));
                    if (current.low <= fvg.bottom) fvg.filled = true;
                }
            } else {
                if (current.high >= fvg.bottom && current.low <= fvg.top) {
                    const entryDepth = Math.min(current.high, fvg.top) - fvg.bottom;
                    fvg.partialFill = Math.min(1, entryDepth / (fvg.top - fvg.bottom));
                    if (current.high >= fvg.top) fvg.filled = true;
                }
            }
        }
    }

    private updateOBStatus(state: MarketState): void {
        const current = state.candles[state.candles.length - 1];
        for (const ob of state.orderBlocks) {
            if (ob.type === 'bullish' && current.close < ob.bottom) ob.broken = true;
            if (ob.type === 'bearish' && current.close > ob.top) ob.broken = true;
        }
    }

    private checkForNewSweeps(state: MarketState, candle: Candle): void {
        // BSL
        for (const swingH of state.swingHighs.slice(-3)) {
            const closeAbove = candle.close > swingH.price * (1 + SWEEP_CLOSE_TOLERANCE);
            if (closeAbove) {
                const alreadyPending = state.pendingSweeps.some(p => p.type === 'BSL' && Math.abs(p.sweptLevel - swingH.price) / swingH.price < 0.002);
                if (!alreadyPending) {
                    state.pendingSweeps.push({
                        type: 'BSL',
                        sweptLevel: swingH.price,
                        sweepCandle: candle,
                        sweepCloseDistance: (candle.close - swingH.price) / swingH.price,
                        barsElapsed: 0,
                        liqBacking: this.getLiqBacking(swingH.price, 'BSL'),
                    });
                }
            }
        }

        // SSL
        for (const swingL of state.swingLows.slice(-3)) {
            const closeBelow = candle.close < swingL.price * (1 - SWEEP_CLOSE_TOLERANCE);
            if (closeBelow) {
                const alreadyPending = state.pendingSweeps.some(p => p.type === 'SSL' && Math.abs(p.sweptLevel - swingL.price) / swingL.price < 0.002);
                if (!alreadyPending) {
                    state.pendingSweeps.push({
                        type: 'SSL',
                        sweptLevel: swingL.price,
                        sweepCandle: candle,
                        sweepCloseDistance: (swingL.price - candle.close) / swingL.price,
                        barsElapsed: 0,
                        liqBacking: this.getLiqBacking(swingL.price, 'SSL'),
                    });
                }
            }
        }
    }

    private tickPendingSweeps(state: MarketState, candle: Candle): void {
        const toRemove: number[] = [];
        state.pendingSweeps.forEach((pending, idx) => {
            pending.barsElapsed++;
            if (pending.barsElapsed > SWEEP_REVERSAL_BARS) {
                toRemove.push(idx);
                return;
            }

            if (pending.type === 'BSL') {
                if (candle.close < pending.sweptLevel * (1 - SWEEP_REVERSAL_CLOSE)) {
                    this.confirmSweep(state, pending, candle);
                    toRemove.push(idx);
                }
            } else {
                if (candle.close > pending.sweptLevel * (1 + SWEEP_REVERSAL_CLOSE)) {
                    this.confirmSweep(state, pending, candle);
                    toRemove.push(idx);
                }
            }
        });
        state.pendingSweeps = state.pendingSweeps.filter((_, i) => !toRemove.includes(i));
    }

    private confirmSweep(state: MarketState, pending: PendingSweep, reversalCandle: Candle): void {
        const confidence = this.scoreConfidence(pending);
        const sweep: ConfirmedSweep = {
            id: `sweep-${pending.type}-${reversalCandle.time}`,
            type: pending.type,
            sweptLevel: pending.sweptLevel,
            sweepCandle: pending.sweepCandle,
            reversalCandle,
            sweepCloseDistance: pending.sweepCloseDistance,
            reversalBars: pending.barsElapsed,
            liqBacking: pending.liqBacking,
            confidence,
        };

        state.confirmedSweeps.push(sweep);
        if (state.confirmedSweeps.length > 20) state.confirmedSweeps.shift();

        const dir = pending.type === 'BSL' ? 'BEARISH' : 'BULLISH';
        const liqStr = sweep.liqBacking?.isSignificant ? ` [$${(sweep.liqBacking.usdAtLevel / 1e6).toFixed(1)}M liq]` : '';
        const confStr = confidence === 'high' ? '🔴' : confidence === 'medium' ? '🟡' : '🟢';

        clientHub.broadcast('alerts' as any, {
            id: sweep.id,
            time: Date.now(),
            type: 'LIQ_SWEEP',
            severity: confidence === 'high' ? 'critical' : 'warn',
            message: `${confStr} ${pending.type} Sweep @ $${pending.sweptLevel.toFixed(0)}${liqStr} — ${pending.barsElapsed}bar reversal`,
            price: reversalCandle.close,
            direction: dir,
            sweep,
        });

        clientHub.broadcast('ict.sweep_confirmed' as any, sweep);
    }

    private scoreConfidence(pending: PendingSweep): 'high' | 'medium' | 'low' {
        let score = 0;
        if (pending.barsElapsed === 1) score += 3;
        else if (pending.barsElapsed === 2) score += 2;
        else score += 1;

        if (pending.liqBacking?.isSignificant) score += 3;
        else if (pending.liqBacking && pending.liqBacking.usdAtLevel > 100_000) score += 1;

        if (pending.sweepCloseDistance > 0.003) score += 2;
        else if (pending.sweepCloseDistance > 0.001) score += 1;

        if (score >= 6) return 'high';
        if (score >= 3) return 'medium';
        return 'low';
    }

    private getLiqBacking(level: number, type: 'BSL' | 'SSL'): LiqBacking | null {
        if (!this.liqHeatmap || this.liqHeatmap.length === 0) return null;
        const tolerance = level * 0.005;
        const nearby = this.liqHeatmap.filter((e: any) => Math.abs(e.price - level) <= tolerance);
        if (nearby.length === 0) return null;

        const total = nearby.reduce((s, e) => s + e.total, 0);
        const longLiq = nearby.reduce((s, e) => s + (e.long_liq_usd || 0), 0);
        const shortLiq = nearby.reduce((s, e) => s + (e.short_liq_usd || 0), 0);

        return {
            usdAtLevel: total,
            longLiqUsd: longLiq,
            shortLiqUsd: shortLiq,
            isSignificant: type === 'BSL' ? longLiq >= MIN_LIQ_BACKING_USD : shortLiq >= MIN_LIQ_BACKING_USD,
        };
    }

    private broadcast(symbol: string, interval: string, state: MarketState): void {
        const payload = {
            fvgs: state.fvgs.filter(f => !f.filled),
            orderBlocks: state.orderBlocks,
            sweeps: state.confirmedSweeps.slice(-10),
            swingHighs: state.swingHighs,
            swingLows: state.swingLows,
        };
        const topic = `ict.data.${symbol.toUpperCase()}.${interval}`;
        clientHub.broadcast(topic as any, payload);
        redis.set(topic, JSON.stringify(payload), 'EX', 120).catch((err: any) => logger.error({ err }, 'Failed to cache ICT data'));
    }

    getSweeps(symbol: string, interval: string): ConfirmedSweep[] {
        return this.getOrCreateState(symbol, interval).confirmedSweeps;
    }

    getState(symbol: string, interval: string) {
        const state = this.getOrCreateState(symbol, interval);
        return {
            fvgs: state.fvgs,
            orderBlocks: state.orderBlocks,
            sweeps: state.confirmedSweeps,
        };
    }
}

export const ictEngine = new PreciseIctEngine();
