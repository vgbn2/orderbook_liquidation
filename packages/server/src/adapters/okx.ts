import WebSocket from 'ws';
import { logger } from '../logger.js';
import { orderbookEngine } from '../engines/orderbook.js';

let ws: WebSocket | null = null;

export function startOkx(symbol: string) {
    const instId = symbol.toUpperCase().replace('USDT', '-USDT-SWAP');
    ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');

    ws.on('open', () => {
        logger.info('OKX orderbook connected');
        ws?.send(JSON.stringify({
            op: 'subscribe',
            args: [{ channel: 'books', instId }]
        }));
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.arg && msg.arg.channel === 'books' && msg.data && msg.data.length > 0) {
                const book = msg.data[0];
                const cleanBids = book.bids.map((b: any) => [b[0], b[1]]);
                const cleanAsks = book.asks.map((a: any) => [a[0], a[1]]);

                if (msg.action === 'snapshot') {
                    orderbookEngine.initSnapshot('okx', {
                        lastUpdateId: Date.now(),
                        bids: cleanBids,
                        asks: cleanAsks,
                    });
                } else if (msg.action === 'update') {
                    orderbookEngine.applyDelta('okx', {
                        u: Date.now(),
                        b: cleanBids,
                        a: cleanAsks,
                    });
                }
            }
        } catch (e) { }
    });

    ws.on('close', () => {
        setTimeout(() => startOkx(symbol), 3000);
    });
}

export function stopOkx(symbol: string) {
    if (ws) {
        ws.close();
        ws = null;
    }
    logger.info({ symbol }, 'OKX adapter stopped');
}
