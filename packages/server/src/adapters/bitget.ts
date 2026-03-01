import WebSocket from 'ws';
import { logger } from '../logger.js';
import { orderbookEngine } from '../engines/orderbook.js';

let ws: WebSocket | null = null;
let currentSymbol = 'btcusdt';

export function startBitget(symbol: string) {
    currentSymbol = symbol.toLowerCase();
    connect(currentSymbol);
}

export function stopBitget(symbol: string) {
    if (ws) {
        ws.close();
        ws = null;
    }
    logger.info({ symbol }, 'Bitget adapter stopped');
}

function connect(symbol: string) {
    // Bitget expects symbol in BTCUSDT format for Spot
    const formattedSymbol = symbol.toUpperCase();

    ws = new WebSocket('wss://ws.bitget.com/v2/ws/public');

    ws.on('open', () => {
        logger.info('Bitget orderbook connected');
        ws?.send(JSON.stringify({
            "op": "subscribe",
            "args": [{
                "instType": "SPOT",
                "channel": "books50",
                "instId": formattedSymbol
            }]
        }));
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            // Channel subscription confirmation or ping
            if (msg.event === 'subscribe') return;
            if (msg === 'pong') return;

            if (msg.action === 'snapshot' && msg.data && msg.data.length > 0) {
                const book = msg.data[0];
                orderbookEngine.initSnapshot('bitget', {
                    lastUpdateId: parseInt(book.ts),
                    bids: book.bids || [],
                    asks: book.asks || [],
                });
            } else if (msg.action === 'update' && msg.data && msg.data.length > 0) {
                const book = msg.data[0];
                orderbookEngine.applyDelta('bitget', {
                    u: parseInt(book.ts),
                    b: book.bids || [],
                    a: book.asks || [],
                });
            }
        } catch (e) {
            // ignore JSON parse errors
        }
    });

    // Bitget requires pings every 30s
    const pingInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
            ws.send('ping');
        }
    }, 25000);

    ws.on('close', () => {
        clearInterval(pingInterval);
        logger.warn({ symbol }, 'Bitget WS closed, reconnecting in 3s');
        setTimeout(() => connect(symbol), 3000);
    });

    ws.on('error', (err) => {
        logger.error({ err }, 'Bitget WS error');
        ws?.close();
    });
}
