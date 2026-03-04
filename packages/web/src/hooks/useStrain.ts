import { useEffect, useRef } from 'react';
import { usePerfStore } from '../stores/usePerfStore';

/**
 * useStrain — Monitor UI Strain & Weighted Performance
 *
 * Formula:
 * 1. UI Block Time (UB): from PerformanceObserver longtask entry
 * 2. Msg Pressure (MP): Messages received per second
 * 3. Total Strain = (UB * 0.7) + (min(MP, 100) * 0.3)
 */
export function useStrain(enabled = true) {
    const frameTimeRef = useRef(performance.now());
    const rafIdRef = useRef<number | undefined>(undefined);
    const strainAccumulator = useRef<number[]>([]);
    const MAX_SAMPLES = 60;

    useEffect(() => {
        if (!enabled) {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = undefined;
            return;
        }

        let totalLongTaskTime = 0;
        let observer: PerformanceObserver | undefined;

        try {
            observer = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    totalLongTaskTime += entry.duration;
                });
            });
            observer.observe({ type: 'longtask', buffered: true });
        } catch (e) {
            // Check if supported
        }

        const tick = () => {
            const now = performance.now();
            const delta = now - frameTimeRef.current;
            frameTimeRef.current = now;

            const state = usePerfStore.getState();
            const currentFps = 1000 / delta;

            let uiBlockPercentage = 0;
            if (delta > 0) {
                uiBlockPercentage = (totalLongTaskTime / delta) * 100;
            }
            totalLongTaskTime = 0; // Reset for next frame

            const frameLag = Math.max(0, (delta - 17) / 16.6) * 100;
            const baseStrain = uiBlockPercentage > 0 ? uiBlockPercentage : frameLag;
            const normalizedMP = Math.min(state.msgPressure, 100);

            const currentStrain = (baseStrain * 0.7) + (normalizedMP * 0.3);

            strainAccumulator.current.push(currentStrain);
            if (strainAccumulator.current.length > MAX_SAMPLES) {
                strainAccumulator.current.shift();
            }
            const smoothed = strainAccumulator.current.reduce((a, b) => a + b, 0)
                / strainAccumulator.current.length;

            state.setMetrics({
                strain: Math.min(Math.round(smoothed), 100),
                fps: Math.round(currentFps),
            });

            rafIdRef.current = requestAnimationFrame(tick);
        };

        rafIdRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            if (observer) observer.disconnect();
        };
    }, [enabled]);
}
