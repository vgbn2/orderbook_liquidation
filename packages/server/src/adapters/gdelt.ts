import axios from 'axios';
import { logger } from '../logger.js';
import { redis } from '../db/redis.js';

// ── Geopolitical Risk Themes ─────────────────────────────────

export interface GeopoliticalNews {
    title: string;
    url: string;
    source: string;
    date: string;
    tone: number;
    relevance: number;
}

const GDELT_CACHE_KEY = 'signal:gdelt:news';
const GDELT_THROTTLE_KEY = 'signal:gdelt:throttled';
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const REDIS_TTL = 30 * 60;          // 30 minutes

class GdeltAdapter {
    private cache: GeopoliticalNews[] = [];
    private throttledUntil = 0;

    async fetchGlobalRiskNews(): Promise<GeopoliticalNews[]> {
        const now = Date.now();

        // ── Gate 1: In-memory throttle ────────────────────────
        if (now < this.throttledUntil) {
            logger.debug('GDELT fetch skipped — in-memory throttle active');
            return this.cache;
        }

        // ── Gate 2: Redis throttle (survives restarts) ────────
        try {
            const throttleFlag = await redis.get(GDELT_THROTTLE_KEY);
            if (throttleFlag) {
                this.throttledUntil = now + 60_000; // Re-arm in-memory for 1 min to avoid Redis spam
                logger.debug('GDELT fetch skipped — Redis throttle active');
                return this.cache;
            }
        } catch { /* Redis down — continue to cache check */ }

        // ── Gate 3: Redis cache (warm data across restarts) ───
        try {
            const cached = await redis.get(GDELT_CACHE_KEY);
            if (cached) {
                this.cache = JSON.parse(cached);
                // Set in-memory cooldown so we don't keep hitting Redis
                this.throttledUntil = now + COOLDOWN_MS;
                return this.cache;
            }
        } catch { /* ignored */ }

        // ── Gate 4: In-memory cache (same-session dedup) ──────
        if (this.cache.length > 0) {
            // We have data but Redis lost it. Re-persist and throttle.
            this.throttledUntil = now + COOLDOWN_MS;
            redis.set(GDELT_CACHE_KEY, JSON.stringify(this.cache), 'EX', REDIS_TTL).catch(() => { });
            return this.cache;
        }

        // ── Actual fetch (only if ALL gates passed) ───────────
        try {
            const query = `(war OR conflict OR sanctions OR "geopolitical risk") (country:US OR country:CH OR country:RU OR country:EU OR country:ME)`;
            const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxresults=50`;

            const res = await axios.get(url, { timeout: 15_000 });

            if (res.data && res.data.articles) {
                const news: GeopoliticalNews[] = res.data.articles.map((art: any) => ({
                    title: art.title,
                    url: art.url,
                    source: art.source,
                    date: art.seendate,
                    tone: 0,
                    relevance: 1.0
                }));

                this.cache = news;
                this.throttledUntil = now + COOLDOWN_MS;

                // Persist to Redis
                await redis.set(GDELT_CACHE_KEY, JSON.stringify(news), 'EX', REDIS_TTL);

                logger.info({ count: news.length }, 'GDELT news fetched and cached');
                return news;
            }
        } catch (err: any) {
            if (err?.response?.status === 429) {
                logger.warn('GDELT 429 Rate Limit — cooldown 10m');
                this.throttledUntil = now + COOLDOWN_MS;
                // Persist throttle flag to Redis so restarts don't bypass it
                redis.set(GDELT_THROTTLE_KEY, '1', 'EX', 10 * 60).catch(() => { });
            } else {
                logger.warn({ err: err.message }, 'GDELT fetch failed');
                // Throttle even on generic errors to prevent hammering
                this.throttledUntil = now + 5 * 60 * 1000;
            }
        }

        return this.cache;
    }
}

export const gdeltAdapter = new GdeltAdapter();
