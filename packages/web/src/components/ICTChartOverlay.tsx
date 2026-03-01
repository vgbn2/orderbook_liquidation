import { useMarketStore } from '../stores/marketStore';

interface Props {
    visibleFVGs: boolean;
    visibleOBs: boolean;
    visibleSweeps: boolean;
    yScale: (val: number) => number;
    xScale: (time: number) => number;
    chartWidth: number;
}

export function ICTChartOverlay({ visibleFVGs, visibleOBs, visibleSweeps, yScale, xScale, chartWidth }: Props) {
    const { ictData } = useMarketStore();

    if (!ictData) return null;

    return (
        <svg style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 5
        }}>
            {/* FVGs */}
            {visibleFVGs && ictData.fvgs.map(fvg => {
                const yTop = yScale(fvg.top);
                const yBottom = yScale(fvg.bottom);
                const xStart = xScale(fvg.formedAt);
                return (
                    <g key={fvg.id}>
                        <rect
                            x={xStart}
                            y={Math.min(yTop, yBottom)}
                            width={chartWidth - xStart}
                            height={Math.abs(yTop - yBottom)}
                            fill={fvg.type === 'bullish' ? '#00ff88' : '#ff3366'}
                            fillOpacity={0.1 - (fvg.partialFill * 0.08)}
                            stroke={fvg.type === 'bullish' ? '#00ff8844' : '#ff336644'}
                            strokeWidth={0.5}
                        />
                        {/* Midpoint line */}
                        <line
                            x1={xStart}
                            y1={yScale(fvg.midpoint)}
                            x2={chartWidth}
                            y2={yScale(fvg.midpoint)}
                            stroke={fvg.type === 'bullish' ? '#00ff8822' : '#ff336622'}
                            strokeDasharray="2,2"
                        />
                    </g>
                );
            })}

            {/* Order Blocks */}
            {visibleOBs && ictData.orderBlocks.map(ob => {
                const yTop = yScale(ob.top);
                const yBottom = yScale(ob.bottom);
                const xStart = xScale(ob.formedAt);
                return (
                    <rect
                        key={ob.id}
                        x={xStart}
                        y={Math.min(yTop, yBottom)}
                        width={chartWidth - xStart}
                        height={Math.abs(yTop - yBottom)}
                        fill={ob.type === 'bullish' ? '#00ccff' : '#ff9900'}
                        fillOpacity={0.15}
                        stroke={ob.type === 'bullish' ? '#00ccff88' : '#ff990088'}
                        strokeWidth={1}
                        strokeDasharray={ob.strength === 'tested' ? '4,2' : undefined}
                    />
                );
            })}

            {/* Confirmed Sweeps */}
            {visibleSweeps && ictData.sweeps.map(sweep => {
                const x = xScale(sweep.sweepCandle.time);
                const y = yScale(sweep.sweptLevel);
                const isBSL = sweep.type === 'BSL';
                return (
                    <g key={sweep.id}>
                        {/* Level Line */}
                        <line
                            x1={x - 20} y1={y} x2={x + 50} y2={y}
                            stroke={isBSL ? '#ff3366' : '#00ff88'}
                            strokeWidth={2}
                        />
                        {/* X Mark */}
                        <text
                            x={x} y={y + (isBSL ? -10 : 20)}
                            fill={isBSL ? '#ff3366' : '#00ff88'}
                            fontSize={14} fontWeight="bold"
                            textAnchor="middle"
                        >
                            {isBSL ? '✕ BSL SWEEP' : '✕ SSL SWEEP'}
                        </text>
                        {/* Confidence Indicator */}
                        <circle
                            cx={x} cy={y} r={sweep.confidence === 'high' ? 6 : 4}
                            fill={sweep.confidence === 'high' ? '#ffcc00' : 'transparent'}
                            stroke="#ffcc00"
                            strokeWidth={1}
                        />
                    </g>
                );
            })}
        </svg>
    );
}
