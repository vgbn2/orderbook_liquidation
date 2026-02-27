import { useMarketStore } from '../stores/marketStore';
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

    // Batching state
    const reqFrameRef = useRef<number | null>(null);

    const {
        symbol, setSymbol, timeframe,
        setConnected, addCandle, updateLastCandle, setLastPrice,
        setOrderbook, setOptions, addOptionTrade, setLiquidations,
        addLiquidation, setFundingRates, setOpenInterest,
        setVwaf, setConfluenceZones, addTrade,
        setReplayMode, setReplayTimestamp, isReplayMode,
        setQuantSnapshot
    } = useMarketStore();

    const handleRef = useRef<any>(null);

    const connect = useCallback(() => {
        // Use relative URL — Vite proxy handles routing to backend
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/ws`;

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

            // Subscribe to all data topics
            ws.send(JSON.stringify({
                action: 'subscribe',
                topics: [
                    `candles.binance.${symbol.toUpperCase()}.${timeframe}`,
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

            // Offload to Web Worker instead of main thread JSON.parse
            if (workerRef.current) {
                workerRef.current.postMessage({
                    type: 'WS_MESSAGE',
                    payload: event.data
                });
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
            default: {
                if (isReplayMode) return;

                if (msg.topic.startsWith('candles.')) {
                    const parts = msg.topic.split('.');
                    const tf = parts[3];
                    const candle = msg.data as any;

                    if ((msg as any)._cvd !== undefined) {
                        candle.cvd = (msg as any)._cvd;
                    }

                    if (msg.topic === `candles.binance.${symbol.toUpperCase()}.${timeframe}`) {
                        if (candle.isUpdate) updateLastCandle(candle);
                        else addCandle(candle);
                        setLastPrice(candle.close);
                    }

                    const { setMultiTfCvd, multiTfCvd } = useMarketStore.getState();
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
                        setOrderbook(msg.data as any);
                        break;
                    case 'options.analytics':
                        setOptions(msg.data as any);
                        break;
                    case 'options.large_trade':
                        addOptionTrade(msg.data as any);
                        break;
                    case 'liquidations':
                        addLiquidation(msg.data as any);
                        break;
                    case 'liquidations.heatmap':
                        setLiquidations(msg.data as any);
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
                        setConfluenceZones(msg.data as any);
                        break;
                    case 'trades':
                        addTrade(msg.data as any);
                        break;
                    case 'quant.analytics':
                        setQuantSnapshot(msg.data as any);
                        break;
                    case 'symbol_changed':
                        if (msg.data && (msg.data as any).symbol) {
                            const newSym = (msg.data as any).symbol;
                            setSymbol(newSym);
                            if (wsRef.current?.readyState === WebSocket.OPEN) {
                                wsRef.current.send(JSON.stringify({
                                    action: 'subscribe',
                                    topics: [`candles.binance.${newSym.toUpperCase()}.${timeframe}`]
                                }));
                                wsRef.current.send(JSON.stringify({
                                    action: 'unsubscribe',
                                    topics: [`candles.binance.${symbol.toUpperCase()}.${timeframe}`]
                                }));
                            }
                        }
                        break;
                }
            }
        }
    }, [
        addCandle, updateLastCandle, setLastPrice, setOrderbook, setOptions, addOptionTrade,
        setLiquidations, addLiquidation, setFundingRates, setOpenInterest, setVwaf,
        setConfluenceZones, addTrade, setReplayMode, setReplayTimestamp, isReplayMode, setQuantSnapshot,
        setSymbol, symbol, timeframe, setMetrics
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

    // Update subscriptions on timeframe change
    useEffect(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                action: 'subscribe',
                topics: [`candles.binance.${symbol.toUpperCase()}.${timeframe}`]
            }));

            // Unsubscribe from other timeframes
            const others = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'].filter(t => t !== timeframe);
            wsRef.current.send(JSON.stringify({
                action: 'unsubscribe',
                topics: others.map(t => `candles.binance.${symbol.toUpperCase()}.${t}`)
            }));
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
