import { logger } from '../../logger.js';
import { redis } from '../../db/redis.js';
import { query } from '../../db/timescale.js';
import { clientHub } from '../../ws/client-hub.js';
import type { OrderbookLevel, OrderbookSnapshot, OrderbookWall, AggregatedOrderbook, Exchange } from '../../adapters/types.js';
import bindings from 'bindings';

const core = bindings('terminus_core');

const EXCHANGE_MAP: Record<string, number> = {
    'binance': 0,
    'bybit': 1,
    'okx': 2,
    'gateio': 3,
    'mexc': 4,
    'bitget': 6
};

// ══════════════════════════════════════════════════════════════
//  Orderbook Engine — Delta State Machine + Wall Detection
// ══════════════════════════════════════════════════════════════

const DEPTH_LEVELS = 25;
const WALL_THRESHOLD_PCT = 3.0;   // wall if >3% of total depth
const BROADCAST_INTERVAL = 250;   // ms — throttle broadcasts

interface OrderbookState {
    bids: Map<number, number>;  // price → qty
    asks: Map<number, number>;
    lastUpdateId: number;
    bestBid: number;
    bestAsk: number;
}

export interface OrderbookDelta {
    u: number;
    b: [string, string][];
    a: [string, string][];
    isSnapshot?: boolean;
}

export class OrderbookEngine {
    private books = new Map<Exchange, OrderbookState>();
    private broadcastTimer: ReturnType<typeof setInterval> | null = null;
    private persistTimer: ReturnType<typeof setInterval> | null = null;
    private dirty = false;
    private currentSymbol = 'BTCUSDT';

    setSymbol(symbol: string): void {
        this.currentSymbol = symbol;
    }

    /**
     * Clear all book state (called on symbol switch).
     */
    clearAll(): void {
        this.books.clear();
        this.wallAgeMap.clear();
        this.dirty = false;

        // Clear native too
        for (const id of Object.values(EXCHANGE_MAP)) {
            core.clearExchange(id);
        }
    }

    /**
     * Initialize an orderbook from a REST snapshot.
     */
    initSnapshot(exchange: Exchange, snapshot: {
        lastUpdateId: number;
        bids: [string, string][];
        asks: [string, string][];
    }): void {
        const bookBids: [number, number][] = [];
        const bookAsks: [number, number][] = [];

        for (const [p, q] of snapshot.bids) {
            const price = parseFloat(p);
            const qty = parseFloat(q);
            if (qty > 0) bookBids.push([price, qty]);
        }

        for (const [p, q] of snapshot.asks) {
            const price = parseFloat(p);
            const qty = parseFloat(q);
            if (qty > 0) bookAsks.push([price, qty]);
        }

        const exchangeId = EXCHANGE_MAP[exchange] ?? 255;
        if (exchangeId !== 255) {
            core.initSnapshot(exchangeId, bookBids, bookAsks);
        }

        // Keep local state for best bid/ask (used by some legacy triggers)
        this.books.set(exchange, {
            bids: new Map(bookBids),
            asks: new Map(bookAsks),
            lastUpdateId: snapshot.lastUpdateId,
            bestBid: bookBids[0]?.[0] ?? 0,
            bestAsk: bookAsks[0]?.[0] ?? 0,
        });

        this.dirty = true;
        this._startBroadcastLoop();
    }

    /**
     * Apply delta update from WebSocket.
     */
    applyDelta(exchange: Exchange, delta: OrderbookDelta): void {
        const book = this.books.get(exchange);
        if (!book) return;

        const bidDeltas: [number, number][] = [];
        const askDeltas: [number, number][] = [];

        // Apply bid deltas
        for (const [priceStr, qtyStr] of delta.b) {
            const price = parseFloat(priceStr);
            const qty = parseFloat(qtyStr);
            bidDeltas.push([price, qty]);
            if (qty === 0) book.bids.delete(price);
            else book.bids.set(price, qty);
        }

        // Apply ask deltas
        for (const [p, q] of delta.a) {
            const price = parseFloat(p);
            const qty = parseFloat(q);
            askDeltas.push([price, qty]);
            if (qty === 0) book.asks.delete(price);
            else book.asks.set(price, qty);
        }

        const exchangeId = EXCHANGE_MAP[exchange] ?? 255;
        if (exchangeId !== 255) {
            core.applyDelta(exchangeId, bidDeltas, askDeltas, !!delta.isSnapshot);
        }

        book.lastUpdateId = delta.u;
        this.dirty = true;
    }

    /**
     * Get the top N levels as a sorted snapshot.
     */
    getSnapshot(exchange: Exchange): OrderbookSnapshot | null {
        const book = this.books.get(exchange);
        if (!book) return null;

        const bids: OrderbookLevel[] = [...book.bids.entries()]
            .sort((a, b) => b[0] - a[0])
            .slice(0, DEPTH_LEVELS)
            .map(([price, qty]) => ({ price, qty }));

        const asks: OrderbookLevel[] = [...book.asks.entries()]
            .sort((a, b) => a[0] - b[0])
            .slice(0, DEPTH_LEVELS)
            .map(([price, qty]) => ({ price, qty }));

        return {
            time: Date.now(),
            exchange,
            symbol: this.currentSymbol,
            bids,
            asks,
        };
    }


    private wallAgeMap = new Map<number, number>(); // price -> ticks alive

