/**
 * Liquidation Cluster Engine
 *
 * Groups incoming liquidation events into price clusters.
 * Each cluster tracks: price, total size, count, side, intensity, age.
 *
 * Rendering reads from the clusters array and applies age-based fading.
 */

export interface LiqEvent {
    price: number;
    size: number;          // USD value
    side: 'long' | 'short';
    timestamp: number;
    exchange?: string;
}

export interface LiqCluster {
    price: number;
    totalSize: number;
    count: number;
    side: 'long' | 'short';
    intensity: number;     // 0.0 to 1.0 normalized
    lastUpdated: number;
    firstSeen: number;
}

const PRICE_TOLERANCE = 0.001;   // 0.1% — events within this % are grouped
const TIME_WINDOW = 4 * 3600000; // 4 hours — max cluster age before new cluster
const MAX_AGE = 8 * 3600000;     // 8 hours — fully faded after this
const MIN_LIQ_SIZE = 100_000;    // $100k min to normalize against
const MAX_LIQ_SIZE = 10_000_000; // $10M max for normalization

export class LiqClusterEngine {
    clusters: LiqCluster[] = [];

    process(event: LiqEvent): void {
        // Find existing cluster within tolerance
        const existing = this.clusters.find(c =>
            c.side === event.side &&
            Math.abs(c.price - event.price) / event.price < PRICE_TOLERANCE &&
            event.timestamp - c.lastUpdated < TIME_WINDOW
        );

        if (existing) {
            existing.totalSize += event.size;
            existing.count += 1;
            existing.lastUpdated = event.timestamp;
            existing.price = (existing.price * (existing.count - 1) + event.price) / existing.count;
            existing.intensity = this.normalize(existing.totalSize);
        } else {
            this.clusters.push({
                price: event.price,
                totalSize: event.size,
                count: 1,
                side: event.side,
                intensity: this.normalize(event.size),
                lastUpdated: event.timestamp,
                firstSeen: event.timestamp,
            });
        }
    }

    /**
     * Get visible clusters with age factor applied.
     * Removes expired clusters.
     */
    getVisible(currentTime: number): (LiqCluster & { ageFactor: number })[] {
        const visible: (LiqCluster & { ageFactor: number })[] = [];
        this.clusters = this.clusters.filter(c => {
            const age = currentTime - c.lastUpdated;
            const ageFactor = 1 - (age / MAX_AGE);
            if (ageFactor <= 0) return false; // expired, remove
            visible.push({ ...c, ageFactor });
            return true;
        });
        return visible;
    }

    clear(): void {
        this.clusters = [];
    }

    private normalize(size: number): number {
        return Math.min(1, Math.max(0, (size - MIN_LIQ_SIZE) / (MAX_LIQ_SIZE - MIN_LIQ_SIZE)));
    }
}

// Singleton instance
export const liqClusterEngine = new LiqClusterEngine();
