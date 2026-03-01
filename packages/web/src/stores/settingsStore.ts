import { create } from 'zustand';

interface SettingsState {
    tradingConfirmations: boolean;
    setTradingConfirmations: (b: boolean) => void;
    theme: 'Dark' | 'Light';
    setTheme: (t: 'Dark' | 'Light') => void;
    chartLayout: 'Advanced' | 'Simple';
    setChartLayout: (l: 'Advanced' | 'Simple') => void;

    showOrderbook: boolean;
    setShowOrderbook: (v: boolean) => void;
    toggleOrderbook: () => void;

    notificationLevel: 'all' | 'critical_only' | 'off';
    setNotificationLevel: (v: 'all' | 'critical_only' | 'off') => void;

    currentView: 'chart' | 'backtest' | 'exchange' | 'screener';
    setView: (v: 'chart' | 'backtest' | 'exchange' | 'screener') => void;

    exchangeView: 'binance' | 'bybit' | 'okx' | 'hyperliquid' | 'mexc' | 'bitget' | 'gateio';
    setExchangeView: (ex: 'binance' | 'bybit' | 'okx' | 'hyperliquid' | 'mexc' | 'bitget' | 'gateio') => void;
}

function safeGet(key: string, fallback: string): string {
    try {
        if (typeof window === 'undefined') return fallback;
        return localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}

function safeSet(key: string, value: string): void {
    try {
        if (typeof window !== 'undefined') localStorage.setItem(key, value);
    } catch { }
}

export const useSettingsStore = create<SettingsState>((set) => ({
    tradingConfirmations: safeGet('term_confirmations', 'true') === 'true',
    setTradingConfirmations: (b) => {
        safeSet('term_confirmations', String(b));
        set({ tradingConfirmations: b });
    },
    theme: safeGet('term_theme', 'Dark') as 'Dark' | 'Light',
    setTheme: (t) => {
        safeSet('term_theme', t);
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', t.toLowerCase());
        }
        set({ theme: t });
    },
    chartLayout: safeGet('term_layout', 'Advanced') as 'Advanced' | 'Simple',
    setChartLayout: (l) => {
        safeSet('term_layout', l);
        set({ chartLayout: l });
    },
    showOrderbook: safeGet('term_orderbook', 'true') === 'true',
    setShowOrderbook: (v) => {
        safeSet('term_orderbook', String(v));
        set({ showOrderbook: v });
    },
    toggleOrderbook: () => set(state => {
        const next = !state.showOrderbook;
        safeSet('term_orderbook', String(next));
        return { showOrderbook: next };
    }),
    notificationLevel: safeGet('term_notif_level', 'all') as 'all' | 'critical_only' | 'off',
    setNotificationLevel: (v) => {
        safeSet('term_notif_level', v);
        set({ notificationLevel: v });
    },
    currentView: 'chart',
    setView: (v) => set({ currentView: v }),
    exchangeView: 'binance',
    setExchangeView: (ex) => set({ exchangeView: ex })
}));
