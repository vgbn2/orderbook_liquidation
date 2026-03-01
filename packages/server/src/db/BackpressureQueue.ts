import { logger } from '../logger.js';

type AsyncTask = () => Promise<void>;

export class BackpressureQueue {
    private queue: AsyncTask[] = [];
    private readonly MAX_QUEUE_SIZE = 10000;
    private readonly MAX_CONCURRENT = 5;
    private isProcessing = false;
    private inFlight = 0;

    constructor(private name: string = 'DBQueue') { }

    push(task: AsyncTask) {
        if (this.queue.length >= this.MAX_QUEUE_SIZE) {
            logger.error({
                queue: this.name,
                dropped: 1,
                size: this.queue.length
            }, 'Backpressure limit exceeded — DROPPING TASK to prevent OOM');
            return;
        }

        this.queue.push(task);
        if (!this.isProcessing) {
            this.drain();
        }
    }

    private async drain() {
        this.isProcessing = true;

        while (this.queue.length > 0) {
            if (this.inFlight >= this.MAX_CONCURRENT) {
                // Yield to event loop, wait a tiny bit before trying again
                await new Promise(resolve => setTimeout(resolve, 5));
                continue;
            }

            const task = this.queue.shift();
            if (!task) continue;

            this.inFlight++;

            // Execute without awaiting so we can launch up to MAX_CONCURRENT
            task()
                .catch(err => {
                    logger.error({ queue: this.name, err }, 'Task failed in backpressure queue');
                })
                .finally(() => {
                    this.inFlight--;
                });
        }

        this.isProcessing = false;
    }
}

export const dbQueue = new BackpressureQueue('TimescaleDB');
export const redisQueue = new BackpressureQueue('Redis');
