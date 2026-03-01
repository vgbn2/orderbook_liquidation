import WebSocket from 'ws';
import { logger } from '../logger.js';
import { orderbookEngine } from '../engines/orderbook.js';

let ws: WebSocket | null = null;
let currentSymbol = 'btcusdt';

// Sequence checking state
let lastSeq: number | null = null;
let isResyncing = false;

export function startBybit(symbol: string) {
    currentSymbol = symbol.toUpperCase();
    connect(currentSymbol);
}

export function stopBybit(symbol: string) {
    if (ws) {
        ws.close();
        ws = null;
    }
    lastSeq = null;
    isResyncing = false;
    logger.info({ symbol }, 'Bybit adapter stopped');
}

function wipeAndResync(symbol: string) {
    if (isResyncing) return;
    isResyncing = true;

    logger.error({ symbol }, 'Desync Detected on Bybit — Refetching Snapshot');

    if (ws) {
        ws.removeAllListeners();
        ws.terminate();
        ws = null;
    }

    // Attempt reconnect
    setTimeout(() => connect(symbol), 100);
}

function connect(symbol: string) {
    isResyncing = false;
    lastSeq = null; // Reset on new connection

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

                // Bybit v5 specific sequence checking
                const currentSeq = msg.data.seq || msg.seq;

                if (msg.type === 'snapshot') {
                    // Initial snapshot establishes the baseline seq
                    lastSeq = currentSeq;

                    orderbookEngine.initSnapshot('bybit', {
                        lastUpdateId: Date.now(),
                        bids: msg.data.b || [],
                        asks: msg.data.a || [],
                    });
                } else if (msg.type === 'delta') {
                    // Check logic: Contiguous update?
                    if (lastSeq !== null && currentSeq) {
                        if (currentSeq !== lastSeq + 1) {
                            // Gap detected
                            logger.error({ expected: lastSeq + 1, received: currentSeq }, 'Bybit Sequence Gap');
                            wipeAndResync(symbol);
                            return;
                        }
                    }

                    lastSeq = currentSeq;

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
        if (!isResyncing) setTimeout(() => connect(symbol), 3000);
    });
}
