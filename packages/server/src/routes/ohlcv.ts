import type { FastifyInstance } from 'fastify';
import { binanceAdapter } from '../adapters/binance.js';
import { query } from '../db/timescale.js';
import { redis } from '../db/redis.js';
import { logger } from '../logger.js';

export async function ohlcvRoutes(app: FastifyInstance): Promise<void> {
    /**
     * GET /api/ohlcv?symbol=BTCUSDT&interval=1m&limit=500
     *
     * Serves historical candles:
     *   1. Try TimescaleDB first (local cache)
     *   2. Fallback to Binance REST if DB is empty
     */
    app.get('/api/ohlcv', async (req, reply) => {
        const { symbol = 'BTCUSDT', interval = '1m', limit = '500' } = req.query as Record<string, string>;
        const numLimit = Math.min(parseInt(limit) || 500, 100000);

        try {
            // Layer 1: Redis
            const cached = await redis.get(`candles:${symbol.toUpperCase()}:${interval}`);
            if (cached) {
                const candles = JSON.parse(cached);
                if (candles.length >= numLimit * 0.8) {
                    logger.info({ symbol, interval, count: candles.length }, 'Returning OHLCV from Redis');
                    return reply.send(candles.slice(-numLimit));
                }
            }

            logger.info({ symbol, interval, numLimit }, 'Fetching OHLCV from DB');
            // Layer 2: Try DB
            const dbResult = await query(
                `SELECT 
                  EXTRACT(EPOCH FROM time)::bigint AS time,
                  open, high, low, close, volume
                 FROM ohlcv_candles 
                 WHERE symbol = $1 AND timeframe = $2
                 ORDER BY time DESC
                 LIMIT $3`,
                [symbol.toUpperCase(), interval, numLimit],
            );

            if (dbResult.rows.length >= numLimit * 0.8) {
                logger.info({ count: dbResult.rows.length }, 'Returning OHLCV from DB');
                const reversed = dbResult.rows.reverse();
                redis.set(`candles:${symbol.toUpperCase()}:${interval}`, JSON.stringify(reversed), 'EX', 300).catch(() => { });
                return reply.send(reversed);
            }

            // Layer 3: Fallback to Binance REST
            logger.info({ symbol, interval, limit: numLimit }, 'DB has insufficient data, fetching from Binance REST');
            const candles = await binanceAdapter.fetchKlines(symbol.toUpperCase(), interval, numLimit);

            if (candles.length === 0) {
                logger.warn({ symbol, interval }, 'Binance REST returned zero candles');
            } else {
                redis.set(`candles:${symbol.toUpperCase()}:${interval}`, JSON.stringify(candles), 'EX', 300).catch(() => { });
            }

            return reply.send(candles);
        } catch (err) {
            logger.error({ err, symbol, interval, numLimit }, 'OHLCV route error');
            return reply.code(500).send({
                error: 'Failed to fetch candle data',
                message: (err as Error).message
            });
        }
    });

    /**
     * GET /api/ohlcv/aggregated?symbol=BTCUSDT&interval=1m&limit=500
     */
    app.get('/api/ohlcv/aggregated', async (req, reply) => {
        const { symbol = 'BTCUSDT', interval = '1m', limit = '500' } = req.query as Record<string, string>;
        const numLimit = Math.min(parseInt(limit) || 500, 100000);

        // Map string interval to seconds
        const intervalMap: Record<string, number> = {
            '1m': 60,
            '5m': 300,
            '15m': 900,
            '1h': 3600,
            '4h': 14400,
            '1d': 86400
        };
        const intervalSec = intervalMap[interval] || 60;

        try {
            const dbResult = await query(
                `SELECT 
                  EXTRACT(EPOCH FROM time)::bigint AS time,
                  open, high, low, close, volume, vwap, trade_count
                 FROM aggregated_candles 
                 WHERE symbol = $1 AND interval_sec = $2
                 ORDER BY time DESC
                 LIMIT $3`,
                [symbol.toUpperCase(), intervalSec, numLimit],
            );

            return reply.send(dbResult.rows.reverse());
        } catch (err) {
            logger.error({ err, symbol, interval }, 'Aggregated OHLCV route error');
            return reply.code(500).send({
                error: 'Failed to fetch aggregated candle data',
                message: (err as Error).message
            });
        }
    });
}
