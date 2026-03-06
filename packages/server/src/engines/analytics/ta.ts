import { logger } from '../../logger.js';

// ══════════════════════════════════════════════════════════════
//  Technical Analysis Engine — RSI, SMA, A/D, Divergence
// ══════════════════════════════════════════════════════════════

export interface OHLCV {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// ── RSI (Relative Strength Index) ─────────────────────────────

export function calculateRSI(candles: OHLCV[], period = 14): number[] {
    if (candles.length < period + 1) return [];

    const rsi: number[] = new Array(candles.length).fill(NaN);
    let avgGain = 0;
    let avgLoss = 0;

    // Initial average gain/loss
    for (let i = 1; i <= period; i++) {
        const change = candles[i].close - candles[i - 1].close;
        if (change > 0) avgGain += change;
        else avgLoss += Math.abs(change);
    }
    avgGain /= period;
    avgLoss /= period;

    rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

    // Smoothed RSI
    for (let i = period + 1; i < candles.length; i++) {
        const change = candles[i].close - candles[i - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    }

    return rsi;
}

// ── SMA (Simple Moving Average) ───────────────────────────────

export function calculateSMA(candles: OHLCV[], period: number): number[] {
    if (candles.length < period) return [];

    const sma: number[] = new Array(candles.length).fill(NaN);
    let sum = 0;

    for (let i = 0; i < period; i++) sum += candles[i].close;
    sma[period - 1] = sum / period;

    for (let i = period; i < candles.length; i++) {
        sum += candles[i].close - candles[i - period].close;
        sma[i] = sum / period;
    }

    return sma;
}

// ── SMA Alignment Score ───────────────────────────────────────

export interface SMAAlignment {
    sma20: number;
    sma50: number;
    sma100: number;
    /** -1 to +1. +1 = perfect bull (20>50>100), -1 = perfect bear */
    score: number;
    trend: 'strong_bull' | 'bull' | 'neutral' | 'bear' | 'strong_bear';
}

export function getSMAAlignment(candles: OHLCV[]): SMAAlignment | null {
    const s20 = calculateSMA(candles, 20);
    const s50 = calculateSMA(candles, 50);
    const s100 = calculateSMA(candles, 100);

    const last = candles.length - 1;
    const sma20 = s20[last];
    const sma50 = s50[last];
    const sma100 = s100[last];

    if (isNaN(sma20) || isNaN(sma50) || isNaN(sma100)) return null;

    let score = 0;
    if (sma20 > sma50) score += 0.33;
    else score -= 0.33;
    if (sma50 > sma100) score += 0.33;
    else score -= 0.33;
    if (candles[last].close > sma20) score += 0.34;
    else score -= 0.34;

    let trend: SMAAlignment['trend'] = 'neutral';
    if (score >= 0.8) trend = 'strong_bull';
    else if (score >= 0.3) trend = 'bull';
    else if (score <= -0.8) trend = 'strong_bear';
    else if (score <= -0.3) trend = 'bear';

    return { sma20, sma50, sma100, score, trend };
}

// ── Accumulation/Distribution ─────────────────────────────────

export function calculateAD(candles: OHLCV[]): number[] {
    const ad: number[] = new Array(candles.length).fill(0);
    let cumulativeAD = 0;

    for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const range = c.high - c.low;
        if (range === 0) {
            ad[i] = cumulativeAD;
            continue;
        }
        // Money Flow Multiplier
        const mfm = ((c.close - c.low) - (c.high - c.close)) / range;
        // Money Flow Volume
        const mfv = mfm * c.volume;
        cumulativeAD += mfv;
        ad[i] = cumulativeAD;
    }

    return ad;
}

// ── Divergence Detection ──────────────────────────────────────

export interface Divergence {
    type: 'bullish' | 'bearish';
    priceDirection: 'higher_high' | 'lower_low';
    indicatorDirection: 'lower_high' | 'higher_low';
    strength: number; // 0-1
}

/**
 * Detect RSI divergence by comparing recent swing highs/lows in price vs RSI.
 */
export function detectRSIDivergence(candles: OHLCV[], lookback = 30): Divergence | null {
    if (candles.length < lookback + 14) return null;

    const rsi = calculateRSI(candles, 14);
    const recent = candles.slice(-lookback);
    const recentRSI = rsi.slice(-lookback);

    // Find the two most recent swing highs and lows
    const swingHighs: Array<{ idx: number; price: number; rsi: number }> = [];
    const swingLows: Array<{ idx: number; price: number; rsi: number }> = [];

    for (let i = 2; i < recent.length - 2; i++) {
        if (recent[i].high > recent[i - 1].high && recent[i].high > recent[i - 2].high &&
            recent[i].high > recent[i + 1].high && recent[i].high > recent[i + 2].high) {
            swingHighs.push({ idx: i, price: recent[i].high, rsi: recentRSI[i] });
        }
        if (recent[i].low < recent[i - 1].low && recent[i].low < recent[i - 2].low &&
            recent[i].low < recent[i + 1].low && recent[i].low < recent[i + 2].low) {
            swingLows.push({ idx: i, price: recent[i].low, rsi: recentRSI[i] });
        }
    }

    // Bearish Divergence: Price makes higher high, RSI makes lower high
    if (swingHighs.length >= 2) {
        const [prev, curr] = swingHighs.slice(-2);
        if (!isNaN(prev.rsi) && !isNaN(curr.rsi)) {
            if (curr.price > prev.price && curr.rsi < prev.rsi) {
                const strength = Math.min(1, (prev.rsi - curr.rsi) / 20);
                return {
                    type: 'bearish',
                    priceDirection: 'higher_high',
                    indicatorDirection: 'lower_high',
                    strength,
                };
            }
        }
    }

    // Bullish Divergence: Price makes lower low, RSI makes higher low
    if (swingLows.length >= 2) {
        const [prev, curr] = swingLows.slice(-2);
        if (!isNaN(prev.rsi) && !isNaN(curr.rsi)) {
            if (curr.price < prev.price && curr.rsi > prev.rsi) {
                const strength = Math.min(1, (curr.rsi - prev.rsi) / 20);
                return {
                    type: 'bullish',
                    priceDirection: 'lower_low',
                    indicatorDirection: 'higher_low',
                    strength,
                };
            }
        }
    }

    return null;
}

// ── Full TA Snapshot ──────────────────────────────────────────

export interface TASnapshot {
    rsi: number;
    smaAlignment: SMAAlignment | null;
    adTrend: 'accumulation' | 'distribution' | 'neutral';
    divergence: Divergence | null;
    htfRSI?: { weekly: number; monthly: number };
    /** -10 to +10 overall TA score */
    score: number;
}

export function computeTASnapshot(candles: OHLCV[], htfWeeklyRSI?: number, htfMonthlyRSI?: number): TASnapshot | null {
    if (candles.length < 100) {
        logger.debug('TA: Insufficient candles for full analysis');
        return null;
    }

    const rsiArr = calculateRSI(candles, 14);
    const rsi = rsiArr[rsiArr.length - 1];
    if (isNaN(rsi)) return null;

    const smaAlignment = getSMAAlignment(candles);
    const ad = calculateAD(candles);
    const divergence = detectRSIDivergence(candles);

    // A/D Trend: compare last 10 A/D values
    const adRecent = ad.slice(-10);
    const adFirst = adRecent[0];
    const adLast = adRecent[adRecent.length - 1];
    const adTrend = adLast > adFirst * 1.02 ? 'accumulation' as const
        : adLast < adFirst * 0.98 ? 'distribution' as const
            : 'neutral' as const;

    // ── Scoring (-10 to +10) ──────────────────────────────────

    let score = 0;

    // RSI component (-3 to +3)
    if (rsi < 30) score += 3;         // Oversold = bullish
    else if (rsi < 40) score += 1.5;
    else if (rsi > 70) score -= 3;    // Overbought = bearish
    else if (rsi > 60) score -= 1.5;

    // SMA alignment (-3 to +3)
    if (smaAlignment) score += smaAlignment.score * 3;

    // A/D trend (-2 to +2)
    if (adTrend === 'accumulation') score += 2;
    else if (adTrend === 'distribution') score -= 2;

    // Divergence (-2 to +2)
    if (divergence) {
        const divScore = divergence.strength * 2;
        score += divergence.type === 'bullish' ? divScore : -divScore;
    }

    // Clamp to -10 to +10
    score = Math.max(-10, Math.min(10, score));

    return {
        rsi,
        smaAlignment,
        adTrend,
        divergence,
        htfRSI: htfWeeklyRSI != null && htfMonthlyRSI != null
            ? { weekly: htfWeeklyRSI, monthly: htfMonthlyRSI }
            : undefined,
        score,
    };
}