    /**
     * Detect limit walls — price levels with disproportionate qty.
     */
    detectWalls(snapshot: OrderbookSnapshot): { bid_walls: OrderbookWall[]; ask_walls: OrderbookWall[] } {
        const allLevels = [...snapshot.bids, ...snapshot.asks];
        if (allLevels.length === 0) return { bid_walls: [], ask_walls: [] };

        // Median qty
        const sortedQtys = allLevels.map((l: any) => l.qty).sort((a, b) => a - b);
        const mid = Math.floor(sortedQtys.length / 2);
        const medianQty = sortedQtys.length % 2 !== 0 ? sortedQtys[mid] : (sortedQtys[mid - 1] + sortedQtys[mid]) / 2;
        const threshold = medianQty * 4;

        const totalBidQty = snapshot.bids.reduce((s, l) => s + l.qty, 0);
        const totalAskQty = snapshot.asks.reduce((s, l) => s + l.qty, 0);

        const rawBids = snapshot.bids.filter((l: any) => l.qty > threshold);
        const rawAsks = snapshot.asks.filter((l: any) => l.qty > threshold);

        // Update age map
        const currentWallPrices = new Set([...rawBids, ...rawAsks].map(w => w.price));
        for (const [price, age] of this.wallAgeMap.entries()) {
            if (!currentWallPrices.has(price)) {
                this.wallAgeMap.delete(price); // Wall pulled
            } else {
                this.wallAgeMap.set(price, age + 1); // persists
            }
        }
        for (const price of currentWallPrices) {
            if (!this.wallAgeMap.has(price)) {
                this.wallAgeMap.set(price, 1);
            }
        }

        const processWalls = (walls: OrderbookLevel[], side: 'bid' | 'ask', totalQty: number): OrderbookWall[] => {
            return walls.map(w => {
                let score = 0;

                // Base score: size multiple over median (cap at 5)
                const multiple = w.qty / (medianQty || 1);
                score += Math.min(multiple / 2, 5);

                // Persistence score (cap at 4)
                const age = this.wallAgeMap.get(w.price) || 1;
                score += Math.min(age / 10, 4);

                // Round number proximity (2 points)
                const nearest100 = Math.round(w.price / 100) * 100;
                if (nearest100 > 0) {
                    const distancePct = Math.abs(w.price - nearest100) / w.price;
                    if (distancePct <= 0.001) score += 2;
                }

                let classification: 'MINOR' | 'SIGNIFICANT' | 'INSTITUTIONAL' = 'MINOR';
                if (score > 8) classification = 'INSTITUTIONAL';
                else if (score > 4) classification = 'SIGNIFICANT';

                return {
                    price: w.price,
                    qty: w.qty,
                    pct: (w.qty / (totalQty || 1)) * 100,
                    score,
                    classification,
                    side
                };
            }).filter(w => w.score > 3).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10);
        };

        return {
            bid_walls: processWalls(rawBids, 'bid', totalBidQty),
            ask_walls: processWalls(rawAsks, 'ask', totalAskQty)
        };
    }

    /**
     * Get aggregated orderbook with walls using ultra-fast native engine.
     */
    getAggregated(): AggregatedOrderbook | null {
        try {
            const nativeSnap = core.getAggregated();
            if (!nativeSnap) return null;

            // Map native snapshot to TS type
            return {
                time: nativeSnap.timestamp,
                exchange: 'binance', // default output representation
                symbol: this.currentSymbol,
                best_bid: nativeSnap.best_bid,
                best_ask: nativeSnap.best_ask,
                spread: nativeSnap.spread,
                mid_price: nativeSnap.mid_price,
                bids: nativeSnap.bids,
                asks: nativeSnap.asks,
                walls: nativeSnap.walls
            };
        } catch (err) {
            logger.error({ err }, 'Native getAggregated failed, falling back to JS');
            return null; // For now no fallback, native is primary
        }
    }

    /**
     * Throttled broadcast loop — sends orderbook to all connected clients.
     */
    private _startBroadcastLoop(): void {
        if (this.broadcastTimer) return;

        // Start persistence timer (every 10s)
        if (!this.persistTimer) {
            this.persistTimer = setInterval(() => this.persistSnapshot(), 10_000);
        }

        this.broadcastTimer = setInterval(() => {
            if (!this.dirty) return;
            this.dirty = false;

            // Build aggregated snapshot from primary exchange
            const aggregated = this.getAggregated();
            if (!aggregated) return;

            // Cache in Redis
            redis.set(
                'orderbook.aggregated',
                JSON.stringify(aggregated),
                'EX', 5,
            ).catch(() => { });

            // Broadcast to subscribed clients
            clientHub.broadcast('orderbook.aggregated' as any, aggregated);
        }, BROADCAST_INTERVAL);
    }

    private async persistSnapshot(): Promise<void> {
        const aggregated = this.getAggregated();
        if (!aggregated) return;

        try {
            await query(`
                INSERT INTO orderbook_snapshots (time, exchange, symbol, bids, asks, walls)
                VALUES (NOW(), $1, $2, $3, $4, $5)
            `, [
                aggregated.exchange,
                aggregated.symbol,
                JSON.stringify(aggregated.bids),
                JSON.stringify(aggregated.asks),
                JSON.stringify(aggregated.walls)
            ]);
        } catch (err) {
            logger.error({ err }, 'Failed to persist orderbook snapshot');
        }
    }

    /**
     * Stop broadcast loop.
     */
    stop(): void {
        if (this.broadcastTimer) {
            clearInterval(this.broadcastTimer);
            this.broadcastTimer = null;
        }
        if (this.persistTimer) {
            clearInterval(this.persistTimer);
            this.persistTimer = null;
        }
    }
}

export const orderbookEngine = new OrderbookEngine();
