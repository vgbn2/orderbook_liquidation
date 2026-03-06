import WebSocket from 'ws';
import { logger } from '../logger.js';
import { orderbookEngine } from '../engines/signals/orderbook.js';
import { aggregatedCandleEngine } from '../engines/core/AggregatedCandleEngine.js';

const HL_WS_URL = 'wss://api.hyperliquid.xyz/ws';

let ws: WebSocket | null = null;
let currentCoin = 'BTC';
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let isStopped = false;

export function startHyperliquid(symbol: string) {
    // symbol is like 'BTCUSDT' — strip USDT to get the HL coin name
    let stripped = symbol.replace(/USDT$/, '').replace(/USDC$/, '').toUpperCase();

    const HL_COIN_MAP: Record<string, string> = {
        '1000PEPE': 'kPEPE',
        '1000SHIB': 'kSHIB',
        '1000BONK': 'kBONK',
        '1000FLOKI': 'kFLOKI',
    };
    currentCoin = HL_COIN_MAP[stripped] ?? stripped;

    isStopped = false;
    connect();
}

export function stopHyperliquid(symbol: string) {
    isStopped = true;
    stopHeartbeat();
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) {
        ws.removeAllListeners();
        ws.close();
        ws = null;
    }
    logger.info({ symbol }, 'Hyperliquid adapter stopped');
}

function connect() {
    if (isStopped) return;

    try {
        ws = new WebSocket(HL_WS_URL);
    } catch (err) {
        logger.error({ err }, 'Failed to initialize Hyperliquid WebSocket');
        reconnectTimer = setTimeout(() => {
            if (!isStopped) connect();
        }, 3000);
        return;
    }

    ws.on('open', () => {
        logger.info({ coin: currentCoin }, 'Hyperliquid WS connected');

        // Subscribe to L2 orderbook
        ws?.send(JSON.stringify({
            method: 'subscribe',
            subscription: { type: 'l2Book', coin: currentCoin }
        }));

        // Subscribe to Trades
        ws?.send(JSON.stringify({
            method: 'subscribe',
            subscription: { type: 'trades', coin: currentCoin }
        }));
        startHeartbeat();
    });

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw.toString());

            // Handle Orderbook
            if (msg.channel === 'l2Book' && msg.data) {
                const { levels, time } = msg.data;
                const bids = levels[0].map((l: any) => [l.px, l.sz]);
                const asks = levels[1].map((l: any) => [l.px, l.sz]);
                orderbookEngine.initSnapshot('hyperliquid', { lastUpdateId: time, bids, asks });
            }

            // Handle Trades
            if (msg.channel === 'trades' && msg.data) {
                for (const t of msg.data) {
                    if (t.coin !== currentCoin) continue;
                    aggregatedCandleEngine.ingestTrade(
                        'hyperliquid',
                        `${t.coin}USDT`, // Normalized symbol
                        parseFloat(t.px),
                        parseFloat(t.sz),
                        t.side === 'B' ? t.time : t.time // HL uses side but time is same
                    );
                }
            }
        } catch (err) { }
    });

    ws.on('close', (code) => {
        stopHeartbeat();
        ws = null;
        if (isStopped) return;
        logger.warn({ coin: currentCoin, code }, 'Hyperliquid WS closed — reconnecting in 3s');
        reconnectTimer = setTimeout(() => {
            if (!isStopped) connect();
        }, 3000);
    });

    ws.on('error', (err) => {
        logger.error({ err }, 'Hyperliquid WS error');
        ws?.close();
    });
}

function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ method: 'ping' }));
        }
    }, 20_000);
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}
