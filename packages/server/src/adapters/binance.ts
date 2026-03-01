import WebSocket from 'ws';
import { logger } from '../logger.js';
import { query } from '../db/timescale.js';
import { redis } from '../db/redis.js';
import { clientHub } from '../ws/client-hub.js';
import { orderbookEngine } from '../engines/orderbook.js';
import { amdDetector } from '../engines/amd.js';
import { ictEngine } from '../engines/ict.js';
import type { Candle, ExchangeAdapter, Exchange } from './types.js';

// ══════════════════════════════════════════════════════════════
//  Binance Adapter — OHLCV via REST + Live WS Kline/Orderbook
// ══════════════════════════════════════════════════════════════

const REST_BASE = 'https://fapi.binance.com';
const WS_BASE = 'wss://fstream.binance.com/ws';

export class BinanceAdapter implements ExchangeAdapter {
    readonly name: Exchange = 'binance';
    health: 'healthy' | 'degraded' | 'down' = 'down';

    private ws: WebSocket | null = null;
    private wsDepth: WebSocket | null = null;
    private wsTrades: WebSocket | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private depthReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private tradesReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts = 0;
    private lastKlineBroadcast = 0;
    private symbol = 'btcusdt';
    private intervals = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];
    private pollTimer: ReturnType<typeof setInterval> | null = null;

    // Trade batching state
    private tradeBatch: any[] = [];
    private tradeBroadcastTimer: ReturnType<typeof setInterval> | null = null;

    /**
     * Fetch historical klines from Binance REST API.
     */
    async fetchKlines(
        symbol = 'BTCUSDT',
        interval = '1m',
        limit = 500,
    ): Promise<Candle[]> {
        let remaining = limit;
        let endTime: number | undefined = undefined;
        let allCandles: unknown[][] = [];
        const MAX_PER_REQUEST = 1500;

        try {
            while (remaining > 0) {
                const batchLimit = Math.min(remaining, MAX_PER_REQUEST);
                let url = `${REST_BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${batchLimit}`;
                if (endTime) {
                    url += `&endTime=${endTime}`;
                }

                const res = await fetch(url);
                if (!res.ok) throw new Error(`Binance REST ${res.status}`);

                const data = await res.json() as unknown[][];
                if (data.length === 0) break;

                // Prepend since we are fetching backwards in time
                allCandles = data.concat(allCandles);
                remaining -= data.length;

                // The first candle is the oldest. Use its open time - 1 as the endTime for the next batch.
                endTime = (data[0][0] as number) - 1;

                if (data.length < batchLimit) {
                    // Hit the beginning of available history
                    break;
                }
            }

            return allCandles.map((k) => ({
                time: Math.floor((k[0] as number) / 1000),
                open: parseFloat(k[1] as string),
                high: parseFloat(k[2] as string),
                low: parseFloat(k[3] as string),
                close: parseFloat(k[4] as string),
                volume: parseFloat(k[5] as string),
                exchange: 'binance' as Exchange,
            }));
        } catch (err) {
            logger.error({ err }, 'Binance REST klines fetch failed');
            return [];
        }
    }

    /**
     * Connect to Binance WS for live kline updates.
     */
    async connect(): Promise<void> {
        return new Promise((resolve) => {
            const streams = this.intervals.map(i => `${this.symbol}@kline_${i}`).join('/');
            const url = `${WS_BASE}/stream?streams=${streams}`;

            logger.info({ streams }, 'Connecting to Binance kline streams...');

            this.ws = new WebSocket(url, { handshakeTimeout: 10_000 });

            this.ws.on('open', () => {
                logger.info('Binance kline streams connected');
                this.health = 'healthy';
                this.reconnectAttempts = 0;
                resolve();
            });

            this.ws.on('message', (raw) => {
                try {
                    const msg = JSON.parse(raw.toString());
                    // Combined stream format: { stream: "btcusdt@kline_1m", data: { e: "kline", k: { ... } } }
                    if (msg.data && msg.data.e === 'kline') {
                        const interval = msg.data.k.i;
                        this._handleKline(msg.data.k, interval);
                    } else if (msg.e === 'kline') {
                        // Fallback just in case
                        this._handleKline(msg.k, msg.k.i);
                    }
                } catch (err) {
                    logger.error({ err }, 'Binance kline parse error');
                }
            });

            this.ws.on('close', () => {
                this.health = 'down';
                logger.warn('Binance kline stream closed');
                this._scheduleReconnect();
            });

            this.ws.on('error', (err) => {
                logger.error({ err: (err as Error).message }, 'Binance WS error');
                this.health = 'degraded';
            });

            setTimeout(() => {
                if (this.health === 'down') {
                    logger.warn('Binance kline connection timeout');
                    resolve();
                }
            }, 15_000);
        });
    }

    private _handleKline(k: {
        t: number;       // kline start time
        o: string;       // open
        h: string;       // high
        l: string;       // low
        c: string;       // close
        v: string;       // volume
        x: boolean;      // is this kline closed?
        i: string;       // interval
    }, interval: string): void {
        const candle: Candle & { isUpdate?: boolean; interval?: string } = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
            exchange: 'binance',
            isUpdate: !k.x,
            interval: interval
        };

        // Broadcast to frontend
        const now = Date.now();
        // Throttle updates for 1m interval to 500ms, for others we can just send
        const is1m = interval === '1m';
        if (k.x || !is1m || now - this.lastKlineBroadcast > 500) {
            clientHub.broadcast(`candles.binance.${this.symbol.toUpperCase()}.${interval}` as any, candle);
            if (is1m) this.lastKlineBroadcast = now;
        }

        // Cache latest price in Redis
        redis.set(`price:${this.symbol.toUpperCase()}`, candle.close.toString()).catch(() => { });
        import('../engines/alerts.js').then(m => m.alertsEngine.setSpot(candle.close));

        // Persist closed candles to TimescaleDB
        const PERSIST_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'];
        if (k.x && PERSIST_INTERVALS.includes(interval)) {
            // Feed ICT Engine on candle close
            ictEngine.onCandle(candle);

            // Feed AMD Reversal Detector on candle close (only for 1m)
            if (interval === '1m') amdDetector.onCandle(candle);

            query(
                `INSERT INTO ohlcv_candles (time, exchange, symbol, timeframe, open, high, low, close, volume)
         VALUES (to_timestamp($1), $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT DO NOTHING`,
                [candle.time, 'binance', this.symbol.toUpperCase(), interval, candle.open, candle.high, candle.low, candle.close, candle.volume],
            ).catch((err) => logger.error({ err }, 'Failed to persist candle'));
        }
    }

    private _scheduleReconnect(): void {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60_000);
        this.reconnectAttempts++;

        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }

    async disconnect(): Promise<void> {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.depthReconnectTimer) clearTimeout(this.depthReconnectTimer);
        if (this.tradesReconnectTimer) clearTimeout(this.tradesReconnectTimer);
        if (this.pollTimer) clearInterval(this.pollTimer);
        if (this.tradeBroadcastTimer) {
            clearInterval(this.tradeBroadcastTimer);
            this.tradeBroadcastTimer = null;
        }
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close(1000, 'Shutdown');
        }
        if (this.wsDepth) {
            this.wsDepth.removeAllListeners();
            this.wsDepth.close(1000, 'Shutdown');
        }
        if (this.wsTrades) {
            this.wsTrades.removeAllListeners();
            this.wsTrades.close(1000, 'Shutdown');
        }
        orderbookEngine.stop();
        this.health = 'down';
    }

    /**
     * Switch to a new market symbol globally
     */
    async switchSymbol(newSymbol: string): Promise<void> {
        this.symbol = newSymbol.toLowerCase();
        logger.info({ symbol: this.symbol }, 'BinanceAdapter switching symbol');

        await this.disconnect();

        // Brief delay before reconnecting to ensure connections are fully closed
        await new Promise(resolve => setTimeout(resolve, 500));

        this.health = 'degraded';
        await this.connect();
        await this.connectOrderbook();
        await this.connectTrades();
        this.startPolling(this.symbol.toUpperCase());
    }

    /**
     * Start background polling for Funding Rate and Open Interest
     */
    startPolling(symbol = 'BTCUSDT') {
        if (this.pollTimer) clearInterval(this.pollTimer);

        const poll = async () => {
            try {
                // Fetch Funding
                const fRes = await fetch(`${REST_BASE}/fapi/v1/fundingRate?symbol=${symbol}&limit=100`);
                if (fRes.ok) {
                    const fData = await fRes.json() as any[];
                    if (fData.length > 0) {
                        clientHub.broadcast('funding_rate' as any, fData.map((f: any) => ({
                            time: f.fundingTime,
                            rate: parseFloat(f.fundingRate)
                        })));
                    }
                }

                // Fetch OI
                const oRes = await fetch(`${REST_BASE}/fapi/v1/openInterest?symbol=${symbol}`);
                if (oRes.ok) {
                    const oData = await oRes.json() as any;
                    clientHub.broadcast('open_interest' as any, {
                        time: oData.time,
                        oi: parseFloat(oData.openInterest)
                    });
                }
            } catch (err) {
                logger.error({ err }, 'Failed to poll Funding/OI');
            }
        };

        poll(); // immediate
        this.pollTimer = setInterval(poll, 60_000); // 60s updates
    }

    /**
     * Connect to orderbook depth stream + fetch initial snapshot.
     */
    async connectOrderbook(): Promise<void> {
        try {
            // 1. Fetch REST depth snapshot
            const snapRes = await fetch(`${REST_BASE}/fapi/v1/depth?symbol=${this.symbol.toUpperCase()}&limit=100`);
            if (!snapRes.ok) throw new Error(`Depth snapshot ${snapRes.status}`);
            const snap = await snapRes.json() as {
                lastUpdateId: number;
                bids: [string, string][];
                asks: [string, string][];
            };
            orderbookEngine.initSnapshot('binance', snap);

            // 2. Subscribe to WS depth deltas
            const url = `${WS_BASE}/${this.symbol}@depth@100ms`;
            this.wsDepth = new WebSocket(url, { handshakeTimeout: 10_000 });

            this.wsDepth.on('open', () => {
                logger.info('Binance depth stream connected');
            });

            this.wsDepth.on('message', (raw) => {
                try {
                    const msg = JSON.parse(raw.toString());
                    if (msg.e === 'depthUpdate') {
                        orderbookEngine.applyDelta('binance', {
                            u: msg.u,
                            b: msg.b,
                            a: msg.a,
                        });
                    }
                } catch (err) {
                    logger.error({ err }, 'Binance depth parse error');
                }
            });

            this.wsDepth.on('close', () => {
                logger.warn('Binance depth stream closed');
                this.depthReconnectTimer = setTimeout(() => this.connectOrderbook(), 3000);
            });

            this.wsDepth.on('error', (err) => {
                logger.error({ err: (err as Error).message }, 'Binance depth WS error');
            });
        } catch (err) {
            logger.error({ err }, 'Failed to init orderbook');
            this.depthReconnectTimer = setTimeout(() => this.connectOrderbook(), 5000);
        }
    }

    /**
     * Connect to live trades stream.
     */
    async connectTrades(): Promise<void> {
        try {
            const url = `${WS_BASE}/${this.symbol}@aggTrade`;
            this.wsTrades = new WebSocket(url, { handshakeTimeout: 10_000 });

            this.wsTrades.on('open', () => {
                logger.info('Binance trades stream connected');

                // Start batched broadcast loop (every 250ms)
                if (this.tradeBroadcastTimer) clearInterval(this.tradeBroadcastTimer);
                this.tradeBroadcastTimer = setInterval(() => {
                    if (this.tradeBatch.length > 0) {
                        clientHub.broadcast('trades' as any, this.tradeBatch);
                        this.tradeBatch = [];
                    }
                }, 250);
            });

            this.wsTrades.on('message', (raw) => {
                try {
                    const msg = JSON.parse(raw.toString());
                    if (msg.e === 'aggTrade') {
                        const trade = {
                            time: msg.E,
                            price: parseFloat(msg.p),
                            qty: parseFloat(msg.q),
                            side: msg.m ? 'sell' : 'buy', // m: true means buyer is market maker -> sell
                            exchange: 'binance',
                            symbol: this.symbol.toUpperCase()
                        };

                        // Batch trades instead of broadcasting immediately
                        this.tradeBatch.push(trade);

                        // Persist to TimescaleDB for Replay
                        query(`
                            INSERT INTO big_trades (time, exchange, symbol, price, qty, side)
                            VALUES (TO_TIMESTAMP($1 / 1000.0), $2, $3, $4, $5, $6)
                        `, [trade.time, trade.exchange, trade.symbol, trade.price, trade.qty, trade.side])
                            .catch(err => logger.error({ err }, 'Failed to persist big trade'));
                    }
                } catch (err) {
                    logger.error({ err }, 'Binance trades parse error');
                }
            });

            this.wsTrades.on('close', () => {
                logger.warn('Binance trades stream closed');
                this.tradesReconnectTimer = setTimeout(() => this.connectTrades(), 3000);
            });

            this.wsTrades.on('error', (err) => {
                logger.error({ err: (err as Error).message }, 'Binance trades WS error');
            });
        } catch (err) {
            logger.error({ err }, 'Failed to init trades stream');
            this.tradesReconnectTimer = setTimeout(() => this.connectTrades(), 5000);
        }
    }
}

export const binanceAdapter = new BinanceAdapter();
