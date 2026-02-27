import WebSocket from 'ws';
import { logger } from '../logger.js';
import type { Exchange } from '../adapters/types.js';

// ══════════════════════════════════════════════════════════════
//  Exchange WebSocket URLs
// ══════════════════════════════════════════════════════════════

const EXCHANGE_WS_URLS: Partial<Record<Exchange, string>> = {
    binance: 'wss://stream.binance.com:9443/ws',
    bybit: 'wss://stream.bybit.com/v5/public/linear',
    okx: 'wss://ws.okx.com:8443/ws/v5/public',
    deribit: 'wss://www.deribit.com/ws/api/v2',
    hyperliquid: 'wss://api.hyperliquid.xyz/ws',
};

// ══════════════════════════════════════════════════════════════
//  Exchange Connection State
// ══════════════════════════════════════════════════════════════

interface ExchangeConnection {
    ws: WebSocket | null;
    exchange: Exchange;
    health: 'healthy' | 'degraded' | 'down';
    reconnectAttempts: number;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    onMessage: (exchange: Exchange, data: unknown) => void;
}

// ══════════════════════════════════════════════════════════════
//  WebSocket Manager
// ══════════════════════════════════════════════════════════════

export class WSManager {
    private connections = new Map<Exchange, ExchangeConnection>();

    /**
     * Connect to an exchange WebSocket with auto-reconnect.
     */
    async connectExchange(
        exchange: Exchange,
        onMessage: (exchange: Exchange, data: unknown) => void,
    ): Promise<void> {
        const url = EXCHANGE_WS_URLS[exchange];
        if (!url) {
            logger.warn({ exchange }, 'No WS URL configured for exchange');
            return;
        }

        const conn: ExchangeConnection = {
            ws: null,
            exchange,
            health: 'down',
            reconnectAttempts: 0,
            reconnectTimer: null,
            onMessage,
        };

        this.connections.set(exchange, conn);
        await this._connect(conn, url);
    }

    private async _connect(conn: ExchangeConnection, url: string): Promise<void> {
        return new Promise((resolve) => {
            logger.info({ exchange: conn.exchange }, 'Connecting to exchange WS...');

            const ws = new WebSocket(url, {
                handshakeTimeout: 10_000,
            });

            conn.ws = ws;

            ws.on('open', () => {
                logger.info({ exchange: conn.exchange }, 'Exchange WS connected');
                conn.health = 'healthy';
                conn.reconnectAttempts = 0;
                resolve();
            });

            ws.on('message', (raw: WebSocket.RawData) => {
                try {
                    const data = JSON.parse(raw.toString());
                    conn.onMessage(conn.exchange, data);
                } catch (err) {
                    logger.error({ exchange: conn.exchange, err }, 'Failed to parse exchange message');
                }
            });

            ws.on('close', (code, reason) => {
                logger.warn(
                    { exchange: conn.exchange, code, reason: reason.toString() },
                    'Exchange WS closed',
                );
                conn.health = 'down';
                this._scheduleReconnect(conn, url);
            });

            ws.on('error', (err) => {
                logger.error({ exchange: conn.exchange, err: err.message }, 'Exchange WS error');
                conn.health = 'degraded';
            });

            // Timeout if connection hangs
            setTimeout(() => {
                if (conn.health === 'down') {
                    logger.warn({ exchange: conn.exchange }, 'WS connection timeout');
                    ws.terminate();
                    resolve();
                }
            }, 15_000);
        });
    }

    /**
     * Exponential backoff reconnect: 1s → 2s → 4s → ... → max 60s
     */
    private _scheduleReconnect(conn: ExchangeConnection, url: string): void {
        if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);

        const delay = Math.min(1000 * Math.pow(2, conn.reconnectAttempts), 60_000);
        conn.reconnectAttempts++;

        logger.info(
            { exchange: conn.exchange, delay, attempt: conn.reconnectAttempts },
            'Scheduling reconnect',
        );

        conn.reconnectTimer = setTimeout(async () => {
            try {
                await this._connect(conn, url);
            } catch (err) {
                logger.error({ exchange: conn.exchange, err }, 'Reconnect failed');
                this._scheduleReconnect(conn, url);
            }
        }, delay);
    }

    /**
     * Send a JSON message to an exchange WS (e.g., subscribe commands).
     */
    sendToExchange(exchange: Exchange, message: unknown): void {
        const conn = this.connections.get(exchange);
        if (!conn?.ws || conn.ws.readyState !== WebSocket.OPEN) {
            logger.warn({ exchange }, 'Cannot send — WS not open');
            return;
        }
        conn.ws.send(JSON.stringify(message));
    }

    /**
     * Get the health status of an exchange connection.
     */
    getHealth(exchange: Exchange): 'healthy' | 'degraded' | 'down' {
        return this.connections.get(exchange)?.health ?? 'down';
    }

    /**
     * Get health status for all connected exchanges.
     */
    getAllHealth(): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [ex, conn] of this.connections) {
            result[ex] = conn.health;
        }
        return result;
    }

    /**
     * Gracefully close all exchange connections.
     */
    async disconnectAll(): Promise<void> {
        logger.info('Disconnecting all exchange WebSockets...');
        for (const [, conn] of this.connections) {
            if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
            if (conn.ws) {
                conn.ws.removeAllListeners();
                conn.ws.close(1000, 'Server shutdown');
            }
        }
        this.connections.clear();
    }
}

export const wsManager = new WSManager();
