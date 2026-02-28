import WebSocket from 'ws';
import { logger } from '../logger.js';
import { orderbookEngine } from '../engines/orderbook.js';

let ws: WebSocket | null = null;
let currentSymbol = 'btcusdt';

export function startBybit(symbol: string) {
    currentSymbol = symbol.toUpperCase();
    connect(currentSymbol);
}

export function stopBybit(symbol: string) {
    if (ws) {
        ws.close();
        ws = null;
    }
    logger.info({ symbol }, 'Bybit adapter stopped');
}

function connect(symbol: string) {
    ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');

    ws.on('open', () => {
        logger.info('Bybit orderbook connected');
        ws?.send(JSON.stringify({
            op: 'subscribe',
            args: [`orderbook.50.${symbol}`]
        }));
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.topic === `orderbook.50.${symbol}` && msg.data) {
                if (msg.type === 'snapshot') {
                    orderbookEngine.initSnapshot('bybit', {
                        lastUpdateId: Date.now(),
                        bids: msg.data.b || [],
                        asks: msg.data.a || [],
                    });
                } else if (msg.type === 'delta') {
                    orderbookEngine.applyDelta('bybit', {
                        u: Date.now(),
                        b: msg.data.b || [],
                        a: msg.data.a || [],
                    });
                }
            }
        } catch (e) { }
    });

    ws.on('close', () => {
        setTimeout(() => connect(symbol), 3000);
    });
}
