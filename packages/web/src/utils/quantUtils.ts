/**
 * quantUtils.ts
 * Shared utilities for quantitative analysis and visualization.
 */

export function gaussian(x: number, mean: number, std: number): number {
    return Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
}

export interface RegimeInfo {
    icon: string;
    label: string;
    color: string;
}

/**
 * Classifies the market regime based on drift and volatility.
 */
export function classifyRegime(drift: number, vol: number): RegimeInfo {
    const absDrift = Math.abs(drift);

    // Legacy support for high-vol/drift icons if needed by panels
    if (vol > 3.0 && absDrift > 1.0) return { icon: '🌪️', label: 'BREAKOUT', color: '#ffeb3b' };
    if (vol > 2.0 && absDrift < 0.3) return { icon: '⚡', label: 'CHOP', color: '#6b6b80' };

    if (absDrift < 0.0005 && vol < 0.005) return { icon: '◎', label: 'CRAB', color: '#6b6b80' };

    if (drift > 0) {
        if (absDrift > 0.002) return { icon: '🐂', label: 'BULL_PARABOLIC', color: '#00ffa2' };
        return { icon: '📈', label: 'BULL_ACCUM', color: '#00ffc8' };
    } else {
        if (absDrift > 0.002) return { icon: '🐻', label: 'BEAR_CAPITULATION', color: '#ff2d4e' };
        return { icon: '📉', label: 'BEAR_DIST', color: '#ff5c75' };
    }
}

/**
 * Maps signal grade to color and label.
 */
export function getSignalInfo(signal: number) {
    if (signal > 0.6) return { label: 'STRONG_BUY', color: '#00ffa2' };
    if (signal > 0.2) return { label: 'BUY', color: '#00ffc8' };
    if (signal > -0.2) return { label: 'NEUTRAL', color: '#6b6b80' };
    if (signal > -0.6) return { label: 'SELL', color: '#ff5c75' };
    return { label: 'STRONG_SELL', color: '#ff2d4e' };
}

/**
 * Computes directional bias based on sigma grid.
 */
export function computeDirectionalBias(sigmaGrid: any[]) {
    if (!sigmaGrid || sigmaGrid.length === 0) return null;

    const totalProb = sigmaGrid.reduce((s, r) => s + (r.probability || 0), 0) || 1;
    const expectedMove = sigmaGrid.reduce((s, r) => s + ((r.pctMove || 0) * (r.probability || 0)) / totalProb, 0);
    const bullWeight = sigmaGrid.filter(r => (r.pctMove || 0) >= 0).reduce((s, r) => s + (r.probability || 0), 0);
    const bearWeight = sigmaGrid.filter(r => (r.pctMove || 0) < 0).reduce((s, r) => s + (r.probability || 0), 0);
    const total = bullWeight + bearWeight || 1;
    const bullPct = (bullWeight / total) * 100;
    const bearPct = (bearWeight / total) * 100;
    const direction = expectedMove >= 0 ? 'BULLISH' : 'BEARISH';
    const confidence = Math.abs(bullPct - bearPct);
    const strength = confidence > 20 ? 'STRONG' : confidence > 8 ? 'MODERATE' : 'WEAK';

    return { direction, expectedMove, bullPct, bearPct, confidence, strength };
}
