import { logger } from '../logger.js';
import bindings from 'bindings';

// Type definitions matching the C++ structs
export interface Level {
    price: number;
    qty: number;
}

export interface AggregatedSnapshot {
    bids: Level[];
    asks: Level[];
    vwaf_bullish: number;
    vwaf_bearish: number;
}

export interface NativeAddon {
    initSnapshot(exchangeId: string, data: any): void;
    applyDelta(exchangeId: string, data: any): void;
    updateFunding(exchangeId: string, fundingRate: number): void;
    getAggregated(depth: number): AggregatedSnapshot;
    getVWAF(): any;
    clearExchange(exchangeId: string): void;
    clearAll(): void;
}

class NativeOrderbookWrapper {
    private addon: NativeAddon | null = null;
    private fallbackEnabled = false;

    constructor() {
        try {
            // This expects terminus_core.node to be built in build/Release
            this.addon = bindings('terminus_core');
            logger.info('✅ Native C++ Engine (terminus_core) loaded successfully');
        } catch (err) {
            logger.warn({ err }, '⚠️ Failed to load native C++ Engine. Falling back to JS-only mode.');
            this.fallbackEnabled = true;
        }
    }

    // Proxy methods to C++ addon
    initSnapshot(exchangeId: string, data: any) {
        if (this.fallbackEnabled) return; // Fallback handles this elsewhere or logs
        this.addon?.initSnapshot(exchangeId, data);
    }

    applyDelta(exchangeId: string, data: any) {
        if (this.fallbackEnabled) return;
        this.addon?.applyDelta(exchangeId, data);
    }

    updateFunding(exchangeId: string, fundingRate: number) {
        if (this.fallbackEnabled) return;
        this.addon?.updateFunding(exchangeId, fundingRate);
    }

    getAggregated(depth: number = 25): AggregatedSnapshot | null {
        if (this.fallbackEnabled) return null;
        return this.addon?.getAggregated(depth) || null;
    }

    getVWAF(): any {
        if (this.fallbackEnabled) return null;
        return this.addon?.getVWAF() || null;
    }

    clearExchange(exchangeId: string) {
        if (this.fallbackEnabled) return;
        this.addon?.clearExchange(exchangeId);
    }

    stop() {
        if (this.fallbackEnabled) return;
        this.addon?.clearAll();
    }
}

export const nativeOrderbook = new NativeOrderbookWrapper();
