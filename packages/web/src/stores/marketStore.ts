import { create } from 'zustand';
import { LiqCluster, liqClusterEngine, LiqEvent } from '../engines/liqCluster';

export interface FVG {
    id: string;
    type: 'bullish' | 'bearish';
    top: number;
    bottom: number;
    midpoint: number;
    formedAt: number;
    filled: boolean;
    partialFill: number;
}

export interface OrderBlock {
    id: string;
    type: 'bullish' | 'bearish';
    top: number;
    bottom: number;
    formedAt: number;
    broken: boolean;
    strength: 'fresh' | 'tested' | 'broken';
}

export interface ConfirmedSweep {
    id: string;
    type: 'BSL' | 'SSL';
    sweptLevel: number;
    sweepCandle: CandleData;
    reversalCandle: CandleData;
    sweepCloseDistance: number;
    reversalBars: number;
    liqBacking: {
        usdAtLevel: number;
        longLiqUsd: number;
        shortLiqUsd: number;
        isSignificant: boolean;
    } | null;
    confidence: 'high' | 'medium' | 'low';
}

export interface HTFBias {
    direction: 'bullish' | 'bearish' | 'neutral';
    aboveSma50: boolean;
    aboveSma200: boolean;
    lastSwingHigh: number;
    lastSwingLow: number;
    sma20: number;
    sma50: number;
    ema200: number;
    rsi14: number;
    rangePosition: number;
    isPremium: boolean;
    isDiscount: boolean;
}


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

export interface FundingRateData {
    time: number;
    rate: number;
}

export interface OpenInterestData {
    time: number;
    oi: number;
}

export interface Alert {
    id: string;
    type: string;
    message: string;
    severity: 'info' | 'warn' | 'critical';
    time: number;
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
    symbol: string;
    setSymbol: (symbol: string) => void;
    timeframe: string;
    setTimeframe: (tf: string) => void;

    candles: CandleData[];
    setCandles: (candles: CandleData[]) => void;
    addCandle: (candle: CandleData) => void;
    updateLastCandle: (candle: CandleData) => void;

    // Orderbook
    orderbook: OrderbookData | null;
    setOrderbook: (ob: OrderbookData | null) => void;

    // Options
    options: OptionsAnalyticsData | null;
    setOptions: (o: OptionsAnalyticsData | null) => void;
    optionTrades: OptionTradeData[];
    addOptionTrade: (t: OptionTradeData) => void;

    liquidations: LiquidationHeatmapData | null;
    setLiquidations: (d: LiquidationHeatmapData | null) => void;
    liqClusters: (LiqCluster & { ageFactor: number })[];
    addLiquidation: (event: LiqEvent) => void;

    // Funding & OI
    fundingRates: FundingRateData[];
    setFundingRates: (rates: FundingRateData[]) => void;

    openInterest: OpenInterestData[];
    setOpenInterest: (oi: OpenInterestData) => void;

    // VWAF
    vwaf: VWAFDataStore | null;
    setVwaf: (v: VWAFDataStore | null) => void;

    // Confluence
    confluenceZones: ConfluenceZoneStore[] | null;
    setConfluenceZones: (z: ConfluenceZoneStore[]) => void;

    // Trades
    trades: TradeData[];
    addTrade: (t: TradeData | TradeData[]) => void;

    // Alerts
    activeAlerts: Alert[];
    addAlert: (a: Alert) => void;
    dismissAlert: (id: string) => void;
    clearAlerts: () => void;

    // Replay
    isReplayMode: boolean;
    setReplayMode: (v: boolean) => void;
    replayTimestamp: number | null;
    setReplayTimestamp: (ts: number | null) => void;

    // Quant
    quantSnapshot: any | null;
    setQuantSnapshot: (s: any) => void;

    // Multi-Scale CVD
    multiTfCvd: Record<string, { time: number; value: number }[]>;
    setMultiTfCvd: (tf: string, data: { time: number; value: number }[]) => void;

    // —— ICT ——
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

    // —— HTF ——
    htfCandles: Record<string, CandleData[]>;
    setHtfCandles: (tf: string, candles: CandleData[]) => void;
    addHtfCandle: (tf: string, candle: CandleData) => void;
    htfBias: Record<string, HTFBias>;
    setHtfBias: (tf: string, bias: HTFBias) => void;

    // WebSocket singleton
    send: (msg: any) => void;
    setSend: (fn: (msg: any) => void) => void;
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

