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

    currentView: 'chart' | 'backtest' | 'exchange' | 'screener' | 'edgefinder';
    setView: (v: 'chart' | 'backtest' | 'exchange' | 'screener' | 'edgefinder') => void;

    exchangeView: 'binance' | 'bybit' | 'okx' | 'hyperliquid' | 'mexc' | 'bitget' | 'gateio';
    setExchangeView: (ex: 'binance' | 'bybit' | 'okx' | 'hyperliquid' | 'mexc' | 'bitget' | 'gateio') => void;

    rightPanelWidth: number;
    setRightPanelWidth: (w: number | ((prev: number) => number)) => void;
    orderbookHeight: number;
    setOrderbookHeight: (h: number | ((prev: number) => number)) => void;
    uiComplexity: 'Simple' | 'Advanced';
    setUiComplexity: (v: 'Simple' | 'Advanced') => void;
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
    currentView: (safeGet('term_current_view', 'chart') as any) || 'chart',
    setView: (v) => {
        safeSet('term_current_view', v);
        set({ currentView: v });
    },
    exchangeView: (safeGet('term_exchange_view', 'binance') as any) || 'binance',
    setExchangeView: (ex) => {
        safeSet('term_exchange_view', ex);
        set({ exchangeView: ex });
    },

    rightPanelWidth: (() => {
        const val = parseInt(safeGet('term_right_w', '320'));
        return isNaN(val) || val < 200 || val > 800 ? 320 : val;
    })(),
    setRightPanelWidth: (valOrFn) => set(state => {
        const next = typeof valOrFn === 'function' ? valOrFn(state.rightPanelWidth) : valOrFn;
        const validNext = isNaN(next) || next < 200 || next > 800 ? 320 : next;
        safeSet('term_right_w', String(validNext));
        return { rightPanelWidth: validNext };
    }),
    orderbookHeight: (() => {
        const val = parseInt(safeGet('term_orderbook_h', '320'));
        return isNaN(val) || val < 100 || val > 1000 ? 320 : val;
    })(),
    setOrderbookHeight: (valOrFn) => set(state => {
        const next = typeof valOrFn === 'function' ? valOrFn(state.orderbookHeight) : valOrFn;
        const validNext = isNaN(next) || next < 100 || next > 1000 ? 320 : next;
        safeSet('term_orderbook_h', String(validNext));
        return { orderbookHeight: validNext };
    }),
    uiComplexity: safeGet('term_ui_complexity', 'Advanced') as 'Simple' | 'Advanced',
    setUiComplexity: (v) => {
        safeSet('term_ui_complexity', v);
        set({ uiComplexity: v });
    }
}));
