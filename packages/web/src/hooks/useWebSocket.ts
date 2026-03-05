import { useCandleStore } from '../stores/candleStore';
import { useMarketDataStore } from '../stores/marketDataStore';
import { usePerfStore } from '../stores/usePerfStore';
import { useRef, useEffect, useCallback } from 'react';
import { createWorker } from '../engines/websocketWorker';

export function useWebSocket() {
    const wsRef = useRef<WebSocket | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttempts = useRef(0);
    const setMetrics = usePerfStore((s) => s.setMetrics);
    const msgCount = useRef(0);
    const lastFreqUpdate = useRef(performance.now());
    const lastDelayUpdate = useRef(performance.now());

    // Batching & Throttling setup (Fix 3)
    const reqFrameRef = useRef<number | null>(null);
    const pendingMessages = useRef<any[]>([]);
    const activeCandleTopic = useRef<string | null>(null);

    const pendingOrderbook = useRef<any>(null);
    const pendingLiquidations = useRef<any>(null);
    const pendingConfluence = useRef<any>(null);
    const pendingQuant = useRef<any>(null);

    useEffect(() => {
        // 15 FPS Throttle
        const flushInterval = setInterval(() => {
            const state = useMarketDataStore.getState();
            if (pendingOrderbook.current) {
                state.setOrderbook(pendingOrderbook.current);
                pendingOrderbook.current = null;
            }
            if (pendingLiquidations.current) {
                state.setLiquidations(pendingLiquidations.current);
                pendingLiquidations.current = null;
            }
            if (pendingConfluence.current) {
                state.setConfluenceZones(pendingConfluence.current);
                pendingConfluence.current = null;
            }
            if (pendingQuant.current) {
                state.setQuantSnapshot(pendingQuant.current);
                pendingQuant.current = null;
            }
        }, 66);
        return () => clearInterval(flushInterval);
    }, []);

    const {
        symbol, timeframe,
        addCandle, updateLastCandle,
        addAggregatedCandle, updateLastAggregatedCandle,
        addHtfCandle,
    } = useCandleStore();

    const {
        setConnected, setLastPrice, setOrderbook, setDeepOrderbook,
        setOptions, addOptionTrade, setLiquidations, addLiquidation,
        setFundingRates, setOpenInterest, setVwaf, setConfluenceZones,
        addTrade, setReplayMode, setReplayTimestamp, isReplayMode,
        setQuantSnapshot, setIctData, setConfirmedSweeps, setSend
    } = useMarketDataStore();

    const handleRef = useRef<any>(null);

    const connect = useCallback(async () => {
        try {
            const apiKey = import.meta.env.VITE_TERMINUS_API_KEY;
            const tokenRes = await fetch('/api/token', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey || ''
                }
            });
            if (!tokenRes.ok) throw new Error('Failed to fetch auth token');

            const { token } = await tokenRes.json();

            // Use relative URL — Vite proxy handles routing to backend
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const url = `${protocol}//${window.location.host}/ws?token=${token}`;

            const ws = new WebSocket(url);
            wsRef.current = ws;

            if (!workerRef.current) {
                workerRef.current = createWorker();
                workerRef.current.onmessage = (e) => {
                    if (e.data.type === 'PARSED_MESSAGE' && handleRef.current) {
                        handleRef.current(e.data.payload);
                    }
                };
            }

            ws.onopen = () => {
                setConnected(true);
                reconnectAttempts.current = 0;

                // Register send function in store so any component can use it
                setSend((msg: any) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify(msg));
                    } else {
                        // Queue for reconnect
                        pendingMessages.current.push(msg);
                    }
                });

                // Flush any queued messages
                while (pendingMessages.current.length > 0) {
                    ws.send(JSON.stringify(pendingMessages.current.shift()));
                }

                const initialTopic = `candles.binance.${symbol.toUpperCase()}.${timeframe}`;
                activeCandleTopic.current = initialTopic;

                // Subscribe to all data topics
                ws.send(JSON.stringify({
                    action: 'subscribe',
                    topics: [
                        initialTopic,
                        `candles.aggregated.${symbol.toUpperCase()}.${timeframe}`,
                        'orderbook.aggregated',
                        'orderbook.deep',
                        'options.analytics',
                        'liquidations',
                        'vwaf',
                        'confluence',
                        'trades',
                        'alerts',
                        `quant.analytics.${symbol.toUpperCase()}`,
                        'ict.data',
                        'ict.sweep_confirmed',
                        `candles.binance.${symbol.toUpperCase()}.4h`,
                        `candles.binance.${symbol.toUpperCase()}.1d`,
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

                // Offload to Web Worker using Transferable Objects (Fix 4: GC Pauses)
                if (workerRef.current) {
                    // Convert string to ArrayBuffer to transfer ownership (Zero-copy to worker)
                    const encoder = new TextEncoder();
                    const buffer = encoder.encode(event.data).buffer;

                    workerRef.current.postMessage({
                        type: 'WS_MESSAGE',
                        payload: buffer
                    }, [buffer]); // <-- Transferable array
                }
            };

            ws.onclose = () => {
                setSend(() => { }); // clear send while disconnected
                setConnected(false);
                scheduleReconnect();
            };

            ws.onerror = () => {
                ws.close();
            };
        } catch (err) {
            console.error('WebSocket auth failed:', err);
            scheduleReconnect();
        }
    }, [setConnected]);

    const handleParsedMessage = useCallback((msg: { topic: string; data: unknown; ts?: number }) => {
        // Calculate processing delay
        if (msg.ts) {
            const elapsed = performance.now() - lastDelayUpdate.current;
            if (elapsed > 2000) {
                setMetrics({ procDelay: Date.now() - msg.ts });
                lastDelayUpdate.current = performance.now();
            }
        }

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
            case 'quant.analytics': {
                const parsed = msg.data as any;
                const state = useMarketDataStore.getState();
                // Ignore if locked to another symbol
                const lockedSym = state.lockedQuantSymbol;
                if (lockedSym && parsed.symbol !== lockedSym) return;

                // If not locked, ensure it matches the active chart symbol
                if (!lockedSym && parsed.symbol !== useCandleStore.getState().symbol) return;

                if (!useMarketDataStore.getState().isReplayMode) {
                    state.setQuantSnapshot(parsed);
                }
                break;
            }
            default: {
                if (isReplayMode) return;

                if (msg.topic.startsWith('candles.')) {
                    const parts = msg.topic.split('.');
                    const source = parts[1]; // binance | aggregated
                    const tf = parts[3];
                    const candle = msg.data as any;

                    if ((msg as any)._cvd !== undefined) {
                        candle.cvd = (msg as any)._cvd;
                    }

                    if (source === 'aggregated') {
                        if (tf === timeframe) {
                            if (candle.isUpdate) updateLastAggregatedCandle(candle);
                            else addAggregatedCandle(candle);
                        }
                    } else if (msg.topic === `candles.binance.${symbol.toUpperCase()}.${timeframe}`) {
                        if (candle.isUpdate) updateLastCandle(candle);
                        else addCandle(candle);
                        setLastPrice(candle.close);
                    } else {
                        // HTF candle
                        addHtfCandle(tf, candle);
                    }

                    // CVD logic (for all candles)
                    const { setMultiTfCvd, multiTfCvd } = useCandleStore.getState();
                    const existing = multiTfCvd[tf] || [];
                    const newPoint = { time: candle.time, value: candle.cvd ?? 0 };

                    if (candle.isUpdate) {
                        if (existing.length > 0 && existing[existing.length - 1].time === candle.time) {
                            setMultiTfCvd(tf, [...existing.slice(0, -1), newPoint]);
                        } else {
                            setMultiTfCvd(tf, [...existing, newPoint].slice(-500));
                        }
                    } else {
                        setMultiTfCvd(tf, [...existing, newPoint].slice(-500));
                    }
                    return;
                }

                switch (msg.topic) {
                    case 'orderbook.aggregated':
                        pendingOrderbook.current = msg.data;
                        break;
                    case 'orderbook.deep':
                        setDeepOrderbook(msg.data as any);
                        break;
                    case 'options.analytics':
                        setOptions(msg.data as any);
                        break;
                    case 'options.large_trade':
                        addOptionTrade(msg.data as any);
                        break;
                    case 'liquidations':
                        addLiquidation(msg.data as any);
                        useMarketDataStore.getState().addSignificantLiquidation(msg.data as any);
                        break;
                    case 'liquidations.heatmap':
                        pendingLiquidations.current = msg.data;
                        break;
                    case 'funding_rate':
                        setFundingRates(msg.data as any);
                        break;
                    case 'open_interest':
                        setOpenInterest(msg.data as any);
                        break;
                    case 'vwaf':
                        setVwaf(msg.data as any);
                        break;
                    case 'confluence':
                        pendingConfluence.current = msg.data;
                        break;
                    case 'trades':
                        addTrade(msg.data as any);
                        break;
                    case 'alerts':
                        useMarketDataStore.getState().addAlert(msg.data as any);
                        window.dispatchEvent(new CustomEvent('terminal_alert', { detail: msg.data }));
                        if ((msg.data as any).severity === 'critical') {
                            window.dispatchEvent(new CustomEvent('terminus_toast', {
                                detail: {
                                    message: `${(msg.data as any).type}: ${(msg.data as any).message}`,
                                    type: 'error',
                                    tier: 'alert'
                                }
                            }));
                        } else if ((msg.data as any).severity === 'warn') {
                            window.dispatchEvent(new CustomEvent('terminus_toast', {
                                detail: {
                                    message: `${(msg.data as any).type}: ${(msg.data as any).message}`,
                                    type: 'warn',
                                    tier: 'alert'
                                }
                            }));
                        }
                        break;
                    case `quant.analytics.${symbol.toUpperCase()}`:
                    case 'quant.analytics': // Fallback just in case
                        pendingQuant.current = msg.data;
                        break;
                    case 'ict.data':
                        setIctData(msg.data);
                        break;
                    case 'ict.sweep_confirmed': {
                        const sweep = msg.data as any;
                        setConfirmedSweeps([sweep, ...useMarketDataStore.getState().confirmedSweeps].slice(0, 50));
                        break;
                    }
                    case 'symbol_changed': {
                        const { symbol: confirmedSymbol } = msg.data as { symbol: string };
                        window.dispatchEvent(new CustomEvent('terminus_symbol_confirmed', {
                            detail: { symbol: confirmedSymbol }
                        }));
                        break;
                    }
                }
            }
        }
    }, [
        addCandle, updateLastCandle, setLastPrice, setOrderbook, setOptions, addOptionTrade,
        setLiquidations, addLiquidation, setFundingRates, setOpenInterest, setVwaf,
        setConfluenceZones, addTrade, setReplayMode, setReplayTimestamp, isReplayMode, setQuantSnapshot,
        setIctData, setConfirmedSweeps, addHtfCandle,
        symbol, timeframe, setMetrics
    ]);

    useEffect(() => {
        handleRef.current = handleParsedMessage;
    }, [handleParsedMessage]);

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
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
            if (reqFrameRef.current) {
                cancelAnimationFrame(reqFrameRef.current);
            }
        };
    }, [connect]);

    // Update subscriptions on timeframe or symbol change
    useEffect(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            const newTopic = `candles.binance.${symbol.toUpperCase()}.${timeframe}`;
            const newAggTopic = `candles.aggregated.${symbol.toUpperCase()}.${timeframe}`;

            if (activeCandleTopic.current && activeCandleTopic.current !== newTopic) {
                const oldTF = activeCandleTopic.current.split('.')[3];
                const oldSym = activeCandleTopic.current.split('.')[2];
                wsRef.current.send(JSON.stringify({
                    action: 'unsubscribe',
                    topics: [
                        activeCandleTopic.current,
                        `candles.aggregated.${oldSym}.${oldTF}`,
                        `quant.analytics.${oldSym}`
                    ]
                }));
            }

            wsRef.current.send(JSON.stringify({
                action: 'subscribe',
                topics: [
                    newTopic,
                    newAggTopic,
                    `quant.analytics.${symbol.toUpperCase()}`
                ]
            }));

            activeCandleTopic.current = newTopic;
        }
    }, [timeframe, symbol]);

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

    const send = useCallback((msg: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    }, []);

    return { wsRef, startReplay, stopReplay, send };
}
