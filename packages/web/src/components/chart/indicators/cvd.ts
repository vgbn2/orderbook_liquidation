import { ISeriesApi, Time } from 'lightweight-charts';
import { CandleData } from '../../../types';
import { IndicatorModule } from './vwap';

/**
 * Cumulative Volume Delta (CVD)
 */
export const cvdIndicator: IndicatorModule<'Line'> = {
    key: 'cvd',
    create: (chart) => {
        const s = chart.addLineSeries({
            color: '#00b4ff',
            lineWidth: 1,
            priceScaleId: 'cvd',
            visible: false,
            title: 'CVD'
        });
        chart.priceScale('cvd').applyOptions({ scaleMargins: { top: 0.7, bottom: 0.05 } });
        return s;
    },
    update: (series, candles) => {
        const data = candles
            .filter(c => c.cvd != null)
            .map(c => ({ time: c.time as Time, value: c.cvd! }));
        series.setData(data);
    }
};
