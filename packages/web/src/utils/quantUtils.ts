export function gaussian(x: number, mean: number, std: number): number {
    return Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
}

export function computeDirectionalBias(sigmaGrid: any[]) {
    // We already have safe logic in the components, but doing basic fallback here just in case
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
