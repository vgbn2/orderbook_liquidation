import WebSocket from 'ws';
import { logger } from '../logger.js';
import { clientHub } from '../ws/client-hub.js';

let ws: WebSocket | null = null;
let isStopped = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startDeribit(symbol: string) {
    const base = symbol.toLowerCase().startsWith('btc') ? 'BTC' : 'ETH';
    isStopped = false;
    ws = new WebSocket('wss://www.deribit.com/ws/api/v2');

    ws.on('open', () => {
        logger.info('Deribit options connected');
        ws?.send(JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'public/subscribe',
            params: {
                channels: [`trades.${base}-option.raw`]
            }
        }));
        startHeartbeat();
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.params && msg.params.channel.startsWith('trades.')) {
                const trades = msg.params.data;
                const formattedOptions = trades.map((t: any) => ({
                    time: t.timestamp,
                    instrument: t.instrument_name,
                    price: t.price,
                    amount: t.amount,
                    side: t.direction,
                    iv: t.iv || 0 // implied volatility
                }));
                clientHub.broadcast('options.large_trade' as any, formattedOptions[0]);
            }
        } catch (e) { }
    });

    ws.on('close', () => {
        stopHeartbeat();
        if (!isStopped) setTimeout(() => startDeribit(symbol), 3000);
    });
}

export function stopDeribit(symbol: string) {
    isStopped = true;
    stopHeartbeat();
    if (ws) {
        ws.removeAllListeners();
        ws.close();
        ws = null;
    }
    logger.info({ symbol }, 'Deribit adapter stopped');
}

function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                jsonrpc: '2.0',
                method: 'public/test',
                id: Date.now()
            }));
        }
    }, 20_000);
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}
