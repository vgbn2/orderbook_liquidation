import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, Time } from 'lightweight-charts';

interface Props {
    data: { time: number; value: number }[];
}


export function DrawdownChart({ data }: Props) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#B2B5BE',
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
            },
            rightPriceScale: {
                borderVisible: false,
            },
            timeScale: {
                borderVisible: false,
                timeVisible: true,
            },
            crosshair: {
                mode: 0, // Normal
            },
            handleScroll: false,
            handleScale: false,
        });

        const areaSeries = chart.addAreaSeries({
            lineColor: '#ff3b5c',
            topColor: 'rgba(255, 59, 92, 0.4)',
            bottomColor: 'rgba(255, 59, 92, 0.0)',
            lineWidth: 2,
        });

        chartRef.current = chart;
        seriesRef.current = areaSeries;

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []);

    useEffect(() => {
        if (seriesRef.current && data.length > 0) {
            // Data time is already in seconds (Unix timestamp)
            const formattedData = data.map(d => ({
                time: d.time as Time,
                value: d.value
            }));
            seriesRef.current.setData(formattedData);
            chartRef.current?.timeScale().fitContent();
        }
    }, [data]);

    return (
        <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
    );
}
