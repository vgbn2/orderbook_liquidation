import { create } from 'zustand';

interface SettingsState {
    tradingConfirmations: boolean;
    setTradingConfirmations: (b: boolean) => void;
    theme: 'Dark' | 'Light';
    setTheme: (t: 'Dark' | 'Light') => void;
    chartLayout: 'Advanced' | 'Simple';
    setChartLayout: (l: 'Advanced' | 'Simple') => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
    tradingConfirmations: true,
    setTradingConfirmations: (b) => set({ tradingConfirmations: b }),
    theme: 'Dark',
    setTheme: (t) => set({ theme: t }),
    chartLayout: 'Advanced',
    setChartLayout: (l) => set({ chartLayout: l })
}));
