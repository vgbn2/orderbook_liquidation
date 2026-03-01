#pragma once
#include "types.hpp"
#include <array>
#include <mutex>
#include <cmath>
#include <chrono>

// Move VWAF computation from JS into C++ alongside the orderbook.
// Node.js calls updateFunding() from each exchange adapter's funding poll.
// Every 5s the broadcast timer calls compute() to get the result.

class VWAFEngine {
public:
    void updateFunding(ExchangeID ex, double rate, double oi_usd, int64_t ts_ms) {
        std::lock_guard lock(mutex_);
        size_t i = static_cast<size_t>(ex);
        rates_[i]    = rate;
        oi_usd_[i]   = oi_usd;
        ts_[i]       = ts_ms;
        active_[i]   = true;
    }

    VWAFResult compute() const {
        std::lock_guard lock(mutex_);

        VWAFResult r{};
        double total_oi = 0;
        int64_t now_ms = currentMs();

        // Sum OI from exchanges with fresh data (< 90s old)
        for (size_t i = 0; i < N_EX; ++i) {
            r.active[i] = active_[i] && (now_ms - ts_[i]) < 90'000;
            if (r.active[i]) {
                total_oi += oi_usd_[i];
                r.oi_usd[i] = oi_usd_[i];
                r.rates[i]  = rates_[i];
            }
        }

        if (total_oi < 1e6) {
            // Not enough data yet
            for (size_t i = 0; i < N_EX; ++i) {
                if (r.active[i]) r.weights[i] = 0;
            }
            return r;  
        }

        r.total_oi_usd = total_oi;

        // Volume-weighted average funding rate
        double vwaf = 0;
        for (size_t i = 0; i < N_EX; ++i) {
            if (!r.active[i]) continue;
            r.weights[i] = oi_usd_[i] / total_oi;
            vwaf += rates_[i] * r.weights[i];
        }

        r.vwaf       = vwaf;
        r.annualized = vwaf * 3.0 * 365.0;

        // Divergence: population std deviation of rates from VWAF
        double sq_sum = 0;
        int n = 0;
        for (size_t i = 0; i < N_EX; ++i) {
            if (!r.active[i]) continue;
            double dev = rates_[i] - vwaf;
            sq_sum += dev * dev;
            ++n;
        }
        r.divergence = n > 0 ? std::sqrt(sq_sum / n) : 0;

        // Sentiment
        if      (vwaf >  0.0005) r.sentiment =  2;
        else if (vwaf >  0.0002) r.sentiment =  1;
        else if (vwaf < -0.0005) r.sentiment = -2;
        else if (vwaf < -0.0002) r.sentiment = -1;
        else                     r.sentiment =  0;

        return r;
    }

    void clear() {
        std::lock_guard lock(mutex_);
        active_.fill(false);
    }

private:
    static constexpr size_t N_EX = static_cast<size_t>(ExchangeID::MAX_EXCHANGES);

    mutable std::mutex mutex_;
    std::array<double,  N_EX> rates_{};
    std::array<double,  N_EX> oi_usd_{};
    std::array<int64_t, N_EX> ts_{};
    std::array<bool,    N_EX> active_{};

    static int64_t currentMs() {
        using namespace std::chrono;
        return duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
    }
};
