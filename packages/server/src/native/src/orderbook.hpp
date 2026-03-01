#pragma once
#include "types.hpp"
#include <map>          // std::map = Red-Black Tree — O(log n) insert/delete/find
#include <mutex>
#include <vector>
#include <chrono>

// ── OrderbookSide ─────────────────────────────────────────────
// One side (bid or ask) of a single exchange's orderbook.
// Backed by std::map<int64_t, double> for automatic sorted order.
// Bids: map ordered high→low (use std::greater as comparator)
// Asks: map ordered low→high (default)

template<typename Comparator>
class OrderbookSide {
public:
    // Apply a single delta. qty=0 → remove the level.
    // Returns true if the best price changed (triggers BBO update).
    bool applyDelta(int64_t price_raw, double qty) {
        if (qty == 0.0 || qty < 1e-12) {
            levels_.erase(price_raw);
        } else {
            levels_[price_raw] = qty;
        }
        return !levels_.empty()
            ? levels_.begin()->first != last_best_
            : last_best_ != 0;
    }

    // Replace entire side from snapshot (REST seed).
    void applySnapshot(const std::vector<std::pair<int64_t, double>>& data) {
        levels_.clear();
        for (const auto& pair : data) {
            if (pair.second > 1e-12) levels_[pair.first] = pair.second;
        }
        last_best_ = levels_.empty() ? 0 : levels_.begin()->first;
    }

    // Copy top N levels into output array. Returns count written.
    size_t topN(Level* out, size_t n) const {
        size_t count = 0;
        for (auto it = levels_.begin(); it != levels_.end() && count < n; ++it, ++count) {
            out[count] = Level{ it->first, it->second };
        }
        return count;
    }

    double totalQty() const {
        double sum = 0;
        for (const auto& pair : levels_) sum += pair.second;
        return sum;
    }

    int64_t bestPrice() const {
        return levels_.empty() ? 0 : levels_.begin()->first;
    }

    bool empty() const { return levels_.empty(); }
    size_t size() const { return levels_.size(); }

private:
    std::map<int64_t, double, Comparator> levels_;
    int64_t last_best_ = 0;
};

using BidSide = OrderbookSide<std::greater<int64_t>>;   // high → low
using AskSide = OrderbookSide<std::less<int64_t>>;      // low  → high


// ── ExchangeBook ──────────────────────────────────────────────
// Complete book for one exchange — bids + asks + metadata.
struct ExchangeBook {
    BidSide   bids;
    AskSide   asks;
    uint64_t  last_update_id = 0;
    bool      initialized    = false;
    int64_t   last_seen_ms   = 0;

    void applySnapshot(
        uint64_t update_id,
        const std::vector<std::pair<int64_t,double>>& bid_data,
        const std::vector<std::pair<int64_t,double>>& ask_data
    ) {
        last_update_id = update_id;
        initialized = true;
        bids.applySnapshot(bid_data);
        asks.applySnapshot(ask_data);
        last_seen_ms = currentMs();
    }

    void applyDelta(
        uint64_t update_id,
        const std::vector<std::pair<int64_t,double>>& bid_deltas,
        const std::vector<std::pair<int64_t,double>>& ask_deltas
    ) {
        if (!initialized) return;
        // Ignore stale deltas (sequence gap detection)
        if (update_id != 0 && update_id <= last_update_id) return;

        for (const auto& pair : bid_deltas) bids.applyDelta(pair.first, pair.second);
        for (const auto& pair : ask_deltas) asks.applyDelta(pair.first, pair.second);
        if (update_id != 0) last_update_id = update_id;
        last_seen_ms = currentMs();
    }

    bool isStale() const {
        // Mark exchange as stale if no update in 5 seconds
        return initialized && (currentMs() - last_seen_ms) > 5000;
    }

private:
    static int64_t currentMs() {
        using namespace std::chrono;
        return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
    }
};
