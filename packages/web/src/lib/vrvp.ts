import { CandleData } from '../stores/marketStore';

export interface VRVPRow {
    priceLow: number;
    priceHigh: number;
    priceMid: number;
    volume: number;
    buyVolume: number;
    sellVolume: number;
    isPOC: boolean;
    isVAH: boolean;
    isVAL: boolean;
    isHVN: boolean;
    isLVN: boolean;
}

export interface VRVPProfile {
    rows: VRVPRow[];
    poc: number;
    vah: number;
    val: number;
    valueAreaPct: number;
    maxVolume: number;
    hvns: number[];
    lvns: number[];
    priceStep: number;
}

export function computeVRVP(
    candles: CandleData[],
    rowCount = 100,
    valueAreaPct = 0.70
): VRVPProfile | null {
    if (candles.length < 2) return null;

    const prices = candles.flatMap(c => [c.high, c.low]);
    const priceMin = Math.min(...prices);
    const priceMax = Math.max(...prices);
    const priceStep = (priceMax - priceMin) / rowCount;

    if (priceStep <= 0) return null;

    const buckets: VRVPRow[] = Array.from({ length: rowCount }, (_, i) => ({
        priceLow: priceMin + i * priceStep,
        priceHigh: priceMin + (i + 1) * priceStep,
        priceMid: priceMin + (i + 0.5) * priceStep,
        volume: 0, buyVolume: 0, sellVolume: 0,
        isPOC: false, isVAH: false, isVAL: false, isHVN: false, isLVN: false
    }));

    for (const candle of candles) {
        const candleRange = candle.high - candle.low;
        if (candleRange <= 0) continue;

        const isBullish = candle.close >= candle.open;
        const volPerPrice = candle.volume / (candleRange / priceStep);

        for (const bucket of buckets) {
            const overlap = Math.min(candle.high, bucket.priceHigh) - Math.max(candle.low, bucket.priceLow);
            if (overlap > 0) {
                const vol = volPerPrice * (overlap / priceStep);
                bucket.volume += vol;
                if (isBullish) {
                    bucket.buyVolume += vol * 0.7;
                    bucket.sellVolume += vol * 0.3;
                } else {
                    bucket.buyVolume += vol * 0.3;
                    bucket.sellVolume += vol * 0.7;
                }
            }
        }
    }

    const totalVolume = buckets.reduce((s, b) => s + b.volume, 0);
    if (totalVolume === 0) return null;

    const pocBucket = buckets.reduce((best, b) => b.volume > best.volume ? b : best);
    pocBucket.isPOC = true;
    const poc = pocBucket.priceMid;

    const pocIdx = buckets.indexOf(pocBucket);
    let vaVolume = pocBucket.volume;
    const target = totalVolume * valueAreaPct;
    let loIdx = pocIdx, hiIdx = pocIdx;

    while (vaVolume < target && (loIdx > 0 || hiIdx < buckets.length - 1)) {
        const volBelow = loIdx > 0 ? buckets[loIdx - 1].volume : 0;
        const volAbove = hiIdx < buckets.length - 1 ? buckets[hiIdx + 1].volume : 0;

        if (volAbove >= volBelow && hiIdx < buckets.length - 1) {
            hiIdx++;
            vaVolume += buckets[hiIdx].volume;
        } else if (loIdx > 0) {
            loIdx--;
            vaVolume += buckets[loIdx].volume;
        } else {
            hiIdx++;
            vaVolume += buckets[hiIdx].volume;
        }
    }

    buckets[loIdx].isVAL = true;
    buckets[hiIdx].isVAH = true;

    const windowSize = Math.max(3, Math.floor(rowCount / 20));
    const maxVol = Math.max(...buckets.map(b => b.volume));
    const hvns: number[] = [];
    const lvns: number[] = [];

    for (let i = windowSize; i < buckets.length - windowSize; i++) {
        const neighborhood = buckets.slice(i - windowSize, i + windowSize + 1);
        const avgNeighbor = neighborhood.reduce((s, b) => s + b.volume, 0) / neighborhood.length;

        if (buckets[i].volume > avgNeighbor * 1.5 && buckets[i].volume > maxVol * 0.1) {
            buckets[i].isHVN = true;
            hvns.push(buckets[i].priceMid);
        }
        if (buckets[i].volume < avgNeighbor * 0.5 && buckets[i].volume < maxVol * 0.05) {
            buckets[i].isLVN = true;
            lvns.push(buckets[i].priceMid);
        }
    }

    return {
        rows: buckets,
        poc, vah: buckets[hiIdx].priceMid, val: buckets[loIdx].priceMid,
        valueAreaPct,
        maxVolume: maxVol,
        hvns, lvns,
        priceStep,
    };
}
