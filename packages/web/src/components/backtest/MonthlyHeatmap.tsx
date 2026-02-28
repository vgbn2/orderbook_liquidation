interface Props {
    data: { year: number; month: number; returnPct: number }[];
}

export function MonthlyHeatmap({ data }: Props) {
    const years = Array.from(new Set(data.map(d => d.year))).sort((a, b) => b - a); // Descending years
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowX: 'auto' }}>
            {/* Header Row */}
            <div style={{ display: 'flex', gap: '4px', paddingBottom: '8px' }}>
                <div style={{ width: 40, flexShrink: 0 }}></div>
                {months.map((m, i) => (
                    <div key={i} style={{ width: 40, flexShrink: 0, textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
                        {m}
                    </div>
                ))}
                <div style={{ width: 40, flexShrink: 0, textAlign: 'center', fontSize: '10px', color: 'var(--text-main)', fontWeight: 'bold' }}>
                    YTD
                </div>
            </div>

            {/* Year Rows */}
            {years.map(year => {
                const yearData = data.filter(d => d.year === year);
                const isCurrentYear = year === new Date().getFullYear();

                // Calculate YTD (compounded slightly more accurate, but simple sum is okay for UI estimation)
                const ytd = yearData.reduce((acc, val) => acc + val.returnPct, 0);
                const ytdIsPos = ytd >= 0;
                const ytdColor = ytdIsPos ? 'var(--positive)' : 'var(--negative)';

                return (
                    <div key={year} style={{ display: 'flex', gap: '4px' }}>
                        <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', fontSize: '11px', color: 'var(--text-main)' }}>
                            {year}
                        </div>

                        {Array.from({ length: 12 }).map((_, i) => {
                            const monthData = yearData.find(d => d.month === i);

                            if (!monthData) {
                                // Dim placeholder for future months or before history
                                return (
                                    <div key={i} style={{
                                        width: 40,
                                        height: 30,
                                        flexShrink: 0,
                                        background: 'rgba(255,255,255,0.02)',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        filter: 'blur(0.5px)'
                                    }}>
                                        {isCurrentYear && i > new Date().getMonth() ? '' : '-'}
                                    </div>
                                );
                            }

                            const isPos = monthData.returnPct >= 0;
                            // Opacity scaled to abs(returnPct). Max opacity around 30% to keep it readable, base opacity 15%
                            const opacity = Math.min(0.9, 0.15 + Math.abs(monthData.returnPct) / 20);
                            const bgColor = isPos ? `rgba(0, 230, 118, ${opacity})` : `rgba(255, 59, 92, ${opacity})`;
                            const textCol = isPos ? '#00e87a' : '#ff3b5c';

                            return (
                                <div
                                    key={i}
                                    title={`${months[i]} ${year}: ${monthData.returnPct.toFixed(2)}%`}
                                    style={{
                                        width: 40,
                                        height: 30,
                                        flexShrink: 0,
                                        background: bgColor,
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '11px',
                                        fontWeight: 500,
                                        color: opacity > 0.4 ? '#fff' : textCol
                                    }}
                                >
                                    {monthData.returnPct > 0 ? '+' : ''}{monthData.returnPct.toFixed(1)}
                                </div>
                            );
                        })}

                        {/* YTD Cell */}
                        <div style={{
                            width: 40,
                            height: 30,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: ytdColor
                        }}>
                            {ytd > 0 ? '+' : ''}{ytd.toFixed(1)}%
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
