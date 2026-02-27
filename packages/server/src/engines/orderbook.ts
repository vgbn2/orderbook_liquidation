import { logger } from '../logger.js';
import { redis } from '../db/redis.js';
import { query } from '../db/timescale.js';
import { clientHub } from '../ws/client-hub.js';
import type { OrderbookLevel, OrderbookSnapshot, OrderbookWall, AggregatedOrderbook, Exchange } from '../adapters/types.js';

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

export class OrderbookEngine {
    private books = new Map<Exchange, OrderbookState>();
    private broadcastTimer: ReturnType<typeof setInterval> | null = null;
    private persistTimer: ReturnType<typeof setInterval> | null = null;
    private dirty = false;

    /**
     * Initialize an orderbook from a REST snapshot.
     */
    initSnapshot(exchange: Exchange, snapshot: {
        lastUpdateId: number;
        bids: [string, string][];
        asks: [string, string][];
    }): void {
        const bids = new Map<number, number>();
        const asks = new Map<number, number>();

        for (const [p, q] of snapshot.bids) {
            const price = parseFloat(p);
            const qty = parseFloat(q);
            if (qty > 0) bids.set(price, qty);
        }

        for (const [p, q] of snapshot.asks) {
            const price = parseFloat(p);
            const qty = parseFloat(q);
            if (qty > 0) asks.set(price, qty);
        }

        const sortedBids = [...bids.keys()].sort((a, b) => b - a);
        const sortedAsks = [...asks.keys()].sort((a, b) => a - b);

        this.books.set(exchange, {
            bids,
            asks,
            lastUpdateId: snapshot.lastUpdateId,
            bestBid: sortedBids[0] ?? 0,
            bestAsk: sortedAsks[0] ?? 0,
        });

        this.dirty = true;
        this._startBroadcastLoop();

        logger.info({ exchange, bids: bids.size, asks: asks.size }, 'Orderbook snapshot loaded');
    }

    /**
     * Apply delta update from WebSocket.
     */
    applyDelta(exchange: Exchange, delta: {
        u: number;  // final update ID
        b: [string, string][];  // bid deltas
        a: [string, string][];  // ask deltas
    }): void {
        const book = this.books.get(exchange);
        if (!book) return;

        // Apply bid deltas
        for (const [p, q] of delta.b) {
            const price = parseFloat(p);
            const qty = parseFloat(q);
            if (qty === 0) {
                book.bids.delete(price);
            } else {
                book.bids.set(price, qty);
            }
        }

        // Apply ask deltas
        for (const [p, q] of delta.a) {
            const price = parseFloat(p);
            const qty = parseFloat(q);
            if (qty === 0) {
                book.asks.delete(price);
            } else {
                book.asks.set(price, qty);
            }
        }

        book.lastUpdateId = delta.u;

        // Update best bid/ask
        const sortedBids = [...book.bids.keys()].sort((a, b) => b - a);
        const sortedAsks = [...book.asks.keys()].sort((a, b) => a - b);
        book.bestBid = sortedBids[0] ?? 0;
        book.bestAsk = sortedAsks[0] ?? 0;

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
            symbol: 'BTCUSDT',
            bids,
            asks,
        };
    }

    /**
     * Detect limit walls — price levels with disproportionate qty.
     */
    detectWalls(snapshot: OrderbookSnapshot): { bid_walls: OrderbookWall[]; ask_walls: OrderbookWall[] } {
        const totalBidQty = snapshot.bids.reduce((s, l) => s + l.qty, 0);
        const totalAskQty = snapshot.asks.reduce((s, l) => s + l.qty, 0);

        const bid_walls: OrderbookWall[] = snapshot.bids
            .filter((l) => (l.qty / totalBidQty) * 100 >= WALL_THRESHOLD_PCT)
            .map((l) => ({
                price: l.price,
                qty: l.qty,
                pct: (l.qty / totalBidQty) * 100,
                side: 'bid' as const,
            }));

        const ask_walls: OrderbookWall[] = snapshot.asks
            .filter((l) => (l.qty / totalAskQty) * 100 >= WALL_THRESHOLD_PCT)
            .map((l) => ({
                price: l.price,
                qty: l.qty,
                pct: (l.qty / totalAskQty) * 100,
                side: 'ask' as const,
            }));

        return { bid_walls, ask_walls };
    }

    /**
     * Get aggregated orderbook with walls for a single exchange.
     */
    getAggregated(exchange: Exchange): AggregatedOrderbook | null {
        const snapshot = this.getSnapshot(exchange);
        if (!snapshot) return null;

        const walls = this.detectWalls(snapshot);

        return { ...snapshot, walls };
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
            const aggregated = this.getAggregated('binance');
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
        const aggregated = this.getAggregated('binance');
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
