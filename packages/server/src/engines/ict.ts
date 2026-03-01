import { logger } from '../logger.js';
import { clientHub } from '../ws/client-hub.js';
import type { Candle } from '../adapters/types.js';

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

export class PreciseIctEngine {
    private candles: Candle[] = [];
    private fvgs: FVG[] = [];
    private orderBlocks: OrderBlock[] = [];
    private swingHighs: { price: number; time: number; idx: number }[] = [];
    private swingLows: { price: number; time: number; idx: number }[] = [];
    private pendingSweeps: PendingSweep[] = [];
    private confirmedSweeps: ConfirmedSweep[] = [];
    private liqHeatmap: any[] = [];
    private lastBroadcast = 0;

    setLiqHeatmap(heatmap: any[]): void {
        this.liqHeatmap = heatmap;
    }

    onCandle(candle: Candle): void {
        this.candles.push(candle);
        if (this.candles.length > 500) this.candles = this.candles.slice(-500);
        if (this.candles.length < SWING_LOOKBACK * 2 + 1) return;

        this.updateSwings();
        this.detectFVGs();
        this.detectOrderBlocks();
        this.updateFVGFills();
        this.updateOBStatus();
        this.checkForNewSweeps(candle);
        this.tickPendingSweeps(candle);

        // Broadcast structural updates periodically
        if (Date.now() - this.lastBroadcast > 30_000) {
            this.lastBroadcast = Date.now();
            this.broadcast();
        }
    }

    private updateSwings(): void {
        const n = this.candles.length;
        const checkIdx = n - SWING_LOOKBACK - 1;
        const c = this.candles[checkIdx];
        const before = this.candles.slice(checkIdx - SWING_LOOKBACK, checkIdx);
        const after = this.candles.slice(checkIdx + 1, checkIdx + SWING_LOOKBACK + 1);

        const isSwingHigh = before.every(x => x.high <= c.high) && after.every(x => x.high <= c.high);
        const isSwingLow = before.every(x => x.low >= c.low) && after.every(x => x.low >= c.low);

        if (isSwingHigh) {
            this.swingHighs.push({ price: c.high, time: c.time, idx: checkIdx });
            this.swingHighs = this.swingHighs.slice(-20);
        }
        if (isSwingLow) {
            this.swingLows.push({ price: c.low, time: c.time, idx: checkIdx });
            this.swingLows = this.swingLows.slice(-20);
        }
    }

    private detectFVGs(): void {
        const n = this.candles.length;
        const [c0, c1, c2] = [this.candles[n - 3], this.candles[n - 2], this.candles[n - 1]];

        // Bullish FVG
        if (c2.low > c0.high) {
            const size = c2.low - c0.high;
            if (size >= c1.close * 0.0003) {
                this.fvgs.push({
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
                this.fvgs.push({
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
        this.fvgs = this.fvgs.filter(f => !f.filled).slice(-50);
    }

    private detectOrderBlocks(): void {
        const n = this.candles.length;
        const c = this.candles[n - 1];
        const prev3 = this.candles.slice(n - 4, n - 1);
        const avgBody = this.candles.slice(-10).reduce((s, x) => s + Math.abs(x.close - x.open), 0) / 10;
        const displacement = Math.abs(c.close - c.open) > avgBody * 1.5;

        if (displacement && c.close > c.open) {
            const lastBearish = [...prev3].reverse().find(x => x.close < x.open);
            if (lastBearish) {
                this.orderBlocks.push({
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
                this.orderBlocks.push({
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
        this.orderBlocks = this.orderBlocks.filter(ob => !ob.broken).slice(-30);
    }

    private updateFVGFills(): void {
        const current = this.candles[this.candles.length - 1];
        for (const fvg of this.fvgs) {
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

    private updateOBStatus(): void {
        const current = this.candles[this.candles.length - 1];
        for (const ob of this.orderBlocks) {
            if (ob.type === 'bullish' && current.close < ob.bottom) ob.broken = true;
            if (ob.type === 'bearish' && current.close > ob.top) ob.broken = true;
        }
    }

    private checkForNewSweeps(candle: Candle): void {
        // BSL
        for (const swingH of this.swingHighs.slice(-3)) {
            const closeAbove = candle.close > swingH.price * (1 + SWEEP_CLOSE_TOLERANCE);
            if (closeAbove) {
                const alreadyPending = this.pendingSweeps.some(p => p.type === 'BSL' && Math.abs(p.sweptLevel - swingH.price) / swingH.price < 0.002);
                if (!alreadyPending) {
                    this.pendingSweeps.push({
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
        for (const swingL of this.swingLows.slice(-3)) {
            const closeBelow = candle.close < swingL.price * (1 - SWEEP_CLOSE_TOLERANCE);
            if (closeBelow) {
                const alreadyPending = this.pendingSweeps.some(p => p.type === 'SSL' && Math.abs(p.sweptLevel - swingL.price) / swingL.price < 0.002);
                if (!alreadyPending) {
                    this.pendingSweeps.push({
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

    private tickPendingSweeps(candle: Candle): void {
        const toRemove: number[] = [];
        this.pendingSweeps.forEach((pending, idx) => {
            pending.barsElapsed++;
            if (pending.barsElapsed > SWEEP_REVERSAL_BARS) {
                toRemove.push(idx);
                return;
            }

            if (pending.type === 'BSL') {
                if (candle.close < pending.sweptLevel * (1 - SWEEP_REVERSAL_CLOSE)) {
                    this.confirmSweep(pending, candle);
                    toRemove.push(idx);
                }
            } else {
                if (candle.close > pending.sweptLevel * (1 + SWEEP_REVERSAL_CLOSE)) {
                    this.confirmSweep(pending, candle);
                    toRemove.push(idx);
                }
            }
        });
        this.pendingSweeps = this.pendingSweeps.filter((_, i) => !toRemove.includes(i));
    }

    private confirmSweep(pending: PendingSweep, reversalCandle: Candle): void {
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

        this.confirmedSweeps.push(sweep);
        if (this.confirmedSweeps.length > 20) this.confirmedSweeps.shift();

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
        const nearby = this.liqHeatmap.filter(e => Math.abs(e.price - level) <= tolerance);
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

    private broadcast(): void {
        clientHub.broadcast('ict.data' as any, {
            fvgs: this.fvgs.filter(f => !f.filled),
            orderBlocks: this.orderBlocks,
            sweeps: this.confirmedSweeps.slice(-10),
            swingHighs: this.swingHighs,
            swingLows: this.swingLows,
        });
    }

    getSweeps(): ConfirmedSweep[] {
        return this.confirmedSweeps;
    }

    getState() {
        return {
            fvgs: this.fvgs,
            orderBlocks: this.orderBlocks,
            sweeps: this.confirmedSweeps,
        };
    }
}

export const ictEngine = new PreciseIctEngine();
