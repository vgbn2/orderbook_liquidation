// ══════════════════════════════════════════════════════════════
//  Normalized Data Schemas — shared between all adapters
// ══════════════════════════════════════════════════════════════

export type Exchange = 'binance' | 'bybit' | 'okx' | 'deribit' | 'hyperliquid' | 'mexc' | 'bitget' | 'gateio' | 'dydx';

// ── Candle ────────────────────────────────────
export interface Candle {
    time: number;           // unix seconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    exchange: Exchange;
}

// ── Orderbook ─────────────────────────────────
export interface OrderbookLevel {
    price: number;
    qty: number;
}

export interface OrderbookSnapshot {
    time: number;
    exchange: Exchange;
    symbol: string;
    bids: OrderbookLevel[];   // sorted descending by price
    asks: OrderbookLevel[];   // sorted ascending by price
}

export interface OrderbookWall {
    price: number;
    qty: number;
    pct: number;              // percentage of total depth
    side: 'bid' | 'ask';
}

export interface AggregatedOrderbook extends OrderbookSnapshot {
    walls: {
        bid_walls: OrderbookWall[];
        ask_walls: OrderbookWall[];
    };
}

// ── Funding ───────────────────────────────────
export interface FundingSnapshot {
    time: number;
    exchange: Exchange;
    symbol: string;
    rate: number;             // 8h funding rate (e.g., 0.0001 = 0.01%)
    oi_usd: number;           // open interest in USD
    next_funding_time?: number;
    annualized?: number;
}

// ── Options ───────────────────────────────────
export interface OptionInstrument {
    instrument: string;
    strike: number;
    expiry: number;           // unix seconds
    type: 'call' | 'put';
    iv: number;
    oi: number;
    delta: number;
    gamma: number;
    mark_price: number;
}

export interface OptionTrade {
    time: number;
    instrument: string;
    strike: number;
    expiry: number;
    type: 'call' | 'put';
    side: 'buy' | 'sell';
    size: number;
    premium_usd: number;
    iv: number;
    aggressor: 'bullish' | 'bearish';
}

export interface GEXData {
    gex_by_strike: Record<number, number>;
    gex_flip: number | null;
    total_gex: number;
}

export interface OptionsAnalytics {
    expiry: number | 'all';
    max_pain: number;
    gex_flip: number | null;
    total_gex: number;
    gex_by_strike: Record<number, number>;
    oi_by_strike: Record<number, { call_oi: number; put_oi: number; total: number }>;
    pcr: number;              // put/call ratio
    regime: 'pinned' | 'explosive';
}

// ── Liquidations ──────────────────────────────
export interface LiquidationEvent {
    time: number;
    exchange: Exchange;
    symbol: string;
    price: number;
    size_usd: number;
    side: 'long' | 'short';
}

export interface LiquidationHeatmapEntry {
    price: number;
    long_liq_usd: number;
    short_liq_usd: number;
    total: number;
}

export type LiquidationHeatmap = Record<number, LiquidationHeatmapEntry>;

// ── Trades ────────────────────────────────────
export interface Trade {
    time: number;
    price: number;
    qty: number;
    side: 'buy' | 'sell';
    exchange: Exchange;
    symbol: string;
}

// ── VWAF ──────────────────────────────────────
export type Sentiment =
    | 'extremely_long'
    | 'long_heavy'
    | 'neutral'
    | 'short_heavy'
    | 'extremely_short';

export interface VWAFData {
    vwaf: number;
    vwaf_annualized: number;
    vwaf_8h_pct: number;
    total_oi_usd: number;
    divergence: number;
    sentiment: Sentiment;
    by_exchange: {
        exchange: Exchange;
        rate: number;
        oi_usd: number;
        weight: number;
    }[];
}

// ── Confluence Zones ──────────────────────────
export interface ConfluenceReason {
    signal: string;
    detail?: string;
    contribution: number;
}

export interface ConfluenceZone {
    price_low: number;
    price_high: number;
    center: number;
    score: number;
    strength: 'high' | 'medium' | 'low';
    reasons: ConfluenceReason[];
    timestamp: number;
}

// ── Exchange Adapter Interface ────────────────
export interface ExchangeAdapter {
    readonly name: Exchange;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    readonly health: 'healthy' | 'degraded' | 'down';
}

// ── WebSocket Topics ──────────────────────────
export type WSTopic =
    | `candles.${string}.${string}`
    | `orderbook.${string}`
    | `orderbook.aggregated`
    | `options.analytics`
    | `options.large_trade`
    | `liquidations`
    | `liquidations.heatmap`
    | `vwaf`
    | `confluence`
    | `trades`
    | `replay`
    | `alerts`
    | `quant.analytics`
    | `quant.error`
    | 'funding_rate'
    | 'open_interest'
    | 'symbol_changed'
    | 'amd_signal';
