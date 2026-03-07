// terminus_core.cpp
// This file is the bridge between C++ and Node.js V8 engine.
// Every function here is a synchronous N-API call — no async, no libuv.
// The C++ operations are fast enough (microseconds) that sync is correct.

#include <napi.h>
#include "aggregator.hpp"
#include "vwaf.hpp"
#include <iostream>
#include <vector>
#include <cmath>
#include <numeric>
#include <algorithm>

using namespace Napi;

// ── Global singletons — created once, live for process lifetime ──
static CrossExchangeAggregator g_aggregator;
static VWAFEngine               g_vwaf;

// ── Gaussian PDF ──────────────────────────────────────────────────────────
double normalPdf(double x) {
    const double invSqrt2Pi = 0.3989422804014327;
    return invSqrt2Pi * std::exp(-0.5 * x * x);
}

// ── Gaussian CDF ──────────────────────────────────────────────────────────
double normalCdf(double x) {
    const double sign = x < 0 ? -1.0 : 1.0;
    x = std::abs(x) / std::sqrt(2.0);
    const double t = 1.0 / (1.0 + 0.3275911 * x);
    const double y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * std::exp(-x * x);
    return 0.5 * (1.0 + sign * y);
}

// ── Gaussian PPF ──────────────────────────────────────────────────────────
double normalPpf(double p) {
    if (p <= 0.0) return -INFINITY;
    if (p >= 1.0) return INFINITY;
    if (p < 0.5) return -normalPpf(1.0 - p);

    const double t = std::sqrt(-2.0 * std::log(1.0 - p));
    const double c[] = {2.515517, 0.802853, 0.010328};
    const double d[] = {1.432788, 0.189269, 0.001308};

    return t - ((c[2] * t + c[1]) * t + c[0]) / (((d[2] * t + d[1]) * t + d[0]) * t + 1.0);
}

// ── Helper: parse exchange ID from JS value (string or number) ──
ExchangeID parseExchange(const Napi::Value& val) {
    if (val.IsNumber()) {
        uint8_t id = static_cast<uint8_t>(val.As<Napi::Number>().Uint32Value());
        if (id < static_cast<uint8_t>(ExchangeID::MAX_EXCHANGES)) {
            return static_cast<ExchangeID>(id);
        }
        return ExchangeID::MAX_EXCHANGES; // UNKNOWN
    }
    if (val.IsString()) {
        std::string s = val.As<Napi::String>().Utf8Value();
        if (s == "binance")     return ExchangeID::BINANCE;
        if (s == "bybit")       return ExchangeID::BYBIT;
        if (s == "okx")         return ExchangeID::OKX;
        if (s == "hyperliquid") return ExchangeID::HYPERLIQUID;
        if (s == "gate" || s == "gateio") return ExchangeID::GATE;
        if (s == "mexc")        return ExchangeID::MEXC;
        if (s == "bitget")      return ExchangeID::BITGET;
    }
    return ExchangeID::MAX_EXCHANGES;
}

