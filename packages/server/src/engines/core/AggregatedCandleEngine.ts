import { EventEmitter } from 'events';
import { Trade, Exchange } from '../adapters/types.js';
import { logger } from '../logger.js';
import { query } from '../db/timescale.js';
import { clientHub } from '../ws/client-hub.js';

interface CandleAccumulator {
    open: number | null;
    high: number;
    low: number;
    close: number | null;
    volume: number;
    quoteVolume: number;
    tradeCount: number;
    openTime: number;
    sumPriceXVol: number;
    sumVol: number;
    exchangeVolume: Record<string, number>;
}

export class AggregatedCandleEngine extends EventEmitter {
    private accumulators = new Map<string, CandleAccumulator>();
    // 1m, 5m, 15m, 1h, 4h, 1d
    private readonly SUPPORTED_INTERVALS = [60, 300, 900, 3600, 14400, 86400, 604800, 2592000];
    private dirtyAccumulators = new Set<string>();
    private broadcastInterval: NodeJS.Timeout;

    constructor() {
        super();
        // Throttle WebSocket updates — Broadcast "dirty" candles every 100ms
        // significantly reduces CPU/Network load compared to on-every-trade
        this.broadcastInterval = setInterval(() => this.processBroadcastQueue(), 100);
    }

    public destroy() {
        clearInterval(this.broadcastInterval);
    }

    /**
     * Ingest a new trade from any exchange and update aggregated candles
     */
    public ingestTrade(exchange: Exchange, symbol: string, price: number, qty: number, timestamp: number) {
        // Convert to unix seconds
        const tsSeconds = Math.floor(timestamp / 1000);

        for (const interval of this.SUPPORTED_INTERVALS) {
            const key = `${symbol.toUpperCase()}:${interval}`;
            let acc = this.accumulators.get(key);

            const windowStart = Math.floor(tsSeconds / interval) * interval;

            // Detect new candle window
            if (!acc || acc.openTime !== windowStart) {
                if (acc) {
                    // Finalize and persist previous candle
                    const finalized = this.finalize(acc, symbol, interval);
                    this.emit('candle:closed', { symbol, interval, candle: finalized });
                    this.persist(symbol, interval, finalized);
                }

                acc = {
                    openTime: windowStart,
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    volume: 0,
                    quoteVolume: 0,
                    tradeCount: 0,
                    sumPriceXVol: 0,
                    sumVol: 0,
                    exchangeVolume: {}
                };
                this.accumulators.set(key, acc);
            }

            // Update OHLCV
            acc.high = Math.max(acc.high, price);
            acc.low = Math.min(acc.low, price);
            acc.close = price;
            acc.volume += qty;
            acc.quoteVolume += price * qty;
            acc.tradeCount += 1;

            // Update VWAP components
            acc.sumPriceXVol += price * qty;
            acc.sumVol += qty;

            // Track per-exchange contribution
            acc.exchangeVolume[exchange] = (acc.exchangeVolume[exchange] || 0) + qty;

            // Mark as dirty for the throttled broadcast
            this.dirtyAccumulators.add(key);
        }
    }

    private processBroadcastQueue() {
        if (this.dirtyAccumulators.size === 0) return;

        for (const key of this.dirtyAccumulators) {
            const acc = this.accumulators.get(key);
            if (!acc) continue;

            // Extract symbol and interval from key (SYMBOL:INTERVAL)
            const [symbol, intervalString] = key.split(':');
            const interval = parseInt(intervalString);

            // Broadcast live "dirty" candle update to frontend
            const live = this.buildLive(acc, symbol, interval);
            clientHub.broadcast(`candles.aggregated.${symbol.toUpperCase()}.${this.intervalToName(interval)}` as any, live);
        }

        this.dirtyAccumulators.clear();
    }

    private buildLive(acc: CandleAccumulator, symbol: string, interval: number) {
        const vwap = acc.sumVol > 0 ? acc.sumPriceXVol / acc.sumVol : acc.close || 0;

        const exchangeSplit: Record<string, number> = {};
        for (const [ex, vol] of Object.entries(acc.exchangeVolume)) {
            exchangeSplit[ex] = acc.sumVol > 0 ? vol / acc.sumVol : 0;
        }

        return {
            time: acc.openTime,
            open: acc.open,
            high: acc.high,
            low: acc.low,
            close: acc.close,
            volume: acc.volume,
            vwap: vwap,
            tradeCount: acc.tradeCount,
            exchangeSplit,
            exchange: 'aggregated' as Exchange,
            interval: this.intervalToName(interval),
            symbol: symbol.toUpperCase()
        };
    }

    private finalize(acc: CandleAccumulator, symbol: string, interval: number) {
        return { ...this.buildLive(acc, symbol, interval), closed: true };
    }

    private intervalToName(interval: number): string {
        switch (interval) {
            case 60: return '1m';
            case 300: return '5m';
            case 900: return '15m';
            case 3600: return '1h';
            case 14400: return '4h';
            case 86400: return '1d';
            case 604800: return '1w';
            case 2592000: return '1M';
            default: return `${interval}s`;
        }
    }

    private async persist(symbol: string, interval: number, candle: any) {
        try {
            await query(
                `INSERT INTO aggregated_candles (
                    time, symbol, interval_sec, open, high, low, close, volume, quote_volume, vwap, trade_count
                ) VALUES (to_timestamp($1), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (time, symbol, interval_sec) DO UPDATE SET
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume,
                    quote_volume = EXCLUDED.quote_volume,
                    vwap = EXCLUDED.vwap,
                    trade_count = EXCLUDED.trade_count`,
                [
                    candle.time,
                    symbol.toUpperCase(),
                    interval,
                    candle.open,
                    candle.high,
                    candle.low,
                    candle.close,
                    candle.volume,
                    candle.volume * candle.vwap,
                    candle.vwap,
                    candle.tradeCount
                ]
            );
        } catch (err) {
            logger.error({ err, symbol, interval }, 'Failed to persist aggregated candle');
        }
    }
}

export const aggregatedCandleEngine = new AggregatedCandleEngine();
