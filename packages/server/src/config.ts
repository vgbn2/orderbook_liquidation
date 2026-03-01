import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    // Database
    TIMESCALE_HOST: z.string().default('localhost'),
    TIMESCALE_PORT: z.coerce.number().default(5432),
    TIMESCALE_USER: z.string().default('terminus'),
    TIMESCALE_PASSWORD: z.string().default('terminus_dev'),
    TIMESCALE_DB: z.string().default('terminus'),

    // Redis
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),

    // Server
    PORT: z.coerce.number().default(8080),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    // Exchange API keys
    DERIBIT_CLIENT_ID: z.string().optional(),
    DERIBIT_CLIENT_SECRET: z.string().optional(),
    COINGLASS_API_KEY: z.string().optional(),

    // Feature flags
    ENABLE_BINANCE: z.coerce.boolean().default(true),
    ENABLE_BYBIT: z.coerce.boolean().default(true),
    ENABLE_OKX: z.coerce.boolean().default(true),
    ENABLE_DERIBIT: z.coerce.boolean().default(true),
    ENABLE_HYPERLIQUID: z.coerce.boolean().default(true),
    ENABLE_MEXC: z.coerce.boolean().default(true),
    ENABLE_BITGET: z.coerce.boolean().default(true),
    ENABLE_GATEIO: z.coerce.boolean().default(true),
});

export const config = envSchema.parse(process.env);

export const DB_URL = `postgres://${config.TIMESCALE_USER}:${config.TIMESCALE_PASSWORD}@${config.TIMESCALE_HOST}:${config.TIMESCALE_PORT}/${config.TIMESCALE_DB}`;

export type Config = z.infer<typeof envSchema>;
