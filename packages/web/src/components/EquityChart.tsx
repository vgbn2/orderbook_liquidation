import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, Time, ColorType } from 'lightweight-charts';
import { BacktestResult } from '../lib/backtester';

interface EquityChartProps {
    result: BacktestResult;
    height?: number;
}

export function EquityChart({ result, height = 200 }: EquityChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const strategySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const bahSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: height,
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#6b6b80',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
            },
            rightPriceScale: {
                borderVisible: false,
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1,
                },
            },
            timeScale: {
                borderVisible: false,
                timeVisible: true,
                secondsVisible: false,
            },
            handleScroll: true,
            handleScale: true,
        });

        const strategySeries = chart.addLineSeries({
            color: '#00ffc8', // var(--accent-primary)
            lineWidth: 2,
            title: 'Strategy',
            priceFormat: {
                type: 'volume',
            },
        });

        const bahSeries = chart.addLineSeries({
            color: '#ff3b5c', // var(--negative)
            lineWidth: 1,
            lineStyle: 2, // Dashed
            title: 'Buy & Hold',
            priceFormat: {
                type: 'volume',
            },
        });

        chartRef.current = chart;
        strategySeriesRef.current = strategySeries;
        bahSeriesRef.current = bahSeries;

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [height]);

    useEffect(() => {
        if (strategySeriesRef.current && bahSeriesRef.current && result) {
            strategySeriesRef.current.setData(result.equityCurve.map(p => ({ ...p, time: p.time as Time })));
            bahSeriesRef.current.setData(result.bahCurve.map(p => ({ ...p, time: p.time as Time })));
            chartRef.current?.timeScale().fitContent();
        }
    }, [result]);

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            padding: 'var(--space-2)'
        }}>
            <div ref={chartContainerRef} style={{ width: '100%' }} />
            <div style={{
                position: 'absolute',
                top: 'var(--space-2)',
                left: 'var(--space-3)',
                display: 'flex',
                gap: 'var(--space-3)',
                fontSize: '9px',
                pointerEvents: 'none',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: "'JetBrains Mono', monospace"
            }}>
                <span style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '10px', height: '2px', background: 'var(--accent-primary)' }} /> STRATEGY
                </span>
                <span style={{ color: 'var(--negative)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '10px', height: '1px', borderBottom: '1px dashed var(--negative)' }} /> B&H
                </span>
            </div>
        </div>
    );
}

