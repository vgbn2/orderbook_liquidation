import { IChartApi } from 'lightweight-charts';
import { CandleData } from '../../../types';
import { vwapIndicator } from './vwap';
import { cvdIndicator } from './cvd';
import { deltaIndicator } from './delta';
import { rsiIndicator } from './rsi';
import { macdIndicator } from './macd';
import { volumeIndicator } from './volume';

export const INDICATORS = [
    volumeIndicator,
    vwapIndicator,
    cvdIndicator,
    deltaIndicator,
    rsiIndicator,
    macdIndicator,
];

export function createIndicators(chart: IChartApi) {
    const instances: Record<string, any> = {};
    for (const ind of INDICATORS) {
        instances[ind.key] = ind.create(chart);
    }
    return instances;
}

export function updateIndicators(instances: Record<string, any>, candles: CandleData[], activeIndicators: Set<string>) {
    for (const ind of INDICATORS) {
        const instance = instances[ind.key];
        if (!instance) continue;

        const isActive = activeIndicators.has(ind.key);

        // Update visibility
        if (ind.key === 'macd') {
            instance.line.applyOptions({ visible: isActive });
            instance.signal.applyOptions({ visible: isActive });
            instance.hist.applyOptions({ visible: isActive });
        } else {
            instance.applyOptions({ visible: isActive });
        }

        // Update data if active
        if (isActive) {
            ind.update(instance, candles);
        }
    }
}
