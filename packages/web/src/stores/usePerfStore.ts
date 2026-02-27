import { create } from 'zustand';

export interface PerfState {
    netDelay: number;    // Network RTT in ms
    procDelay: number;   // Server-to-Client processing age in ms
    strain: number;      // Weighted score 0-100
    fps: number;         // Current frames per second
    msgPressure: number; // Messages per second

    setMetrics: (metrics: Partial<Omit<PerfState, 'setMetrics'>>) => void;
}

export const usePerfStore = create<PerfState>()((set) => ({
    netDelay: 0,
    procDelay: 0,
    strain: 0,
    fps: 60,
    msgPressure: 0,

    setMetrics: (metrics) => set((state) => ({ ...state, ...metrics })),
}));
