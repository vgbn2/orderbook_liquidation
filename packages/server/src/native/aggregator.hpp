#pragma once
#include "orderbook.hpp"
#include "wall_detector.hpp"
#include <array>
#include <shared_mutex>   // C++17 reader-writer lock — multiple readers, one writer
#include <atomic>

constexpr size_t N_EXCHANGES = static_cast<size_t>(ExchangeID::MAX_EXCHANGES);

class CrossExchangeAggregator {
public:
    // ── Write path — called from Node.js WS handlers ──────────────
    // These acquire a write lock (exclusive) for microseconds.

    void initSnapshot(
        ExchangeID ex,
        uint64_t update_id,
        const std::vector<std::pair<int64_t,double>>& bids,
        const std::vector<std::pair<int64_t,double>>& asks
    ) {
        std::unique_lock lock(rw_mutex_);
        books_[idx(ex)].applySnapshot(update_id, bids, asks);
        dirty_ = true;
    }

    void applyDelta(
        ExchangeID ex,
        uint64_t update_id,
        const std::vector<std::pair<int64_t,double>>& bid_deltas,
        const std::vector<std::pair<int64_t,double>>& ask_deltas
    ) {
        std::unique_lock lock(rw_mutex_);
        books_[idx(ex)].applyDelta(update_id, bid_deltas, ask_deltas);
        dirty_ = true;
    }

    void clearExchange(ExchangeID ex) {
        std::unique_lock lock(rw_mutex_);
        books_[idx(ex)] = ExchangeBook{};
        dirty_ = true;
    }

    // ── Read path — called from broadcast timer every 250ms ────────
    // Shared lock = multiple readers OK simultaneously.

    AggregatedSnapshot getAggregated(size_t levels = OUTPUT_LEVELS) const {
        std::shared_lock lock(rw_mutex_);

        // Merge all active exchange books into unified bid/ask maps
        // Using std::map here is fine — we call this only 4x/sec
        std::map<int64_t, double, std::greater<int64_t>> merged_bids;
        std::map<int64_t, double, std::less<int64_t>>    merged_asks;

        for (size_t i = 0; i < N_EXCHANGES; ++i) {
            const auto& book = books_[i];
            if (!book.initialized || book.isStale()) continue;

            // Merge bids
            Level buf[MAX_LEVELS];
            size_t n = book.bids.topN(buf, MAX_LEVELS);
            for (size_t j = 0; j < n; ++j) {
                merged_bids[buf[j].price_raw] += buf[j].qty;
            }

            // Merge asks
            n = book.asks.topN(buf, MAX_LEVELS);
            for (size_t j = 0; j < n; ++j) {
                merged_asks[buf[j].price_raw] += buf[j].qty;
            }
        }

        AggregatedSnapshot snap{};
        snap.timestamp_ms = currentMs();

        // Write top N into output arrays
        size_t bi = 0;
        for (auto& pair : merged_bids) {
            if (bi >= levels) break;
            snap.bids[bi++] = Level{ pair.first, pair.second };
        }
        snap.bid_count = bi;

        size_t ai = 0;
        for (auto& pair : merged_asks) {
            if (ai >= levels) break;
            snap.asks[ai++] = Level{ pair.first, pair.second };
        }
        snap.ask_count = ai;

        // BBO + spread
        snap.best_bid = bi > 0 ? snap.bids[0].price_f() : 0;
        snap.best_ask = ai > 0 ? snap.asks[0].price_f() : 0;
        snap.spread   = snap.best_ask - snap.best_bid;
        snap.mid_price = (snap.best_bid + snap.best_ask) / 2.0;

        // Wall detection
        WallDetector::detect(snap);

        return snap;
    }

    bool isDirty() const { return dirty_.load(); }
    void clearDirty()    { dirty_ = false; }

private:
    mutable std::shared_mutex rw_mutex_;
    std::array<ExchangeBook, N_EXCHANGES> books_;
    std::atomic<bool> dirty_{ false };

    static size_t idx(ExchangeID ex) { return static_cast<size_t>(ex); }
    static int64_t currentMs() {
        using namespace std::chrono;
        return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
    }
};
