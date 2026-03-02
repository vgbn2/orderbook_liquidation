import WebSocket from 'ws';
import { logger } from '../logger.js';
import { orderbookEngine } from '../engines/orderbook.js';
import { aggregatedCandleEngine } from '../engines/AggregatedCandleEngine.js';

let ws: WebSocket | null = null;
let isStopped = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startOkx(symbol: string) {
    const instId = symbol.toUpperCase().replace('USDT', '-USDT-SWAP');
    isStopped = false;
    ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');

    ws.on('open', () => {
        logger.info('OKX orderbook connected');
        ws?.send(JSON.stringify({
            op: 'subscribe',
            args: [
                { channel: 'books', instId },
                { channel: 'trades', instId }
            ]
        }));
        startHeartbeat();
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            // Handle Orderbook
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

            // Handle Trades
            if (msg.arg && msg.arg.channel === 'trades' && msg.data) {
                for (const t of msg.data) {
                    aggregatedCandleEngine.ingestTrade(
                        'okx',
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
        if (!isStopped) setTimeout(() => startOkx(symbol), 3000);
    });
}

export function stopOkx(symbol: string) {
    isStopped = true;
    stopHeartbeat();
    if (ws) {
        ws.removeAllListeners();
        ws.close();
        ws = null;
    }
    logger.info({ symbol }, 'OKX adapter stopped');
}

function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send("ping"); // OKX public WS expects literal "ping" string
        }
    }, 20_000);
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}
