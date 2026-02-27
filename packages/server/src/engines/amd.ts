/**
 * AMD Reversal Detector — Accumulation-Manipulation-Distribution
 *
 * State machine that detects AMD setups in real-time candle data.
 * Fires alerts through the existing alerts engine when high-probability
 * reversals are detected.
 *
 * Based on the user's refined pseudocode with:
 * - RSI divergence + volume divergence checks
 * - Phase timeout & cooldown guards
 * - Invalidation buffer (clean breakout aborts setup)
 */

import { logger } from '../logger.js';
import { clientHub } from '../ws/client-hub.js';

// ── Types ──────────────────────────────────────────────────

interface CandleInput {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

type Phase = 'SEARCHING' | 'ACCUMULATING' | 'MANIPULATING';
type Direction = 'BULLISH' | 'BEARISH' | null;

// ── Constants ──────────────────────────────────────────────

const CONSOLIDATION_THRESHOLD = 0.015;        // range < 1.5% = tight
const RSI_DIVERGENCE_THRESHOLD = 5;
const VOL_DIVERGENCE_RATIO = 0.7;
const VOL_SPIKE_ZSCORE = 1.5;
const PHASE_TIMEOUT_MS = 4 * 60 * 60 * 1000;  // 4 hours
const ALARM_COOLDOWN_MS = 15 * 60 * 1000;     // 15 min
const INVALIDATION_BUFFER = 0.003;            // 0.3%
const RSI_PERIOD = 14;
const LOOKBACK = 20;

// ── Helpers ────────────────────────────────────────────────

function calcRSI(candles: CandleInput[], period: number = RSI_PERIOD): number {
    if (candles.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;
    const slice = candles.slice(-period - 1);

    for (let i = 1; i < slice.length; i++) {
        const diff = slice[i].close - slice[i - 1].close;
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function avgVolume(candles: CandleInput[], n: number): number {
    const slice = candles.slice(-n);
    if (slice.length === 0) return 0;
    return slice.reduce((s, c) => s + c.volume, 0) / slice.length;
}

function volumeZScore(volume: number, candles: CandleInput[], lookback: number = 20): number {
    const vols = candles.slice(-lookback).map(c => c.volume);
    if (vols.length < 3) return 0;
    const mean = vols.reduce((a, b) => a + b, 0) / vols.length;
    const stdDev = Math.sqrt(vols.reduce((s, v) => s + (v - mean) ** 2, 0) / vols.length);
    if (stdDev === 0) return 0;
    return (volume - mean) / stdDev;
}

function highest(candles: CandleInput[]): number {
    return Math.max(...candles.map(c => c.high));
}

function lowest(candles: CandleInput[]): number {
    return Math.min(...candles.map(c => c.low));
}

// ── AMD Engine class ───────────────────────────────────────

class AMDReversalDetector {
    private phase: Phase = 'SEARCHING';
    private accumHigh: number | null = null;
    private accumLow: number | null = null;
    private direction: Direction = null;
    private phaseEnteredAt: number | null = null;
    private lastAlarmAt: number | null = null;
    private candles: CandleInput[] = [];

    /**
     * Feed a new candle into the detector.
     * Called by the binance candle stream on each candle close.
     */
    onCandle(candle: CandleInput): void {
        this.candles.push(candle);
        if (this.candles.length > 200) {
            this.candles = this.candles.slice(-200);
        }

        if (this.candles.length < LOOKBACK + RSI_PERIOD) return;

        this.detect(candle);
    }

    private detect(current: CandleInput): void {
        const price = current.close;

        // Timeout guard
        if (this.phaseTimedOut()) {
            this.reset();
            return;
        }

        switch (this.phase) {
            case 'SEARCHING':
                this.phaseSearch(price);
                break;
            case 'ACCUMULATING':
                this.phaseAccumulate(price, current);
                break;
            case 'MANIPULATING':
                this.phaseManipulate(price, current);
                break;
        }
    }

    // ── PHASE A: Detect Accumulation ────────────────────────

    private phaseSearch(price: number): void {
        const recent = this.candles.slice(-LOOKBACK);
        const rangePct = (highest(recent) - lowest(recent)) / price;

        if (rangePct < CONSOLIDATION_THRESHOLD) {
            this.phase = 'ACCUMULATING';
            this.accumHigh = highest(recent);
            this.accumLow = lowest(recent);
            this.phaseEnteredAt = Date.now();
            logger.debug({ accumHigh: this.accumHigh, accumLow: this.accumLow },
                'AMD: Accumulation range detected');
        }
    }

    // ── PHASE B: Detect Manipulation (Sweep) ────────────────

    private phaseAccumulate(price: number, candle: CandleInput): void {
        if (this.isInvalidated(price)) {
            this.reset();
            return;
        }

        if (price > this.accumHigh! && this.isMomentumWeakening('up')) {
            this.phase = 'MANIPULATING';
            this.direction = 'BEARISH';
            this.phaseEnteredAt = Date.now();
            logger.debug('AMD: Upside sweep detected → watching for bearish reversal');
        } else if (price < this.accumLow! && this.isMomentumWeakening('down')) {
            this.phase = 'MANIPULATING';
            this.direction = 'BULLISH';
            this.phaseEnteredAt = Date.now();
            logger.debug('AMD: Downside sweep detected → watching for bullish reversal');
        }
    }

    // ── PHASE C: Detect Distribution / Reversal ─────────────

    private phaseManipulate(price: number, candle: CandleInput): void {
        if (this.isInvalidated(price)) {
            this.reset();
            return;
        }

        if (this.isReentryConfirmed(price, candle)) {
            if (!this.cooldownActive()) {
                this.fireAlarm();
                this.lastAlarmAt = Date.now();
            }
            this.reset();
        }
    }

    // ── Helper checks ──────────────────────────────────────

    private isMomentumWeakening(sweepDir: 'up' | 'down'): boolean {
        const rsiNow = calcRSI(this.candles);
        const rsiPrev = calcRSI(this.candles.slice(0, -3));

        const rsiDiverging = sweepDir === 'up'
            ? rsiNow < rsiPrev - RSI_DIVERGENCE_THRESHOLD
            : rsiNow > rsiPrev + RSI_DIVERGENCE_THRESHOLD;

        const volumeFading = this.candles[this.candles.length - 1].volume
            < avgVolume(this.candles, 10) * VOL_DIVERGENCE_RATIO;

        return rsiDiverging && volumeFading;
    }

    private isReentryConfirmed(price: number, candle: CandleInput): boolean {
        const insideRange = price > this.accumLow! && price < this.accumHigh!;
        const volZ = volumeZScore(candle.volume, this.candles, LOOKBACK);
        return insideRange && volZ >= VOL_SPIKE_ZSCORE;
    }

    private isInvalidated(price: number): boolean {
        if (!this.accumHigh || !this.accumLow) return false;
        const blewAbove = price > this.accumHigh * (1 + INVALIDATION_BUFFER);
        const blewBelow = price < this.accumLow * (1 - INVALIDATION_BUFFER);
        return blewAbove || blewBelow;
    }

    private phaseTimedOut(): boolean {
        if (!this.phaseEnteredAt) return false;
        return Date.now() - this.phaseEnteredAt > PHASE_TIMEOUT_MS;
    }

    private cooldownActive(): boolean {
        if (!this.lastAlarmAt) return false;
        return Date.now() - this.lastAlarmAt < ALARM_COOLDOWN_MS;
    }

    private fireAlarm(): void {
        const dir = this.direction!;
        const msg = `AMD ${dir} Reversal — Range [$${this.accumLow!.toFixed(0)}–$${this.accumHigh!.toFixed(0)}]`;

        logger.info({ direction: dir, accumLow: this.accumLow, accumHigh: this.accumHigh },
            'AMD REVERSAL DETECTED');

        // Push alert through existing alerts channel
        clientHub.broadcast('alerts' as any, {
            id: `amd-${Date.now()}`,
            time: Date.now(),
            type: 'AMD',
            severity: 'critical',
            message: msg,
            price: this.candles[this.candles.length - 1]?.close,
            direction: dir,
        });
    }

    private reset(): void {
        this.phase = 'SEARCHING';
        this.accumHigh = null;
        this.accumLow = null;
        this.direction = null;
        this.phaseEnteredAt = null;
    }

    getState() {
        return {
            phase: this.phase,
            accumHigh: this.accumHigh,
            accumLow: this.accumLow,
            direction: this.direction,
        };
    }
}

export const amdDetector = new AMDReversalDetector();
