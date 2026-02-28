import WebSocket from 'ws';
import { logger } from '../logger.js';
import { clientHub } from '../ws/client-hub.js';

let ws: WebSocket | null = null;

export function startDeribit(symbol: string) {
    const base = symbol.toLowerCase().startsWith('btc') ? 'BTC' : 'ETH';

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
        setTimeout(() => startDeribit(symbol), 3000);
    });
}

export function stopDeribit(symbol: string) {
    if (ws) {
        ws.close();
        ws = null;
    }
    logger.info({ symbol }, 'Deribit adapter stopped');
}
