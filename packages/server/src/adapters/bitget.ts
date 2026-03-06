import WebSocket from 'ws';
import { logger } from '../logger.js';
import { orderbookEngine } from '../engines/signals/orderbook.js';
import { aggregatedCandleEngine } from '../engines/core/AggregatedCandleEngine.js';

let ws: WebSocket | null = null;
let currentSymbol = 'btcusdt';
let isStopped = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startBitget(symbol: string) {
    currentSymbol = symbol.toLowerCase();
    isStopped = false;
    connect(currentSymbol);
}

export function stopBitget(symbol: string) {
    isStopped = true;
    stopHeartbeat();
    if (ws) {
        ws.removeAllListeners();
        ws.close();
        ws = null;
    }
    logger.info({ symbol }, 'Bitget adapter stopped');
}

function connect(symbol: string) {
    // Bitget expects symbol in BTCUSDT format for Spot
    const formattedSymbol = symbol.toUpperCase();

    try {
        ws = new WebSocket('wss://ws.bitget.com/v2/ws/public');
    } catch (err) {
        logger.error({ err }, 'Failed to initialize Bitget WebSocket');
        setTimeout(() => connect(symbol), 3000);
        return;
    }

    ws.on('open', () => {
        logger.info('Bitget orderbook connected');
        ws?.send(JSON.stringify({
            "op": "subscribe",
            "args": [
                { "instType": "SPOT", "channel": "books50", "instId": formattedSymbol },
                { "instType": "SPOT", "channel": "trade", "instId": formattedSymbol }
            ]
        }));
        startHeartbeat();
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            // Handle Orderbook
            if (msg.channel === 'books50' && msg.data && msg.data.length > 0) {
                const book = msg.data[0];
                if (msg.action === 'snapshot') {
                    orderbookEngine.initSnapshot('bitget', {
                        lastUpdateId: parseInt(book.ts),
                        bids: book.bids || [],
                        asks: book.asks || [],
                    });
                } else if (msg.action === 'update') {
                    orderbookEngine.applyDelta('bitget', {
                        u: parseInt(book.ts),
                        b: book.bids || [],
                        a: book.asks || [],
                    });
                }
            }

            // Handle Trades
            if (msg.channel === 'trade' && msg.data) {
                for (const t of msg.data) {
                    aggregatedCandleEngine.ingestTrade(
                        'bitget',
                        symbol,
                        parseFloat(t.px),
                        parseFloat(t.sz),
                        parseInt(t.ts)
                    );
                }
            }
        } catch (e) { }
    });

    ws.on('close', () => {
        stopHeartbeat();
        if (!isStopped) {
            logger.warn({ symbol }, 'Bitget WS closed, reconnecting in 3s');
            setTimeout(() => {
                if (!isStopped) connect(symbol);
            }, 3000);
        }
    });

    ws.on('error', (err) => {
        logger.error({ err }, 'Bitget WS error');
        ws?.close();
    });
}

function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
        }
    }, 25000);
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}
