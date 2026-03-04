import { useEffect } from 'react';

interface KeyboardProps {
    currentView: string;
    setView: (v: any) => void;
    exchangeView: string;
    setExchangeView: (e: any) => void;
}

export function useKeyboardShortcuts({
    currentView,
    setView,
    exchangeView,
    setExchangeView
}: KeyboardProps) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;

            if (e.key === '1') {
                setView('chart');
            } else if (e.key === '2') {
                setView('backtest');
            } else if (e.key === '3') {
                const exchanges = ['binance', 'bybit', 'okx', 'hyperliquid', 'mexc', 'bitget', 'gateio'] as const;
                const idx = exchanges.indexOf(exchangeView as any);
                setExchangeView(exchanges[(idx + 1) % exchanges.length]);
                setView('exchange');
            } else if (e.key === 'Escape' && currentView !== 'chart') {
                setView('chart');
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [currentView, setView, exchangeView, setExchangeView]);
}
