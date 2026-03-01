import WebSocket from 'ws';
import { logger } from '../logger.js';
import { orderbookEngine } from '../engines/orderbook.js';

const HL_WS_URL = 'wss://api.hyperliquid.xyz/ws';

let ws: WebSocket | null = null;
let currentCoin = 'BTC';
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) { ws.close(); ws = null; }
    logger.info({ symbol }, 'Hyperliquid adapter stopped');
}

function connect() {
    if (isStopped) return;

    ws = new WebSocket(HL_WS_URL);

    ws.on('open', () => {
        logger.info({ coin: currentCoin }, 'Hyperliquid WS connected');

        // Subscribe to L2 orderbook for this coin
        ws?.send(JSON.stringify({
            method: 'subscribe',
            subscription: {
                type: 'l2Book',
                coin: currentCoin,
            }
        }));
    });

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw.toString());

            // Hyperliquid sends: { channel: 'l2Book', data: { coin, time, levels: [[bids], [asks]] } }
            if (msg.channel !== 'l2Book' || !msg.data) return;

            const { levels, time } = msg.data;
            if (!Array.isArray(levels) || levels.length < 2) return;

            const rawBids = levels[0];   // array of { px, sz, n }
            const rawAsks = levels[1];

            // Convert to orderbookEngine format: [price_string, qty_string][]
            const bids = rawBids.map((l: { px: string; sz: string }) => [l.px, l.sz]);
            const asks = rawAsks.map((l: { px: string; sz: string }) => [l.px, l.sz]);

            // Hyperliquid sends full snapshots every update (no delta/diff protocol)
            // So always call initSnapshot to replace the book
            orderbookEngine.initSnapshot('hyperliquid', { lastUpdateId: time, bids, asks });

        } catch (err) {
            // Silently ignore parse errors — HL occasionally sends ping frames
        }
    });

    ws.on('close', (code) => {
        ws = null;
        if (isStopped) return;
        logger.warn({ coin: currentCoin, code }, 'Hyperliquid WS closed — reconnecting in 3s');
        reconnectTimer = setTimeout(connect, 3000);
    });

    ws.on('error', (err) => {
        logger.error({ err }, 'Hyperliquid WS error');
        ws?.close();
    });
}
