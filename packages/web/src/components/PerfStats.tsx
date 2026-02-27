import React from 'react';
import { usePerfStore } from '../stores/usePerfStore';
import { useStrain } from '../hooks/useStrain';

/**
 * PerfStats — Real-time performance HUD
 * Shows: DELAY, STRAIN, FPS, PRESSURE
 * Can be toggled on/off via toolbar button
 */
export const PerfStats: React.FC = () => {
    const showPerfHud = usePerfStore((s) => s.showPerfHud);

    // Only run the strain RAF loop when HUD is visible
    useStrain(showPerfHud);

    const procDelay = usePerfStore((s) => s.procDelay);
    const strain = usePerfStore((s) => s.strain);
    const fps = usePerfStore((s) => s.fps);
    const msgPressure = usePerfStore((s) => s.msgPressure);

    if (!showPerfHud) return null;

    const getStrainColor = (val: number) => {
        if (val < 20) return 'var(--green)';
        if (val < 50) return 'var(--orange)';
        return 'var(--red)';
    };

    const getDelayColor = (val: number) => {
        if (val < 100) return 'var(--cyan)';
        if (val < 300) return 'var(--orange)';
        return 'var(--red)';
    };

    return (
        <div className="perf-stats-hud">
            <div className="perf-item" title="Server-to-client processing latency">
                <span className="label">DELAY</span>
                <span className="value" style={{ color: getDelayColor(procDelay) }}>
                    {procDelay}ms
                </span>
            </div>

            <div className="perf-sep" />

            <div className="perf-item" title="Weighted system strain (FL 70%, MP 30%)">
                <span className="label">STRAIN</span>
                <span className="value" style={{ color: getStrainColor(strain) }}>
                    {strain}%
                </span>
                <div className="strain-bar-bg">
                    <div
                        className="strain-bar-fill"
                        style={{
                            width: `${strain}%`,
                            backgroundColor: getStrainColor(strain)
                        }}
                    />
                </div>
            </div>

            <div className="perf-sep" />

            <div className="perf-item" title="UI Frames Per Second">
                <span className="label">FPS</span>
                <span className="value">{fps}</span>
            </div>

            <div className="perf-sep" />

            <div className="perf-item" title="WebSocket Message Frequency (msg/sec)">
                <span className="label">PRESSURE</span>
                <span className="value">{msgPressure}</span>
            </div>
        </div>
    );
};
