import WebSocket from 'ws';
import { logger } from '../logger.js';
import { orderbookEngine } from '../engines/signals/orderbook.js';
import { aggregatedCandleEngine } from '../engines/core/AggregatedCandleEngine.js';

let ws: WebSocket | null = null;
let currentSymbol = 'btcusdt';

// Sequence checking state
let lastSeq: number | null = null;
let isResyncing = false;
let isStopped = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startBybit(symbol: string) {
    currentSymbol = symbol.toUpperCase();
    isStopped = false;
    connect(currentSymbol);
}

export function stopBybit(symbol: string) {
    isStopped = true;
    stopHeartbeat();
    if (ws) {
        ws.removeAllListeners();
        ws.close();
        ws = null;
    }
    lastSeq = null;
    isResyncing = false;
    logger.info({ symbol }, 'Bybit adapter stopped');
}

function wipeAndResync(symbol: string) {
    if (isResyncing) return;
    isResyncing = true;

    logger.error({ symbol }, 'Desync Detected on Bybit — Refetching Snapshot');

    if (ws) {
        ws.removeAllListeners();
        ws.terminate();
        ws = null;
    }

    // Attempt reconnect
    if (!isStopped) setTimeout(() => connect(symbol), 100);
}

function connect(symbol: string) {
    isResyncing = false;
    lastSeq = null; // Reset on new connection

    try {
        ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
    } catch (err) {
        logger.error({ err }, 'Failed to initialize Bybit WebSocket');
        setTimeout(() => connect(symbol), 3000);
        return;
    }

    ws.on('open', () => {
        logger.info('Bybit orderbook connected');
        ws?.send(JSON.stringify({
            op: 'subscribe',
            args: [`orderbook.50.${symbol}`, `publicTrade.${symbol}`]
        }));
        startHeartbeat();
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            // Handle Orderbook
            if (msg.topic === `orderbook.50.${symbol}` && msg.data) {
                const currentU = msg.data.u;
                if (msg.type === 'snapshot') {
                    lastSeq = currentU;
                    orderbookEngine.initSnapshot('bybit', {
                        lastUpdateId: Date.now(),
                        bids: msg.data.b || [],
                        asks: msg.data.a || [],
                    });
                } else if (msg.type === 'delta') {
                    if (lastSeq !== null && currentU) {
                        if (currentU <= lastSeq) return;
                        if (currentU !== lastSeq + 1) {
                            wipeAndResync(symbol);
                            return;
                        }
                    }
                    lastSeq = currentU;
                    orderbookEngine.applyDelta('bybit', {
                        u: Date.now(),
                        b: msg.data.b || [],
                        a: msg.data.a || [],
                    });
                }
            }

            // Handle Trades
            if (msg.topic === `publicTrade.${symbol}` && msg.data) {
                for (const t of msg.data) {
                    aggregatedCandleEngine.ingestTrade(
                        'bybit',
                        symbol,
                        parseFloat(t.p),
                        parseFloat(t.v),
                        parseInt(t.T)
                    );
                }
            }
        } catch (e) { }
    });

    ws.on('close', () => {
        stopHeartbeat();
        if (!isResyncing && !isStopped) setTimeout(() => connect(symbol), 3000);
    });
}

function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: 'ping' }));
        }
    }, 20_000);
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}
