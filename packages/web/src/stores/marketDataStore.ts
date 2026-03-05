// ─────────────────────────────────────────────────────────────────────────────
// stores/marketDataStore.ts
//
// Owns: orderbook, liquidations, trades, options, funding, OI, VWAF, confluence.
// Live market state that updates at WebSocket frequency.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import {
    OrderbookData, LiquidationHeatmapData, TradeData,
    OptionsAnalyticsData, OptionTradeData, FundingRateData,
    OpenInterestData, VWAFDataStore, ConfluenceZone, Alert,
    ConfirmedSweep, FVG, OrderBlock,
} from '../types';
import { LiqCluster, liqClusterEngine, LiqEvent } from '../engines/liqCluster';

export type { LiqEvent };

interface MarketDataState {
    // Connection
    connected: boolean;
    setConnected: (v: boolean) => void;

    // Price
    lastPrice: number;
    priceDirection: 'bullish' | 'bearish' | 'neutral';
    setLastPrice: (price: number) => void;

    // Orderbook
    orderbook: OrderbookData | null;
    setOrderbook: (ob: OrderbookData | null) => void;
    deepOrderbook: { bids: { price: number; qty: number }[]; asks: { price: number; qty: number }[] } | null;
    setDeepOrderbook: (ob: MarketDataState['deepOrderbook']) => void;

    // Liquidations
    liquidations: LiquidationHeatmapData | null;
    setLiquidations: (d: LiquidationHeatmapData | null) => void;
    liqClusters: (LiqCluster & { ageFactor: number })[];
    addLiquidation: (event: LiqEvent) => void;
    significantLiquidations: LiqEvent[];
    addSignificantLiquidation: (event: LiqEvent) => void;

    // Trades
    trades: TradeData[];
    addTrade: (t: TradeData | TradeData[]) => void;

    // Options
    options: OptionsAnalyticsData | null;
    setOptions: (o: OptionsAnalyticsData | null) => void;
    optionTrades: OptionTradeData[];
    addOptionTrade: (t: OptionTradeData) => void;

    // Funding & OI
    fundingRates: FundingRateData[];
    setFundingRates: (rates: FundingRateData[]) => void;
    openInterest: OpenInterestData[];
    setOpenInterest: (oi: OpenInterestData[]) => void;

    // VWAF
    vwaf: VWAFDataStore | null;
    setVwaf: (v: VWAFDataStore | null) => void;

    // Confluence zones
    confluenceZones: ConfluenceZone[] | null;
    setConfluenceZones: (z: ConfluenceZone[]) => void;

    // ICT data
    ictData: {
        fvgs: FVG[];
        orderBlocks: OrderBlock[];
        sweeps: ConfirmedSweep[];
        swingHighs: { price: number; time: number }[];
        swingLows: { price: number; time: number }[];
    } | null;
    setIctData: (d: any) => void;
    confirmedSweeps: ConfirmedSweep[];
    setConfirmedSweeps: (s: ConfirmedSweep[]) => void;

    // Alerts
    activeAlerts: Alert[];
    addAlert: (a: Alert) => void;
    dismissAlert: (id: string) => void;
    clearAlerts: () => void;

    // Quant snapshot
    quantSnapshot: any | null;
    setQuantSnapshot: (s: any) => void;

    // QuantPanel lock — freeze analytics on a specific symbol
    lockedQuantSymbol: string | null;
    setLockedQuantSymbol: (s: string | null) => void;

    // Replay
    isReplayMode: boolean;
    setReplayMode: (v: boolean) => void;
    replayTimestamp: number | null;
    setReplayTimestamp: (ts: number | null) => void;
    replayConfig: {
        startTime: number | null;
        endTime: number | null;
        speed: number;
        timeframe: string | null;
    };
    setReplayConfig: (config: MarketDataState['replayConfig']) => void;

    // WebSocket send function (registered by useWebSocket)
    send: (msg: any) => void;
    setSend: (fn: (msg: any) => void) => void;
}

export const useMarketDataStore = create<MarketDataState>((set, get) => ({
    connected: false,
    setConnected: (v) => set({ connected: v }),

    lastPrice: 0,
    priceDirection: 'neutral',
    setLastPrice: (price) => {
        const prev = get().lastPrice;
        set({
            lastPrice: price,
            priceDirection: price > prev ? 'bullish' : price < prev ? 'bearish' : 'neutral',
        });
    },

    orderbook: null,
    setOrderbook: (ob) => set({ orderbook: ob }),
    deepOrderbook: null,
    setDeepOrderbook: (ob) => set({ deepOrderbook: ob }),

    liquidations: null,
    setLiquidations: (d) => set({ liquidations: d }),
    liqClusters: [] as (LiqCluster & { ageFactor: number })[],
    addLiquidation: (event) => {
        liqClusterEngine.process(event);
        set({ liqClusters: liqClusterEngine.getVisible(Date.now()) });
    },
    significantLiquidations: [] as LiqEvent[],
    addSignificantLiquidation: (event) => {
        if (!event) return;
        const size = event.size_usd ?? event.size ?? 0;
        if (size < 10_000) return; // Ignore sub-$10K events
        set((s) => ({
            significantLiquidations: [event, ...s.significantLiquidations].slice(0, 50),
        }));
    },

    trades: [],
    addTrade: (t) => set((s) => {
        const newTrades = Array.isArray(t) ? [...t] : [t];
        const next = [...newTrades, ...s.trades].slice(0, 50);
        return { trades: next };
    }),

    options: null,
    setOptions: (o) => set({ options: o }),
    optionTrades: [],
    addOptionTrade: (t) => set((s) => ({
        optionTrades: [t, ...s.optionTrades].slice(0, 30),
    })),

    fundingRates: [],
    setFundingRates: (rates) => set({ fundingRates: rates }),

    openInterest: [],
    setOpenInterest: (oi) => set({ openInterest: oi }),

    vwaf: null,
    setVwaf: (v) => set({ vwaf: v }),

    confluenceZones: [] as ConfluenceZone[],
    setConfluenceZones: (z) => set({ confluenceZones: z }),

    ictData: { fvgs: [], orderBlocks: [], sweeps: [], swingHighs: [], swingLows: [] },
    setIctData: (d) => set({ ictData: d }),
    confirmedSweeps: [] as ConfirmedSweep[],
    setConfirmedSweeps: (s) => set({ confirmedSweeps: s }),

    activeAlerts: [],
    addAlert: (a) => set((s) => ({ activeAlerts: [a, ...s.activeAlerts].slice(0, 100) })),
    dismissAlert: (id) => set((s) => ({ activeAlerts: s.activeAlerts.filter(a => a.id !== id) })),
    clearAlerts: () => set({ activeAlerts: [] }),

    quantSnapshot: null,
    setQuantSnapshot: (s) => {
        const locked = get().lockedQuantSymbol;
        // If locked, only accept updates for the locked symbol
        if (locked && s && s.symbol !== locked) return;
        set({ quantSnapshot: s });
    },

    lockedQuantSymbol: null,
    setLockedQuantSymbol: (s) => set({ lockedQuantSymbol: s }),

    isReplayMode: false,
    setReplayMode: (v) => set({ isReplayMode: v }),
    replayTimestamp: null,
    setReplayTimestamp: (ts) => set({ replayTimestamp: ts }),
    replayConfig: {
        startTime: null,
        endTime: null,
        speed: 1,
        timeframe: null,
    },
    setReplayConfig: (config) => set({ replayConfig: config }),

    send: () => { },
    setSend: (fn) => set({ send: fn }),
}));
