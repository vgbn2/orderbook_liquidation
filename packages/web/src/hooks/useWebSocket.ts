import { useMarketStore } from '../stores/marketStore';
import { usePerfStore } from '../stores/usePerfStore';
import { useRef, useEffect, useCallback } from 'react';

export function useWebSocket() {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttempts = useRef(0);
    const setMetrics = usePerfStore((s) => s.setMetrics);
    const msgCount = useRef(0);
    const lastFreqUpdate = useRef(performance.now());
    const lastDelayUpdate = useRef(performance.now());

    const {
        setConnected, addCandle, updateLastCandle, setLastPrice,
        setOrderbook, setOptions, addOptionTrade, setLiquidations,
        setVwaf, setConfluenceZones, addTrade,
        setReplayMode, setReplayTimestamp, isReplayMode,
        setQuantSnapshot
    } = useMarketStore();

    const connect = useCallback(() => {
        // Use relative URL — Vite proxy handles routing to backend
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/ws`;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            reconnectAttempts.current = 0;

            // Subscribe to all data topics
            ws.send(JSON.stringify({
                action: 'subscribe',
                topics: [
                    'candles.binance.BTCUSDT',
                    'orderbook.aggregated',
                    'options.analytics',
                    'liquidations',
                    'vwaf',
                    'confluence',
                    'trades',
                    'alerts',
                    'quant.analytics',
                ],
            }));
        };

        ws.onmessage = (event) => {
            msgCount.current++;
            const now = performance.now();
            if (now - lastFreqUpdate.current > 1000) {
                setMetrics({ msgPressure: msgCount.current });
                msgCount.current = 0;
                lastFreqUpdate.current = now;
            }

            try {
                const msg = JSON.parse(event.data);

                // Calculate processing delay — sample every 2s, not every msg
                if (msg.ts) {
                    const elapsed = performance.now() - lastDelayUpdate.current;
                    if (elapsed > 2000) {
                        setMetrics({ procDelay: Date.now() - msg.ts });
                        lastDelayUpdate.current = performance.now();
                    }
                }

                handleMessage(msg);
            } catch {
                // Ignore malformed messages
            }
        };

        ws.onclose = () => {
            setConnected(false);
            scheduleReconnect();
        };

        ws.onerror = () => {
            ws.close();
        };
    }, [setConnected]);

    const handleMessage = useCallback((msg: { topic: string; data: unknown }) => {
        switch (msg.topic) {
            case 'replay': {
                const data = msg.data as any;
                if (data.type === 'BATCH') {
                    setReplayTimestamp(data.timestamp);
                    for (const event of data.events) {
                        if (event.type === 'orderbook') setOrderbook(event.data);
                        if (event.type === 'trade') addTrade(event.data);
                        if (event.type === 'liquidation') setLiquidations(event.data);
                    }
                } else if (data.type === 'END') {
                    setReplayMode(false);
                    setReplayTimestamp(null);
                }
                break;
            }
            default: {
                if (isReplayMode) return;

                switch (msg.topic) {
                    case 'candles.binance.BTCUSDT': {
                        const candle = msg.data as any;
                        if (candle.isUpdate) updateLastCandle(candle);
                        else addCandle(candle);
                        setLastPrice(candle.close);
                        break;
                    }
                    case 'orderbook.aggregated':
                        setOrderbook(msg.data as any);
                        break;
                    case 'options.analytics':
                        setOptions(msg.data as any);
                        break;
                    case 'options.large_trade':
                        addOptionTrade(msg.data as any);
                        break;
                    case 'liquidations.heatmap':
                        setLiquidations(msg.data as any);
                        break;
                    case 'vwaf':
                        setVwaf(msg.data as any);
                        break;
                    case 'confluence':
                        setConfluenceZones(msg.data as any);
                        break;
                    case 'trades':
                        addTrade(msg.data as any);
                        break;
                    case 'quant.analytics':
                        setQuantSnapshot(msg.data as any);
                        break;
                }
            }
        }
    }, [addCandle, updateLastCandle, setLastPrice, setOrderbook, setOptions, addOptionTrade, setLiquidations, setVwaf, setConfluenceZones, addTrade, setReplayMode, setReplayTimestamp, isReplayMode, setQuantSnapshot]);

    const scheduleReconnect = useCallback(() => {
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);

        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30_000);
        reconnectAttempts.current++;

        reconnectTimer.current = setTimeout(() => {
            connect();
        }, delay);
    }, [connect]);

    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (wsRef.current) {
                wsRef.current.close(1000, 'Component unmount');
            }
        };
    }, [connect]);

    const startReplay = useCallback((config: { startTime: number; endTime: number; speed: number }) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            setReplayMode(true);
            wsRef.current.send(JSON.stringify({
                action: 'start_replay',
                config
            }));
        }
    }, [setReplayMode]);

    const stopReplay = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                action: 'stop_replay'
            }));
            setReplayMode(false);
            setReplayTimestamp(null);
        }
    }, [setReplayMode, setReplayTimestamp]);

    return { wsRef, startReplay, stopReplay };
}
