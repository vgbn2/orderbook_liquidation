// ─────────────────────────────────────────────────────────────────────────────
// types/index.ts
//
// Single source of truth for all shared types.
// Rule: if two files need the same type, it lives here — never in a component.
// ─────────────────────────────────────────────────────────────────────────────

// ── Market Data ───────────────────────────────────────────────────────────────

export interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    cvd?: number;
    vwap?: number;
    exchangeSplit?: Record<string, number>;
    isUpdate?: boolean;
}

export interface TradeData {
    time: number;
    price: number;
    qty: number;
    side: 'buy' | 'sell';
    exchange: string;
    symbol: string;
}

export interface OrderbookLevel {
    price: number;
    qty: number;
}

export interface OrderbookData {
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
    walls: {
        bid_walls: (OrderbookLevel & { pct: number; classification?: string })[];
        ask_walls: (OrderbookLevel & { pct: number; classification?: string })[];
    };
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

// ── Options ───────────────────────────────────────────────────────────────────

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

// ── ICT / SMC ────────────────────────────────────────────────────────────────

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

// ── Alerts & UI ───────────────────────────────────────────────────────────────

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

export interface ConfluenceZone {
    price_low: number;
    price_high: number;
    center: number;
    score: number;
    strength: 'high' | 'medium' | 'low';
    reasons: { signal: string; detail?: string; contribution: number }[];
}

// ── Chart Drawings ────────────────────────────────────────────────────────────

export type DrawingTool = 'none' | 'line' | 'hline' | 'box' | 'fib' | 'ray';
export type DrawingDash = 'solid' | 'dashed' | 'dotted';

interface DrawingBase {
    id: string;
    color: string;
    lineWidth?: number;
    dash?: DrawingDash;
    label?: string;
}

interface TwoPointDrawing extends DrawingBase {
    p1: { time: number; price: number };
    p2: { time: number; price: number };
}

export interface LineDrawing extends TwoPointDrawing { type: 'line' }
export interface BoxDrawing extends TwoPointDrawing { type: 'box' }
export interface FibDrawing extends TwoPointDrawing { type: 'fib' }
export interface RayDrawing extends TwoPointDrawing { type: 'ray' }

export interface HLineDrawing extends DrawingBase {
    type: 'hline';
    price: number;
}

export type Drawing = LineDrawing | HLineDrawing | BoxDrawing | FibDrawing | RayDrawing;

// ── Indicators ────────────────────────────────────────────────────────────────

export type IndicatorKey =
    | 'volume' | 'cvd' | 'cvd_htf' | 'delta' | 'vwap'
    | 'liq_overlay' | 'rsi' | 'macd' | 'resting_liq'
    | 'liq_clusters' | 'funding_rate' | 'open_interest'
    | 'session_boxes' | 'log_scale' | 'vol_profile'
    | 'line_chart' | 'ict_fvg' | 'ict_ob' | 'ict_sweeps';
