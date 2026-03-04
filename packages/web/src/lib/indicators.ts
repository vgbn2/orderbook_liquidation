/**
 * Shared mathematical indicator calculations.
 */

export function calculateSMA(data: number[], period: number): number[] {
    const res: number[] = new Array(data.length).fill(0);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i];
        if (i >= period) {
            sum -= data[i - period];
            res[i] = sum / period;
        } else {
            res[i] = sum / (i + 1);
        }
    }
    return res;
}

export function calculateEMA(data: number[], period: number): number[] {
    const res: number[] = new Array(data.length).fill(0);
    if (!data.length) return res;
    const k = 2 / (period + 1);
    let ema = data[0];
    res[0] = ema;
    for (let i = 1; i < data.length; i++) {
        ema = (data[i] * k) + (ema * (1 - k));
        res[i] = ema;
    }
    return res;
}

export function calculateRSI(data: number[], period: number): number[] {
    const res: number[] = new Array(data.length).fill(50);
    if (data.length <= period) return res;

    let gains = 0, losses = 0;

    // First RSI value (standard average)
    for (let i = 1; i <= period; i++) {
        const diff = data[i] - data[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Subsequent values (smoothed/Wilder's)
    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        const gain = diff >= 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;

        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;

        if (avgLoss === 0) res[i] = 100;
        else {
            const rs = avgGain / avgLoss;
            res[i] = 100 - (100 / (1 + rs));
        }
    }
    return res;
}

export function calculateMACD(data: number[], fast: number = 12, slow: number = SlowMACDDefault, signal: number = 9) {
    const fastEma = calculateEMA(data, fast);
    const slowEma = calculateEMA(data, slow);
    const macdLine = fastEma.map((f, i) => f - slowEma[i]);
    const signalLine = calculateEMA(macdLine, signal);
    const histogram = macdLine.map((m, i) => m - signalLine[i]);

    return { macdLine, signalLine, histogram };
}

const SlowMACDDefault = 26;