// ── Helper: parse [[price_str, qty_str], ...] from JS Array ──────
std::vector<std::pair<int64_t,double>> parseLevels(const Napi::Array& arr) {
    std::vector<std::pair<int64_t,double>> out;
    out.reserve(arr.Length());
    for (uint32_t i = 0; i < arr.Length(); ++i) {
        Napi::Array level = arr.Get(i).As<Napi::Array>();
        
        // Sometimes JS passes numbers as strings, sometimes as actual numbers.
        // Let's handle both robustly to avoid crashes if adapter sends numbers.
        double price_f;
        if (level.Get(static_cast<uint32_t>(0)).IsString()) {
            price_f = std::stod(level.Get(static_cast<uint32_t>(0)).As<Napi::String>().Utf8Value());
        } else {
            price_f = level.Get(static_cast<uint32_t>(0)).As<Napi::Number>().DoubleValue();
        }

        double qty_f;
        if (level.Get(static_cast<uint32_t>(1)).IsString()) {
            qty_f = std::stod(level.Get(static_cast<uint32_t>(1)).As<Napi::String>().Utf8Value());
        } else {
            qty_f = level.Get(static_cast<uint32_t>(1)).As<Napi::Number>().DoubleValue();
        }

        int64_t price_raw = static_cast<int64_t>(std::round(price_f * PRICE_SCALE));
        out.emplace_back(price_raw, qty_f);
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────
// BINDING: initSnapshot(exchange, updateId, bids, asks)
// Called once per exchange on REST snapshot load
// JS: core.initSnapshot('binance', 12345678, [['63500.50','1.23'],...], [...])
// ─────────────────────────────────────────────────────────────────
Napi::Value InitSnapshot(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    try {
        if (info.Length() < 3) throw std::invalid_argument("Too few arguments");
        
        auto ex        = parseExchange(info[0]);
        if (ex == ExchangeID::MAX_EXCHANGES) throw std::invalid_argument("Invalid exchange");

        // Handle case where 3 args (ex, bids, asks) or 4 args (ex, updateId, bids, asks)
        if (info.Length() == 3) {
            auto bids = parseLevels(info[1].As<Napi::Array>());
            auto asks = parseLevels(info[2].As<Napi::Array>());
            g_aggregator.initSnapshot(ex, 0, bids, asks);
        } else {
            uint64_t uid   = info[1].As<Napi::Number>().Int64Value();
            auto bids      = parseLevels(info[2].As<Napi::Array>());
            auto asks      = parseLevels(info[3].As<Napi::Array>());
            g_aggregator.initSnapshot(ex, uid, bids, asks);
        }
    } catch (const std::exception& e) {
        Napi::TypeError::New(env, e.what()).ThrowAsJavaScriptException();
    }
    return env.Undefined();
}

// ─────────────────────────────────────────────────────────────────
// BINDING: applyDelta(exchange, updateId, bidDeltas, askDeltas)
// Called on every WS depth update — the hot path
// JS: core.applyDelta('bybit', 12345679, [['63500.50','0'],...], [...])
// ─────────────────────────────────────────────────────────────────
Napi::Value ApplyDelta(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    try {
        if (info.Length() < 3) throw std::invalid_argument("Too few arguments");
        
        auto ex = parseExchange(info[0]);
        if (ex == ExchangeID::MAX_EXCHANGES) throw std::invalid_argument("Invalid exchange");

        // Handle case where 3 args (ex, bids, asks) or 4 args (ex, updateId, bids, asks)
        if (info.Length() == 3 || (info.Length() == 4 && info[3].IsBoolean())) {
            auto bids = parseLevels(info[1].As<Napi::Array>());
            auto asks = parseLevels(info[2].As<Napi::Array>());
            bool is_snap = info.Length() == 4 ? info[3].As<Napi::Boolean>().Value() : false;
            g_aggregator.applyDelta(ex, 0, bids, asks, is_snap);
        } else {
            uint64_t uid = info[1].As<Napi::Number>().Int64Value();
            auto bids    = parseLevels(info[2].As<Napi::Array>());
            auto asks    = parseLevels(info[3].As<Napi::Array>());
            bool is_snap = info.Length() == 5 ? info[4].As<Napi::Boolean>().Value() : false;
            g_aggregator.applyDelta(ex, uid, bids, asks, is_snap);
        }
    } catch (const std::exception& e) {
        Napi::TypeError::New(env, e.what()).ThrowAsJavaScriptException();
    }
    return env.Undefined();
}

// ─────────────────────────────────────────────────────────────────
// BINDING: getAggregated(levels?) → JS object
// Called from broadcast timer — returns merged book as V8 object
// ─────────────────────────────────────────────────────────────────
Napi::Value GetAggregated(const Napi::CallbackInfo& info) {
    auto env    = info.Env();
    size_t levels = info.Length() > 0 ? info[0].As<Napi::Number>().Uint32Value() : OUTPUT_LEVELS;

    const auto snap = g_aggregator.getAggregated(levels);

    // Build JS object: { bids, asks, walls, best_bid, best_ask, spread, mid_price, ts }
    auto obj = Napi::Object::New(env);
    obj.Set("timestamp", Napi::Number::New(env, static_cast<double>(snap.timestamp_ms)));
    obj.Set("best_bid",  Napi::Number::New(env, snap.best_bid));
    obj.Set("best_ask",  Napi::Number::New(env, snap.best_ask));
    obj.Set("spread",    Napi::Number::New(env, snap.spread));
    obj.Set("mid_price", Napi::Number::New(env, snap.mid_price));

    // Bids array
    auto bids_arr = Napi::Array::New(env, snap.bid_count);
    for (size_t i = 0; i < snap.bid_count; ++i) {
        auto level = Napi::Object::New(env);
        level.Set("price", Napi::Number::New(env, snap.bids[i].price_f()));
        level.Set("qty",   Napi::Number::New(env, snap.bids[i].qty));
        bids_arr.Set(static_cast<uint32_t>(i), level);
    }
    obj.Set("bids", bids_arr);

    // Asks array
    auto asks_arr = Napi::Array::New(env, snap.ask_count);
    for (size_t i = 0; i < snap.ask_count; ++i) {
        auto level = Napi::Object::New(env);
        level.Set("price", Napi::Number::New(env, snap.asks[i].price_f()));
        level.Set("qty",   Napi::Number::New(env, snap.asks[i].qty));
        asks_arr.Set(static_cast<uint32_t>(i), level);
    }
    obj.Set("asks", asks_arr);

    // Walls
    auto walls = Napi::Object::New(env);

    auto bid_walls = Napi::Array::New(env, snap.bid_wall_count);
    for (size_t i = 0; i < snap.bid_wall_count; ++i) {
        auto w = Napi::Object::New(env);
        w.Set("price", Napi::Number::New(env, snap.bid_walls[i].price));
        w.Set("qty",   Napi::Number::New(env, snap.bid_walls[i].qty));
        w.Set("pct",   Napi::Number::New(env, snap.bid_walls[i].pct_of_depth));
        bid_walls.Set(static_cast<uint32_t>(i), w);
    }
    walls.Set("bid_walls", bid_walls);

    auto ask_walls = Napi::Array::New(env, snap.ask_wall_count);
    for (size_t i = 0; i < snap.ask_wall_count; ++i) {
        auto w = Napi::Object::New(env);
        w.Set("price", Napi::Number::New(env, snap.ask_walls[i].price));
        w.Set("qty",   Napi::Number::New(env, snap.ask_walls[i].qty));
        w.Set("pct",   Napi::Number::New(env, snap.ask_walls[i].pct_of_depth));
        ask_walls.Set(static_cast<uint32_t>(i), w);
    }
    walls.Set("ask_walls", ask_walls);

    obj.Set("walls", walls);
    return obj;
}

// ─────────────────────────────────────────────────────────────────
// BINDING: updateFunding(exchange, rate, oi_usd)
// Called every ~60s from Binance/Bybit/OKX funding pollers
// ─────────────────────────────────────────────────────────────────
Napi::Value UpdateFunding(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    try {
        auto ex     = parseExchange(info[0]);
        if (ex == ExchangeID::MAX_EXCHANGES) throw std::invalid_argument("Invalid exchange");
        
        double rate = info[1].As<Napi::Number>().DoubleValue();
        double oi   = info[2].As<Napi::Number>().DoubleValue();
        g_vwaf.updateFunding(ex, rate, oi, 
            std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::system_clock::now().time_since_epoch()).count());
    } catch (const std::exception& e) {
        Napi::TypeError::New(env, e.what()).ThrowAsJavaScriptException();
    }
    return env.Undefined();
}

// ─────────────────────────────────────────────────────────────────
// BINDING: getVWAF() → JS object with full VWAF computation
// ─────────────────────────────────────────────────────────────────
Napi::Value GetVWAF(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    const auto r = g_vwaf.compute();

    static const char* EXCHANGE_NAMES[] = {
        "binance","bybit","okx","hyperliquid","gate","mexc","bitget"
    };
    static const char* SENTIMENT_LABELS[] = {
        "extremely_short","short_heavy","neutral","long_heavy","extremely_long"
    };
    constexpr size_t N_EX = static_cast<size_t>(ExchangeID::MAX_EXCHANGES);

    auto obj = Napi::Object::New(env);
    obj.Set("vwaf",        Napi::Number::New(env, r.vwaf));
    obj.Set("annualized",  Napi::Number::New(env, r.annualized));
    obj.Set("divergence",  Napi::Number::New(env, r.divergence));
    obj.Set("total_oi_usd",Napi::Number::New(env, r.total_oi_usd));
    
    // Bounds check for sentiment array lookup (sentiment is typically -2 to +2, meaning indices 0 to 4 after adding 2)
    int sIndex = r.sentiment + 2;
    if (sIndex < 0) sIndex = 0;
    if (sIndex > 4) sIndex = 4;
    obj.Set("sentiment",   Napi::String::New(env, SENTIMENT_LABELS[sIndex]));

    auto by_ex = Napi::Array::New(env);
    uint32_t count = 0;
    for (size_t i = 0; i < N_EX; ++i) {
        if (!r.active[i]) continue;
        auto ex_obj = Napi::Object::New(env);
        ex_obj.Set("exchange", Napi::String::New(env, EXCHANGE_NAMES[i]));
        ex_obj.Set("rate",     Napi::Number::New(env, r.rates[i]));
        ex_obj.Set("oi_usd",   Napi::Number::New(env, r.oi_usd[i]));
        ex_obj.Set("weight",   Napi::Number::New(env, r.weights[i]));
        by_ex.Set(count++, ex_obj);
    }
    obj.Set("by_exchange", by_ex);

    return obj;
}

// ─────────────────────────────────────────────────────────────────
// BINDING: clearExchange(exchange)
// Called when an exchange adapter disconnects
// ─────────────────────────────────────────────────────────────────
Napi::Value ClearExchange(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    try {
        auto ex = parseExchange(info[0]);
        if (ex != ExchangeID::MAX_EXCHANGES) {
            g_aggregator.clearExchange(ex);
        }
    } catch (const std::exception& e) {
        Napi::TypeError::New(env, e.what()).ThrowAsJavaScriptException();
    }
    return env.Undefined();
}

// ── BINDING: kalman1D(typedArray, R, Q) ───────────────────────────────────
Napi::Value Kalman1D(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    if (!info[0].IsTypedArray()) {
        Napi::TypeError::New(env, "TypedArray expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    auto input = info[0].As<Napi::Float64Array>();
    double R = info[1].IsNumber() ? info[1].As<Napi::Number>().DoubleValue() : 0.1;
    double Q = info[2].IsNumber() ? info[2].As<Napi::Number>().DoubleValue() : 0.001;

    size_t len = input.ElementLength();
    if (len == 0) return Napi::Array::New(env, 0);

    auto result = Napi::Float64Array::New(env, len);
    double x = input[0];
    double P = 1.0;

    for (size_t i = 0; i < len; i++) {
        P = P + Q;
        double K = P / (P + R);
        x = x + K * (input[i] - x);
        P = (1.0 - K) * P;
        result[i] = x;
    }
    return result;
}

// ── BINDING: pearsonCorrelation(typedArrayX, typedArrayY) ──────────────────
Napi::Value PearsonCorrelation(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    auto x = info[0].As<Napi::Float64Array>();
    auto y = info[1].As<Napi::Float64Array>();

    size_t n = std::min(x.ElementLength(), y.ElementLength());
    if (n < 2) return Napi::Number::New(env, 0.0);

    double sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (size_t i = 0; i < n; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i];
        sumY2 += y[i] * y[i];
    }

    double num = n * sumXY - sumX * sumY;
    double den = std::sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return Napi::Number::New(env, den == 0 ? 0.0 : num / den);
}

// ── BINDING: Gaussian Helpers ─────────────────────────────────────────────
Napi::Value NormalPdf(const Napi::CallbackInfo& info) { return Napi::Number::New(info.Env(), normalPdf(info[0].As<Napi::Number>().DoubleValue())); }
Napi::Value NormalCdf(const Napi::CallbackInfo& info) { return Napi::Number::New(info.Env(), normalCdf(info[0].As<Napi::Number>().DoubleValue())); }
Napi::Value NormalPpf(const Napi::CallbackInfo& info) { return Napi::Number::New(info.Env(), normalPpf(info[0].As<Napi::Number>().DoubleValue())); }

// ─────────────────────────────────────────────────────────────────
// MODULE INIT — register all exported functions
// ─────────────────────────────────────────────────────────────────
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("initSnapshot",   Napi::Function::New(env, InitSnapshot));
    exports.Set("applyDelta",     Napi::Function::New(env, ApplyDelta));
    exports.Set("getAggregated",  Napi::Function::New(env, GetAggregated));
    exports.Set("updateFunding",  Napi::Function::New(env, UpdateFunding));
    exports.Set("getVWAF",        Napi::Function::New(env, GetVWAF));
    exports.Set("clearExchange",  Napi::Function::New(env, ClearExchange));

    // Math exports
    exports.Set("kalman1D",           Napi::Function::New(env, Kalman1D));
    exports.Set("pearsonCorrelation", Napi::Function::New(env, PearsonCorrelation));
    exports.Set("normalPdf",          Napi::Function::New(env, NormalPdf));
    exports.Set("normalCdf",          Napi::Function::New(env, NormalCdf));
    exports.Set("normalPpf",          Napi::Function::New(env, NormalPpf));

    return exports;
}

NODE_API_MODULE(terminus_core, Init)
