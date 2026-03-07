import { FastifyPluginAsync } from 'fastify';
import { query } from '../db/timescale.js';
import { getAuth } from '@clerk/fastify';

export const userRoutes: FastifyPluginAsync = async (app) => {
    // Middleware to ensure user is authenticated
    app.addHook('preHandler', async (request, reply) => {
        // const { userId } = getAuth(request);
        // if (!userId) {
        //     return reply.code(401).send({ error: 'Unauthorized' });
        // }
    });

    // ── User Preferences ──
    app.get('/preferences', async (request, reply) => {
        const userId = 'dev_user_123';
        const res = await query('SELECT key, value FROM user_preferences WHERE user_id = $1', [userId]);
        return res.rows;
    });

    app.post('/preferences', async (request: any, reply) => {
        const userId = 'dev_user_123';
        const { key, value } = request.body;
        await query(
            `INSERT INTO user_preferences (user_id, key, value) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [userId, key, JSON.stringify(value)]
        );
        return { success: true };
    });

    // ── Watchlist ──
    app.get('/watchlist', async (request, reply) => {
        const userId = 'dev_user_123';
        const res = await query('SELECT symbol, position FROM watchlist_items WHERE user_id = $1 ORDER BY position ASC', [userId]);
        return res.rows;
    });

    app.post('/watchlist', async (request: any, reply) => {
        const userId = 'dev_user_123';
        const { symbol, position } = request.body;
        await query(
            `INSERT INTO watchlist_items (user_id, symbol, position) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, symbol) DO UPDATE SET position = EXCLUDED.position`,
            [userId, symbol, position || 0]
        );
        return { success: true };
    });

    app.delete('/watchlist/:symbol', async (request: any, reply) => {
        const userId = 'dev_user_123';
        const { symbol } = request.params;
        await query('DELETE FROM watchlist_items WHERE user_id = $1 AND symbol = $2', [userId, symbol]);
        return { success: true };
    });

    // ── Placeholders for Other Phase 1 Tables ──
    app.get('/alerts', async (request, reply) => {
        const userId = 'dev_user_123';
        const res = await query('SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return res.rows;
    });

    app.get('/journal', async (request, reply) => {
        const userId = 'dev_user_123';
        const res = await query('SELECT * FROM journal_entries WHERE user_id = $1 ORDER BY entry_at DESC LIMIT 100', [userId]);
        return res.rows;
    });

    app.get('/strategies', async (request, reply) => {
        const userId = 'dev_user_123';
        const res = await query('SELECT * FROM strategies WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
        return res.rows;
    });

    app.get('/backtest_runs', async (request, reply) => {
        const userId = 'dev_user_123';
        const res = await query('SELECT * FROM backtest_runs WHERE user_id = $1 ORDER BY ran_at DESC', [userId]);
        return res.rows;
    });

    app.get('/drawings', async (request, reply) => {
        const userId = 'dev_user_123';
        const res = await query('SELECT * FROM chart_drawings WHERE user_id = $1', [userId]);
        return res.rows;
    });
};
