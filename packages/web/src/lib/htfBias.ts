import { CandleData, HTFBias } from '../stores/marketStore';

export function computeHTFBias(candles: CandleData[]): HTFBias | null {
    if (candles.length < 50) return null;

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const current = closes[closes.length - 1];

    // Math utils
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    function calcEMA(data: number[], period: number): number {
        const k = 2 / (period + 1);
        let ema = data[0];
        for (let i = 1; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }
        return ema;
    }

    function calcRSI(data: number[], period: number): number {
        if (data.length <= period) return 50;
        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const diff = data[i] - data[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        for (let i = period + 1; i < data.length; i++) {
            const diff = data[i] - data[i - 1];
            if (diff >= 0) {
                avgGain = (avgGain * (period - 1) + diff) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) - diff) / period;
            }
        }

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    // Indicators
    const sma20 = avg(closes.slice(-20));
    const sma50 = avg(closes.slice(-50));
    const ema200 = closes.length >= 200 ? calcEMA(closes, 200) : sma50;
    const rsi14 = calcRSI(closes, 14);

    const aboveSma50 = current > sma50;
    const aboveSma200 = current > ema200;

    // HTF direction
    let bullCount = 0;
    let bearCount = 0;
    if (current > sma20) bullCount++; else bearCount++;
    if (current > sma50) bullCount++; else bearCount++;
    if (current > ema200) bullCount++; else bearCount++;
    if (rsi14 > 50) bullCount++; else bearCount++;

    const direction: 'bullish' | 'bearish' | 'neutral' =
        bullCount >= 3 ? 'bullish' :
            bearCount >= 3 ? 'bearish' : 'neutral';

    // Swing structure
    let lastSwingHigh = Math.max(...highs.slice(-20));
    let lastSwingLow = Math.min(...lows.slice(-20));

    for (let i = candles.length - 10; i >= 3; i--) {
        if (highs[i] > highs[i - 2] && highs[i] > highs[i - 1] &&
            highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
            lastSwingHigh = highs[i];
            break;
        }
    }

    for (let i = candles.length - 10; i >= 3; i--) {
        if (lows[i] < lows[i - 2] && lows[i] < lows[i - 1] &&
            lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
            lastSwingLow = lows[i];
            break;
        }
    }

    // Premium/Discount
    const periodHigh = Math.max(...highs.slice(-20));
    const periodLow = Math.min(...lows.slice(-20));
    const rangePosition = periodHigh === periodLow ? 0.5 : (current - periodLow) / (periodHigh - periodLow);

    return {
        direction,
        aboveSma50,
        aboveSma200,
        lastSwingHigh,
        lastSwingLow,
        sma20,
        sma50,
        ema200,
        rsi14,
        rangePosition,
        isPremium: rangePosition > 0.618,
        isDiscount: rangePosition < 0.382,
    };
}