    symbol: localStorage.getItem('terminus_market_symbol') || 'BTCUSDT',
    setSymbol: (symbol) => {
        localStorage.setItem('terminus_market_symbol', symbol);
        set({ symbol });
    },
    timeframe: localStorage.getItem('terminus_market_timeframe') || '1h',
    setTimeframe: (timeframe) => {
        localStorage.setItem('terminus_market_timeframe', timeframe);
        set({ timeframe });
    },

    candles: [],
    setCandles: (candles) => {
        if (candles.length > 0) {
            const last = candles[candles.length - 1];
            set({ candles: [...candles], lastPrice: last.close });
        } else {
            set({ candles: [] });
        }
    },
    addCandle: (candle) =>
        set((s) => {
            // Deduplicate: if last candle has same time, it's a duplicate push
            if (s.candles.length > 0 && s.candles[s.candles.length - 1].time === candle.time) {
                return s;
            }
            const newCandles = [...s.candles, candle];
            if (newCandles.length > 1500) newCandles.shift();
            return { candles: newCandles, lastPrice: candle.close };
        }),
    updateLastCandle: (candle) =>
        set((s) => {
            const newCandles = [...s.candles];
            if (newCandles.length > 0) {
                newCandles[newCandles.length - 1] = candle;
            } else {
                newCandles.push(candle);
            }
            return { candles: newCandles, lastPrice: candle.close };
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
    liqClusters: [],
    addLiquidation: (event) => {
        liqClusterEngine.process(event);
        set({ liqClusters: liqClusterEngine.getVisible(Date.now()) });
    },

    fundingRates: [],
    setFundingRates: (rates) => set({ fundingRates: rates }),

    openInterest: [],
    setOpenInterest: (oi) => set((s) => {
        s.openInterest.push(oi);
        if (s.openInterest.length > 500) s.openInterest.shift();
        return { openInterest: [...s.openInterest] };
    }),

    vwaf: null,
    setVwaf: (v) => set({ vwaf: v }),

    confluenceZones: null,
    setConfluenceZones: (z) => set({ confluenceZones: z }),

    trades: [],
    addTrade: (t) =>
        set((s) => {
            const newTrades = Array.isArray(t) ? t : [t];
            s.trades.unshift(...newTrades);
            if (s.trades.length > 50) s.trades.length = 50;
            return { trades: [...s.trades] };
        }),

    activeAlerts: [],
    addAlert: (a) => set(s => ({
        activeAlerts: [a, ...s.activeAlerts].slice(0, 100)
    })),
    dismissAlert: (id) => set(s => ({
        activeAlerts: s.activeAlerts.filter(a => a.id !== id)
    })),
    clearAlerts: () => set({ activeAlerts: [] }),

    isReplayMode: false,
    setReplayMode: (v) => set({ isReplayMode: v }),
    replayTimestamp: null,
    setReplayTimestamp: (ts) => set({ replayTimestamp: ts }),

    quantSnapshot: null,
    setQuantSnapshot: (s) => set({ quantSnapshot: s }),

    multiTfCvd: (() => {
        if (typeof window === 'undefined') return {};
        try {
            const saved = localStorage.getItem('terminus_multi_tf_cvd');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    })(),
    setMultiTfCvd: (tf, data) =>
        set((s) => {
            const updated = { ...s.multiTfCvd };
            updated[tf] = data.slice(-500); // Keep last 500 points for persistence efficiency
            localStorage.setItem('terminus_multi_tf_cvd', JSON.stringify(updated));
            return { multiTfCvd: updated };
        }),

    ictData: null,
    setIctData: (d) => set({ ictData: d }),
    confirmedSweeps: [],
    setConfirmedSweeps: (s) => set({ confirmedSweeps: s }),

    htfCandles: {},
    setHtfCandles: (tf, candles) => set(s => ({
        htfCandles: { ...s.htfCandles, [tf]: candles }
    })),
    addHtfCandle: (tf, candle) => set(s => {
        const existing = s.htfCandles[tf] ?? [];
        const last = existing[existing.length - 1];
        const updated = last?.time === candle.time
            ? [...existing.slice(0, -1), candle]
            : [...existing, candle].slice(-500);
        return { htfCandles: { ...s.htfCandles, [tf]: updated } };
    }),
    htfBias: {},
    setHtfBias: (tf, bias) => set(s => ({
        htfBias: { ...s.htfBias, [tf]: bias }
    })),

    send: () => { },
    setSend: (fn) => set({ send: fn })
}));
