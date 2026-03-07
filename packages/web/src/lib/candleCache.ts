export interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface CacheResult {
    candles: CandleData[];
    stale: boolean;
    lastTime: number;
    fromCache: 'memory' | 'indexeddb' | 'none';
}

const DB_NAME = 'terminus_candles';
const DB_VERSION = 1;
const STORE_NAME = 'candles';
const MAX_PERSIST = 2000;

const memoryCache = new Map<string, { candles: CandleData[]; savedAt: number }>();

function getTTL(timeframe: string): number {
    const TTL_MAP: Record<string, number> = {
        '1m': 5 * 60 * 1000,
        '5m': 15 * 60 * 1000,
        '15m': 30 * 60 * 1000,
        '1h': 2 * 60 * 60 * 1000,
        '4h': 6 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '1w': 48 * 60 * 60 * 1000,
        '1M': 72 * 60 * 60 * 1000,
        DEFAULT: 60 * 60 * 1000,
    };
    return TTL_MAP[timeframe] || TTL_MAP.DEFAULT;
}

function cacheKey(symbol: string, timeframe: string): string {
    return `${symbol.toUpperCase()}:${timeframe}`;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            dbPromise = null;
            reject(request.error);
        };
    });

    return dbPromise;
}

async function idbGet(key: string): Promise<any> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        return null;
    }
}

async function idbSet(row: any): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(row);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        // Non-fatal
    }
}

export async function getCachedCandles(symbol: string, timeframe: string): Promise<CacheResult> {
    const key = cacheKey(symbol, timeframe);
    const maxAge = getTTL(timeframe);
    const now = Date.now();

    const mem = memoryCache.get(key);
    if (mem && mem.candles.length > 0) {
        const stale = now - mem.savedAt > maxAge;
        return {
            candles: mem.candles,
            stale,
            lastTime: mem.candles[mem.candles.length - 1].time,
            fromCache: 'memory',
        };
    }

    const row = await idbGet(key);
    if (row && row.candles.length > 0) {
        const stale = now - row.savedAt > maxAge;
        memoryCache.set(key, { candles: row.candles, savedAt: row.savedAt });
        return {
            candles: row.candles,
            stale,
            lastTime: row.candles[row.candles.length - 1].time,
            fromCache: 'indexeddb',
        };
    }

    return { candles: [], stale: true, lastTime: 0, fromCache: 'none' };
}

export async function saveCandles(symbol: string, timeframe: string, candles: CandleData[]): Promise<void> {
    if (candles.length === 0) return;

    const key = cacheKey(symbol, timeframe);
    const savedAt = Date.now();

    memoryCache.set(key, { candles, savedAt });

    const toSave = candles.slice(-MAX_PERSIST);
    await idbSet({ key, candles: toSave, savedAt });
}

export async function mergeGapCandles(
    symbol: string,
    timeframe: string,
    freshCandles: CandleData[],
    existingCandles: CandleData[]
): Promise<CandleData[]> {
    if (freshCandles.length === 0) return existingCandles;

    const key = cacheKey(symbol, timeframe);
    const map = new Map<number, CandleData>(existingCandles.map((c) => [c.time, c]));
    for (const candle of freshCandles) {
        map.set(candle.time, candle);
    }

    const merged = Array.from(map.values())
        .sort((a, b) => a.time - b.time)
        .slice(-MAX_PERSIST);

    if (freshCandles.length > 3) {
        await saveCandles(symbol, timeframe, merged);
    } else {
        memoryCache.set(key, { candles: merged, savedAt: Date.now() });
    }
    return merged;
}
