import { IChartApi, ISeriesApi, LineStyle, Time, SeriesType } from 'lightweight-charts';
import { CandleData } from '../../../types';

export interface IndicatorModule<T extends SeriesType = any> {
    key: string;
    create: (chart: IChartApi) => ISeriesApi<T>;
    update: (series: ISeriesApi<T>, candles: CandleData[]) => void;
}

/**
 * VWAP Indicator
 */
export const vwapIndicator: IndicatorModule<'Line'> = {
    key: 'vwap',
    create: (chart) => chart.addLineSeries({
        color: '#a855f7',
        lineWidth: 2,
        lineStyle: LineStyle.Dotted,
        visible: false,
        title: 'VWAP'
    }),
    update: (series, candles) => {
        const data = candles
            .filter(c => c.vwap != null)
            .map(c => ({ time: c.time as Time, value: c.vwap! }));
        series.setData(data);
    }
};
