import { create } from 'zustand';

export interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface TradeData {
    time: number;
    price: number;
    qty: number;
    side: 'buy' | 'sell';
    exchange: string;
    symbol: string;
}

export interface OrderbookData {
    bids: { price: number; qty: number }[];
    asks: { price: number; qty: number }[];
    walls: {
        bid_walls: { price: number; qty: number; pct: number }[];
        ask_walls: { price: number; qty: number; pct: number }[];
    };
}

export interface OptionsAnalyticsData {
    max_pain: number;
    gex_flip: number | null;
    total_gex: number;
    gex_by_strike: Record<number, number>;
    oi_by_strike: Record<number, { call_oi: number; put_oi: number; total: number }>;
    pcr: number;
    regime: 'pinned' | 'explosive';
}

export interface OptionTradeData {
    type: 'call' | 'put';
    strike: number;
    size: number;
    premium_usd: number;
    iv: number;
    side: 'buy' | 'sell';
    aggressor: 'bullish' | 'bearish';
    instrument: string;
}

export interface LiquidationHeatmapData {
    heatmap: { price: number; long_liq_usd: number; short_liq_usd: number; total: number }[];
    total_usd: number;
    event_count: number;
}

export interface VWAFDataStore {
    vwaf: number;
    vwaf_annualized: number;
    vwaf_8h_pct: number;
    total_oi_usd: number;
    divergence: number;
    sentiment: string;
    by_exchange: { exchange: string; rate: number; oi_usd: number; weight: number }[];
}

export interface ConfluenceZoneStore {
    price_low: number;
    price_high: number;
    center: number;
    score: number;
    strength: 'high' | 'medium' | 'low';
    reasons: { signal: string; detail?: string; contribution: number }[];
}

interface MarketState {
    // Connection
    connected: boolean;
    setConnected: (v: boolean) => void;

    // Price
    lastPrice: number;
    priceDirection: 'bullish' | 'bearish' | 'neutral';
    setLastPrice: (price: number) => void;

    // Candles
    candles: CandleData[];
    setCandles: (candles: CandleData[]) => void;
    addCandle: (candle: CandleData) => void;
    updateLastCandle: (candle: CandleData) => void;

    // Orderbook
    orderbook: OrderbookData | null;
    setOrderbook: (ob: OrderbookData) => void;

    // Options
    options: OptionsAnalyticsData | null;
    setOptions: (o: OptionsAnalyticsData) => void;
    optionTrades: OptionTradeData[];
    addOptionTrade: (t: OptionTradeData) => void;

    // Liquidations
    liquidations: LiquidationHeatmapData | null;
    setLiquidations: (d: LiquidationHeatmapData) => void;

    // VWAF
    vwaf: VWAFDataStore | null;
    setVwaf: (v: VWAFDataStore) => void;

    // Confluence
    confluenceZones: ConfluenceZoneStore[] | null;
    setConfluenceZones: (z: ConfluenceZoneStore[]) => void;

    // Trades
    trades: TradeData[];
    addTrade: (t: TradeData) => void;

    // Replay
    isReplayMode: boolean;
    setReplayMode: (v: boolean) => void;
    replayTimestamp: number | null;
    setReplayTimestamp: (ts: number | null) => void;

    // Quant
    quantSnapshot: any | null;
    setQuantSnapshot: (s: any) => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
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

    candles: [],
    setCandles: (candles) => {
        if (candles.length > 0) {
            const last = candles[candles.length - 1];
            set({ candles, lastPrice: last.close });
        } else {
            set({ candles });
        }
    },
    addCandle: (candle) =>
        set((s) => {
            s.candles.push(candle);
            if (s.candles.length > 1500) s.candles.shift();
            return { candles: s.candles, lastPrice: candle.close };
        }),
    updateLastCandle: (candle) =>
        set((s) => {
            if (s.candles.length > 0) {
                s.candles[s.candles.length - 1] = candle;
            } else {
                s.candles.push(candle);
            }
            return { candles: s.candles, lastPrice: candle.close };
        }),

    orderbook: null,
    setOrderbook: (ob) => set({ orderbook: ob }),

    options: null,
    setOptions: (o) => set({ options: o }),
    optionTrades: [],
    addOptionTrade: (t) =>
        set((s) => ({
            optionTrades: [t, ...s.optionTrades].slice(0, 30),
        })),

    liquidations: null,
    setLiquidations: (d) => set({ liquidations: d }),

    vwaf: null,
    setVwaf: (v) => set({ vwaf: v }),

    confluenceZones: null,
    setConfluenceZones: (z) => set({ confluenceZones: z }),

    trades: [],
    addTrade: (t) =>
        set((s) => {
            s.trades.unshift(t);
            if (s.trades.length > 50) s.trades.length = 50;
            return { trades: s.trades };
        }),

    isReplayMode: false,
    setReplayMode: (v) => set({ isReplayMode: v }),
    replayTimestamp: null,
    setReplayTimestamp: (ts) => set({ replayTimestamp: ts }),

    quantSnapshot: null,
    setQuantSnapshot: (s) => set({ quantSnapshot: s }),
}));
