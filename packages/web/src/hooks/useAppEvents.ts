import { useEffect } from 'react';

interface AppEventsProps {
    setShowAlertPanel: (show: boolean) => void;
    fetchHistorical: (timeframe: string, symbol: string) => void;
    timeframe: string;
}

export function useAppEvents({
    setShowAlertPanel,
    fetchHistorical,
    timeframe
}: AppEventsProps) {
    // Alert listener
    useEffect(() => {
        const handler = () => setShowAlertPanel(true);
        window.addEventListener('TERMINUS_SHOW_ALERTS', handler);
        return () => window.removeEventListener('TERMINUS_SHOW_ALERTS', handler);
    }, [setShowAlertPanel]);

    // Symbol switch confirmation listener
    useEffect(() => {
        const handler = (e: Event) => {
            const { symbol: confirmedSym } = (e as CustomEvent).detail;
            fetchHistorical(timeframe, confirmedSym);
        };
        window.addEventListener('terminus_symbol_confirmed', handler);
        return () => window.removeEventListener('terminus_symbol_confirmed', handler);
    }, [timeframe, fetchHistorical]);
}
