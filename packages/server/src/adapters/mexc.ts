import WebSocket from 'ws';
import { logger } from '../logger.js';
import { orderbookEngine } from '../engines/orderbook.js';

let ws: WebSocket | null = null;
let currentSymbol = 'btcusdt';

export function startMexc(symbol: string) {
    currentSymbol = symbol.toLowerCase();
    connect(currentSymbol);
}

export function stopMexc(symbol: string) {
    if (ws) {
        ws.close();
        ws = null;
    }
    logger.info({ symbol }, 'MEXC adapter stopped');
}

function connect(symbol: string) {
    // Mexc expects symbol in BTCUSDT format for WS
    const formattedSymbol = symbol.toUpperCase();

    ws = new WebSocket('wss://wbs.mexc.com/ws');

    ws.on('open', () => {
        logger.info('MEXC orderbook connected');
        ws?.send(JSON.stringify({
            "method": "SUBSCRIPTION",
            "params": [
                `spot@public.limit.depth.v3.api@${formattedSymbol}@50`
            ]
        }));
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            // Channel subscription confirmation
            if (msg.id === 0 && msg.msg === 'Ok') return;

            if (msg.c === `spot@public.limit.depth.v3.api@${formattedSymbol}@50` && msg.d) {
                // MEXC doesn't send "snapshots" then "deltas" in this specific channel,
                // it sends full depth limit snapshots every message
                // However, we format it as a delta so the engine merges it into the live book cleanly

                orderbookEngine.applyDelta('mexc', {
                    u: Date.now(), // MEXC doesn't provide strict seq numbers in this feed
                    b: msg.d.bids || [],
                    a: msg.d.asks || [],
                    isSnapshot: true // Tell engine to replace entirely rather than merge
                });
            }
        } catch (e) {
            // ignore JSON parse errors or malformed data
        }
    });

    ws.on('close', () => {
        logger.warn({ symbol }, 'MEXC WS closed, reconnecting in 3s');
        setTimeout(() => connect(symbol), 3000);
    });

    ws.on('error', (err) => {
        logger.error({ err }, 'MEXC WS error');
        ws?.close();
    });
}
