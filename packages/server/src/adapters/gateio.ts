import WebSocket from 'ws';
import { logger } from '../logger.js';
import { orderbookEngine } from '../engines/signals/orderbook.js';
import { aggregatedCandleEngine } from '../engines/core/AggregatedCandleEngine.js';

let ws: WebSocket | null = null;
let currentSymbol = 'btcusdt';
let isStopped = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startGateio(symbol: string) {
    currentSymbol = symbol.toLowerCase();
    isStopped = false;
    connect(currentSymbol);
}

export function stopGateio(symbol: string) {
    isStopped = true;
    stopHeartbeat();
    if (ws) {
        ws.removeAllListeners();
        ws.close();
        ws = null;
    }
    logger.info({ symbol }, 'Gate.io adapter stopped');
}

function connect(symbol: string) {
    // Gate.io expects symbol in BTC_USDT format for Spot
    const formattedSymbol = symbol.toUpperCase().replace('USDT', '_USDT');

    ws = new WebSocket('wss://api.gateio.ws/ws/v4/');

    ws.on('open', () => {
        logger.info('Gate.io orderbook connected');
        // Subscribe to Orderbook
        ws?.send(JSON.stringify({
            "time": Math.floor(Date.now() / 1000),
            "channel": "spot.order_book",
            "event": "subscribe",
            "payload": [formattedSymbol, "20", "100ms"]
        }));

        // Subscribe to Trades
        ws?.send(JSON.stringify({
            "time": Math.floor(Date.now() / 1000),
            "channel": "spot.trades",
            "event": "subscribe",
            "payload": [formattedSymbol]
        }));
        startHeartbeat();
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            // Handle Orderbook
            if (msg.channel === 'spot.order_book' && msg.event === 'update') {
                const book = msg.result;
                orderbookEngine.applyDelta('gateio', {
                    u: book.t || Date.now(),
                    b: book.bids || [],
                    a: book.asks || [],
                    isSnapshot: true
                });
            }

            // Handle Trades
            if (msg.channel === 'spot.trades' && msg.event === 'update') {
                for (const t of msg.result) {
                    aggregatedCandleEngine.ingestTrade(
                        'gateio',
                        symbol,
                        parseFloat(t.price),
                        parseFloat(t.amount),
                        Math.floor(parseFloat(t.create_time_ms))
                    );
                }
            }
        } catch (e) { }
    });

    ws.on('close', () => {
        stopHeartbeat();
        if (!isStopped) {
            logger.warn({ symbol }, 'Gate.io WS closed, reconnecting in 3s');
            setTimeout(() => {
                if (!isStopped) connect(symbol);
            }, 3000);
        }
    });

    ws.on('error', (err) => {
        logger.error({ err }, 'Gate.io WS error');
        ws?.close();
    });
}

function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                time: Math.floor(Date.now() / 1000),
                channel: "spot.ping",
                event: "ping"
            }));
        }
    }, 30000);
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}
