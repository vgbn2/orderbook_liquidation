import { create } from 'zustand';

export interface PerfState {
    netDelay: number;
    procDelay: number;
    strain: number;
    fps: number;
    msgPressure: number;
    showPerfHud: boolean;

    setMetrics: (metrics: Partial<Omit<PerfState, 'setMetrics' | 'toggleHud' | 'showPerfHud'>>) => void;
    toggleHud: () => void;
}

export const usePerfStore = create<PerfState>()((set) => ({
    netDelay: 0,
    procDelay: 0,
    strain: 0,
    fps: 60,
    msgPressure: 0,
    showPerfHud: typeof window !== 'undefined' ? localStorage.getItem('terminus_perf_hud') !== 'false' : true,

    setMetrics: (metrics) => set((state) => ({ ...state, ...metrics })),
    toggleHud: () => set((state) => {
        const next = !state.showPerfHud;
        localStorage.setItem('terminus_perf_hud', String(next));
        return { showPerfHud: next };
    }),
}));
