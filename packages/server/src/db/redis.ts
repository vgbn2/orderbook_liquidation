import Redis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../logger.js';

export const redis = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        const delay = Math.min(times * 200, 5_000);
        logger.warn({ attempt: times, delay }, 'Redis reconnecting...');
        return delay;
    },
    lazyConnect: true,
});

// Separate connection for pub/sub (Redis requires dedicated connection)
export const redisSub = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        return Math.min(times * 200, 5_000);
    },
    lazyConnect: true,
});

redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('connect', () => logger.info('Redis connected'));

redisSub.on('error', (err) => logger.error({ err }, 'Redis sub error'));

/** Health check */
export async function redisHealthCheck(): Promise<boolean> {
    try {
        const pong = await redis.ping();
        return pong === 'PONG';
    } catch {
        return false;
    }
}

/** Store with TTL (seconds) */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

/** Get and parse from cache */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
}

/** Graceful shutdown */
export async function closeRedis(): Promise<void> {
    logger.info('Closing Redis connections...');
    await redis.quit();
    await redisSub.quit();
}
