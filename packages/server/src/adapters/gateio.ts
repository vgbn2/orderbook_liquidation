import WebSocket from 'ws';
import { logger } from '../logger.js';
import { orderbookEngine } from '../engines/orderbook.js';

let ws: WebSocket | null = null;
let currentSymbol = 'btcusdt';

export function startGateio(symbol: string) {
    currentSymbol = symbol.toLowerCase();
    connect(currentSymbol);
}

export function stopGateio(symbol: string) {
    if (ws) {
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
        ws?.send(JSON.stringify({
            "time": Math.floor(Date.now() / 1000),
            "channel": "spot.order_book",
            "event": "subscribe",
            "payload": [formattedSymbol, "20", "100ms"] // Get 20 levels every 100ms
        }));
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.event === 'subscribe' && msg.result?.status === 'success') return;

            if (msg.channel === 'spot.order_book' && msg.event === 'update') {
                const book = msg.result;

                // Gate.io pushes full snapshots (of the specified level depth) repeatedly for this channel config
                // We'll treat it as a massive delta payload to merge into the main tree

                orderbookEngine.applyDelta('gateio', {
                    u: book.t || Date.now(),
                    b: book.bids || [],
                    a: book.asks || [],
                    isSnapshot: true // Tell engine to replace entirely rather than merge
                });
            }
        } catch (e) {
            // ignore JSON parse errors
        }
    });

    // Gate requires Ping every 120s max
    const pingInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                time: Math.floor(Date.now() / 1000),
                channel: "spot.ping",
                event: "ping"
            }));
        }
    }, 30000);

    ws.on('close', () => {
        clearInterval(pingInterval);
        logger.warn({ symbol }, 'Gate.io WS closed, reconnecting in 3s');
        setTimeout(() => connect(symbol), 3000);
    });

    ws.on('error', (err) => {
        logger.error({ err }, 'Gate.io WS error');
        ws?.close();
    });
}
