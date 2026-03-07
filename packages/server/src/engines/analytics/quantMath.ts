import bindings from 'bindings';

const core = bindings('terminus_core');

// ── Gaussian PDF ──────────────────────────────────────────────────────────
export function normalPdf(x: number): number {
    return core.normalPdf(x);
}

// ── Gaussian CDF (using error function approximation) ─────────────────────
export function normalCdf(x: number): number {
    return core.normalCdf(x);
}

// ── Gaussian PPF (Inverse CDF based on rational approximation) ────────────
export function normalPpf(p: number): number {
    return core.normalPpf(p);
}

// ── 1D Kalman Filter ──────────────────────────────────────────────────────
export function kalman1D(prices: number[], R: number = 0.1, Q: number = 0.001): number[] {
    if (prices.length === 0) return [];
    // Convert to TypedArray for zero-copy N-API transfer
    const input = new Float64Array(prices);
    const output = core.kalman1D(input, R, Q);
    return Array.from(output);
}

// ── Array Math Helpers ────────────────────────────────────────────────────
export function sum(arr: number[]): number {
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return s;
}

export function mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return sum(arr) / arr.length;
}

export function stdDev(arr: number[], isSample = true): number {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    let devSq = 0;
    for (let i = 0; i < arr.length; i++) {
        devSq += Math.pow(arr[i] - m, 2);
    }
    return Math.sqrt(devSq / (arr.length - (isSample ? 1 : 0)));
}

export function logReturns(prices: number[]): number[] {
    const returns: number[] = new Array(prices.length - 1);
    for (let i = 1; i < prices.length; i++) {
        returns[i - 1] = Math.log(prices[i] / prices[i - 1]);
    }
    return returns;
}

// ── Pearson Correlation ───────────────────────────────────────────────────
export function pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const inputX = new Float64Array(x.slice(0, n));
    const inputY = new Float64Array(y.slice(0, n));
    return core.pearsonCorrelation(inputX, inputY);
}

// ── Z-Score ───────────────────────────────────────────────────────────────
export function zScore(val: number, arr: number[]): number {
    const s = stdDev(arr);
    if (s === 0) return 0;
    return (val - mean(arr)) / s;
}

// ── Linear Regression (polyfit deg=1) ─────────────────────────────────────
export function linearRegressionSlope(y: number[]): number {
    const n = y.length;
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += y[i];
        sumXY += i * y[i];
        sumX2 += i * i;
    }

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

// ── Core Analytics Engine ─────────────────────────────────────────────────
export interface MacroPrices {
    [ticker: string]: number[];
}

export function computeQuantAnalytics(symbol: string, prices: number[], dates: string[], macroPrices: MacroPrices) {
    if (prices.length < 30) {
        throw new Error(`Insufficient price data for ${symbol}`);
    }

    const currentPrice = prices[prices.length - 1];

    // 1. Kalman Smoothing
    const kalman = kalman1D(prices, 0.1, 0.001);

    // 2. Correlation & Macro Drag
    const targetReturns = logReturns(prices);
    let totalDrag = 0;
    const macroBreakdown: any[] = [];

    for (const [ticker, mPrices] of Object.entries(macroPrices)) {
        if (mPrices.length < 30) continue;

        const mReturns = logReturns(mPrices);

        // Align lengths
        const minLen = Math.min(targetReturns.length, mReturns.length);
        const tRecent = targetReturns.slice(-minLen);
        const mRecent = mReturns.slice(-minLen);

        // 30-day correlation
        const corrWindow = 30;
        const corr = pearsonCorrelation(
            tRecent.slice(-corrWindow),
            mRecent.slice(-corrWindow)
        );

        // 20-day Z-Score of the macro asset
        const zWindow = 20;
        const recentMacro = mPrices.slice(-zWindow);
        const z = zScore(mPrices[mPrices.length - 1], recentMacro);

        // Macro impact formulation
        const impact = corr * z;
        totalDrag += impact * 0.2; // 0.2 dampening factor

        macroBreakdown.push({
            ticker,
            correlation: Number(corr.toFixed(4)),
            zScore: Number(z.toFixed(4)),
            impact: Number(impact.toFixed(4))
        });
    }

    // 3. Projections & Volatility
    const trendWin = 14;
    const recentKalman = kalman.slice(-trendWin);
    const slope = linearRegressionSlope(recentKalman);
    const baseDrift = slope / currentPrice;
    const adjustedDrift = baseDrift + (totalDrag / 100);

    const volWin = Math.min(targetReturns.length, 30);
    const stepVolatility = stdDev(targetReturns.slice(-volWin));

    const horizon = 14;
    const projections: number[] = [];

    for (let step = 1; step <= horizon; step++) {
        const pathPrice = currentPrice * Math.exp(adjustedDrift * step);
        projections.push(pathPrice);
    }

    // 4. Sigma Grid
    const muTotal = adjustedDrift * horizon;
    const sigmaTotal = stepVolatility * Math.sqrt(horizon);
    const finalProj = projections[projections.length - 1];

    const sigmaGrid: any[] = [];
    for (let sig = -3; sig <= 3.01; sig += 0.5) {
        const target = finalProj * Math.exp(sig * sigmaTotal);
        const pctMove = (target / currentPrice - 1) * 100;

        const zv = sigmaTotal > 0 ? (Math.log(target / currentPrice) - muTotal) / sigmaTotal : 0;
        const prob = target > currentPrice ? (1 - normalCdf(zv)) * 100 : normalCdf(zv) * 100;

        sigmaGrid.push({
            sigma: Number(sig.toFixed(1)),
            price: target,
            probability: Number(prob.toFixed(1)),
            pctMove: (target / currentPrice - 1) * 100
        });
    }

    // 5. Quantiles
    const qLabels = ['p5', 'p25', 'p50', 'p75', 'p95'];
    const qVals = [0.05, 0.25, 0.50, 0.75, 0.95];
    const quantiles: any = {};

    for (let i = 0; i < qLabels.length; i++) {
        const logRet = normalPpf(qVals[i]) * sigmaTotal + muTotal;
        const qPrice = currentPrice * Math.exp(logRet);
        quantiles[qLabels[i]] = {
            price: qPrice,
            pctMove: Number(((qPrice / currentPrice) - 1) * 100)
        };
    }

    return {
        symbol,
        timestamp: Date.now(),
        currentPrice,
        meta: {
            baseDrift: Number((baseDrift * 100).toFixed(6)),
            macroDrag: Number(totalDrag.toFixed(6)),
            adjustedDrift: Number((adjustedDrift * 100).toFixed(6)),
            stepVolatility: Number((stepVolatility * 100).toFixed(4)),
            horizon
        },
        kalman,
        dates,
        projections,
        sigmaGrid,
        quantiles,
        macroBreakdown
    };
}
