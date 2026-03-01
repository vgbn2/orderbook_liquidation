import { logger } from '../logger.js';
import { query } from './timescale.js';
import { dbQueue } from './BackpressureQueue.js';

interface Trade {
    time: number;
    exchange: string;
    symbol: string;
    price: number;
    qty: number;
    side: 'buy' | 'sell';
}

export class TradeBatcher {
    private queue: Trade[] = [];
    private readonly BATCH_SIZE = 500;
    private readonly FLUSH_INTERVAL_MS = 1000;
    private isFlushScheduled = false;
    private intervalRef: NodeJS.Timeout | null = null;

    add(trade: Trade) {
        this.queue.push(trade);

        if (this.queue.length >= this.BATCH_SIZE) {
            this.flush(); // Flush immediately if buffer is full
        } else if (!this.isFlushScheduled) {
            this.intervalRef = setTimeout(() => this.flush(), this.FLUSH_INTERVAL_MS);
            this.isFlushScheduled = true;
        }
    }

    private buildPlaceholders(rowCount: number, colsPerRow: number): string {
        const rows = [];
        let index = 1;
        for (let i = 0; i < rowCount; i++) {
            const cols = [];
            for (let j = 0; j < colsPerRow; j++) {
                cols.push(`$${index++}`);
            }
            rows.push(`(${cols.join(', ')})`);
        }
        return rows.join(', ');
    }

    async flush() {
        if (this.intervalRef) {
            clearTimeout(this.intervalRef);
            this.intervalRef = null;
        }
        this.isFlushScheduled = false;

        if (this.queue.length === 0) return;

        // Drain up to BATCH_SIZE
        const batch = this.queue.splice(0, this.BATCH_SIZE);

        const values: any[] = [];
        for (const t of batch) {
            // Convert ms timestamp to JS Date for PostgreSQL timestamptz
            values.push(new Date(t.time), t.exchange, t.symbol, t.price, t.qty, t.side);
        }

        try {
            const placeholders = this.buildPlaceholders(batch.length, 6);

            dbQueue.push(async () => {
                await query(`
                    INSERT INTO big_trades (time, exchange, symbol, price, qty, side)
                    VALUES ${placeholders}
                `, values);
                logger.debug({ batchSize: batch.length }, 'Flushed trade batch to TimescaleDB');
            });

        } catch (error) {
            logger.error({ err: error, batchSize: batch.length }, 'Batch insert failed, re-queuing trades');
            // Put them back at the front so we don't lose data
            this.queue.unshift(...batch);
        }
    }
}

export const tradeBatcher = new TradeBatcher();
