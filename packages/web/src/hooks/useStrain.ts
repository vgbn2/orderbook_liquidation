import { useEffect, useRef } from 'react';
import { usePerfStore } from '../stores/usePerfStore';

/**
 * useStrain — Monitor UI Strain & Weighted Performance
 *
 * Formula:
 * 1. Frame Lag (FL): % deviation from target 60fps (16.6ms)
 * 2. Msg Pressure (MP): Messages received per second
 * 3. Total Strain = (FL * 0.7) + (min(MP, 100) * 0.3)
 */
export function useStrain() {
    const frameTimeRef = useRef(performance.now());
    const rafIdRef = useRef<number | undefined>(undefined);
    const strainAccumulator = useRef<number[]>([]);
    const MAX_SAMPLES = 60;

    useEffect(() => {
        const tick = () => {
            const now = performance.now();
            const delta = now - frameTimeRef.current;
            frameTimeRef.current = now;

            // Read latest values directly from store (avoid hook re-render)
            const state = usePerfStore.getState();

            // 1. Frame Lag (0 to 100+)
            const frameLag = Math.max(0, (delta - 17) / 16.6) * 100;
            const currentFps = 1000 / delta;

            // 2. Normalize Message Pressure
            const normalizedMP = Math.min(state.msgPressure, 100);

            // 3. Weighted Strain
            const currentStrain = (frameLag * 0.7) + (normalizedMP * 0.3);

            // SMA smoothing
            strainAccumulator.current.push(currentStrain);
            if (strainAccumulator.current.length > MAX_SAMPLES) {
                strainAccumulator.current.shift();
            }
            const smoothed = strainAccumulator.current.reduce((a, b) => a + b, 0)
                / strainAccumulator.current.length;

            // Write to store
            state.setMetrics({
                strain: Math.min(Math.round(smoothed), 100),
                fps: Math.round(currentFps),
            });

            rafIdRef.current = requestAnimationFrame(tick);
        };

        rafIdRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, []);
}
