import WebSocket from 'ws';
import { logger } from '../logger.js';
import { orderbookEngine } from '../engines/orderbook.js';
import { aggregatedCandleEngine } from '../engines/AggregatedCandleEngine.js';

let ws: WebSocket | null = null;
let currentSymbol = 'btcusdt';
let isStopped = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startMexc(symbol: string) {
    currentSymbol = symbol.toLowerCase();
    isStopped = false;
    connect(currentSymbol);
}

export function stopMexc(symbol: string) {
    isStopped = true;
    stopHeartbeat();
    if (ws) {
        ws.removeAllListeners();
        ws.close();
        ws = null;
    }
    logger.info({ symbol }, 'MEXC adapter stopped');
}

function connect(symbol: string) {
    // Mexc expects symbol in BTCUSDT format for WS
    const formattedSymbol = symbol.toUpperCase();

    try {
        ws = new WebSocket('wss://wbs.mexc.com/ws');
    } catch (err) {
        logger.error({ err }, 'Failed to initialize MEXC WebSocket');
        setTimeout(() => {
            if (!isStopped) connect(symbol);
        }, 3000);
        return;
    }

    ws.on('open', () => {
        logger.info('MEXC orderbook connected');
        ws?.send(JSON.stringify({
            "method": "SUBSCRIPTION",
            "params": [
                `spot@public.limit.depth.v3.api@${formattedSymbol}@50`,
                `spot@public.deals.v3.api@${formattedSymbol}`
            ]
        }));
        startHeartbeat();
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            // Handle Orderbook
            if (msg.c === `spot@public.limit.depth.v3.api@${formattedSymbol}@50` && msg.d) {
                orderbookEngine.applyDelta('mexc', {
                    u: Date.now(),
                    b: msg.d.bids || [],
                    a: msg.d.asks || [],
                    isSnapshot: true
                });
            }

            // Handle Trades
            if (msg.c === `spot@public.deals.v3.api@${formattedSymbol}` && msg.d) {
                for (const t of msg.d) {
                    aggregatedCandleEngine.ingestTrade(
                        'mexc',
                        symbol,
                        parseFloat(t.p),
                        parseFloat(t.v),
                        t.t
                    );
                }
            }
        } catch (e) { }
    });

    ws.on('close', () => {
        stopHeartbeat();
        if (!isStopped) {
            logger.warn({ symbol }, 'MEXC WS closed, reconnecting in 3s');
            setTimeout(() => {
                if (!isStopped) connect(symbol);
            }, 3000);
        }
    });

    ws.on('error', (err) => {
        logger.error({ err }, 'MEXC WS error');
        ws?.close();
    });
}

function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ method: "PING" }));
        }
    }, 20_000);
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}
