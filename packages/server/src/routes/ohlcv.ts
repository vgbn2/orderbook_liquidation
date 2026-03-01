import type { FastifyInstance } from 'fastify';
import { binanceAdapter } from '../adapters/binance.js';
import { query } from '../db/timescale.js';
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
            // Try DB first
            const dbResult = await query(
                `SELECT
          EXTRACT(EPOCH FROM time)::bigint AS time,
          open, high, low, close, volume
         FROM ohlcv_candles
         WHERE symbol = $1 AND timeframe = $2
         ORDER BY time DESC
         LIMIT $3`,
                [symbol, interval, numLimit],
            );

            if (dbResult.rows.length >= numLimit * 0.95) {
                // Reverse to chronological order
                return reply.send(dbResult.rows.reverse());
            }

            // Fallback to Binance REST
            logger.info({ symbol, interval, limit: numLimit }, 'DB empty, fetching from Binance REST');
            const candles = await binanceAdapter.fetchKlines(symbol, interval, numLimit);

            return reply.send(candles);
        } catch (err) {
            logger.error({ err }, 'OHLCV route error');
            return reply.code(500).send({ error: 'Failed to fetch candle data' });
        }
    });
}
