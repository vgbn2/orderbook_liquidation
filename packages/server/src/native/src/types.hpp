#pragma once
#include <cstdint>
#include <string>
#include <array>

// Represent price as integer to avoid float comparison issues.
// All prices multiplied by PRICE_SCALE = 100 (2 decimal places for BTC).
// e.g. $63,500.50 → 6350050
// For SOL/ETH with more decimals, use PRICE_SCALE = 10000

constexpr int64_t PRICE_SCALE = 100;
constexpr size_t  MAX_LEVELS  = 1000;  // max tracked levels per side per exchange
constexpr size_t  OUTPUT_LEVELS = 50;  // how many levels we return to Node.js

enum class ExchangeID : uint8_t {
    BINANCE     = 0,
    BYBIT       = 1,
    OKX         = 2,
    HYPERLIQUID = 3,
    GATE        = 4,
    MEXC        = 5,
    BITGET      = 6,
    MAX_EXCHANGES = 7
};

// A single price level — 16 bytes, cache-line friendly
struct Level {
    int64_t price_raw;  // integer-scaled price
    double  qty;        // float is fine for qty — no comparison needed

    double price_f() const { return static_cast<double>(price_raw) / PRICE_SCALE; }
};

// A wall detection result
struct Wall {
    double price;
    double qty;
    double pct_of_depth;   // e.g. 0.045 = 4.5% of total depth
    bool   is_bid;
};

// Output snapshot sent to Node.js (plain struct — easy to serialize to V8 object)
struct AggregatedSnapshot {
    int64_t  timestamp_ms;
    Level    bids[OUTPUT_LEVELS];
    Level    asks[OUTPUT_LEVELS];
    size_t   bid_count;
    size_t   ask_count;

    // Wall detection results
    Wall  bid_walls[8];
    Wall  ask_walls[8];
    size_t bid_wall_count;
    size_t ask_wall_count;

    // Cross-exchange BBO
    double  best_bid;
    double  best_ask;
    double  spread;
    double  mid_price;
};

// Funding data per exchange — fed from JS adapters
struct FundingUpdate {
    ExchangeID exchange;
    double     rate;       // 8h funding rate
    double     oi_usd;     // open interest in USD
    int64_t    timestamp;  // unix ms
};

// VWAF computation result
struct VWAFResult {
    double vwaf;
    double annualized;
    double divergence;
    double total_oi_usd;
    // Per-exchange breakdown (parallel arrays, indexed by ExchangeID)
    double rates[static_cast<size_t>(ExchangeID::MAX_EXCHANGES)];
    double weights[static_cast<size_t>(ExchangeID::MAX_EXCHANGES)];
    double oi_usd[static_cast<size_t>(ExchangeID::MAX_EXCHANGES)];
    bool   active[static_cast<size_t>(ExchangeID::MAX_EXCHANGES)];
    int    sentiment;  // -2=extreme_short, -1=short, 0=neutral, 1=long, 2=extreme_long
};
