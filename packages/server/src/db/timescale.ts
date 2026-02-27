import pg from 'pg';
import { config, DB_URL } from '../config.js';
import { logger } from '../logger.js';

const { Pool } = pg;

export const pool = new Pool({
    connectionString: DB_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected TimescaleDB pool error');
});

/** Run a single query with automatic connection handling */
export async function query<T extends pg.QueryResultRow = any>(
    text: string,
    params?: any[],
): Promise<pg.QueryResult<T>> {
    const start = performance.now();
    const result = await pool.query<T>(text, params);
    const duration = Math.round(performance.now() - start);

    if (duration > 200) {
        logger.warn({ text: text.slice(0, 80), duration, rows: result.rowCount }, 'Slow query');
    }

    return result;
}

/** Health check — returns true if DB is reachable */
export async function dbHealthCheck(): Promise<boolean> {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}

/** Graceful shutdown */
export async function closeDb(): Promise<void> {
    logger.info('Closing TimescaleDB pool...');
    await pool.end();
}
