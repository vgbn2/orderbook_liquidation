#pragma once
#include "types.hpp"
#include <algorithm>
#include <mutex>
#include <vector>
#include <chrono>
#include <array>

// ── OrderbookSide ─────────────────────────────────────────────
// One side (bid or ask) of a single exchange's orderbook.
// Backed by std::map<int64_t, double> for automatic sorted order.
// Bids: map ordered high→low (use std::greater as comparator)
// Asks: map ordered low→high (default)

template<typename Comparator>
class OrderbookSide {
public:
    OrderbookSide() {
        levels_.fill(Level{0, 0.0});
    }

    // Apply a single delta. qty=0 → remove the level.
    // Returns true if the best price changed (triggers BBO update).
    bool applyDelta(int64_t price_raw, double qty) {
        if (qty == 0.0 || qty < 1e-12) {
            return removeLevel(price_raw);
        } else {
            return upsertLevel(price_raw, qty);
        }
    }

    // Replace entire side from snapshot (REST seed).
    void applySnapshot(const std::vector<std::pair<int64_t, double>>& data) {
        count_ = 0;
        for (const auto& pair : data) {
            if (pair.second > 1e-12 && count_ < MAX_LEVELS) {
                levels_[count_++] = Level{pair.first, pair.second};
            }
        }
        // Ensure sorted initially
        std::sort(levels_.begin(), levels_.begin() + count_, 
                 [](const Level& a, const Level& b) { return Comparator()(a.price, b.price); });
        
        last_best_ = count_ > 0 ? levels_[0].price : 0;
    }

    // Copy top N levels into output array. Returns count written.
    size_t topN(Level* out, size_t n) const {
        size_t to_copy = std::min(count_, n);
        std::copy(levels_.begin(), levels_.begin() + to_copy, out);
        return to_copy;
    }

    double totalQty() const {
        double sum = 0;
        for (size_t i = 0; i < count_; ++i) sum += levels_[i].qty;
        return sum;
    }

    int64_t bestPrice() const {
        return count_ > 0 ? levels_[0].price : 0;
    }

    bool empty() const { return count_ == 0; }
    size_t size() const { return count_; }

private:
    static constexpr size_t MAX_LEVELS = 500;
    std::array<Level, MAX_LEVELS> levels_;
    size_t count_ = 0;
    int64_t last_best_ = 0;

    bool removeLevel(int64_t price) {
        for (size_t i = 0; i < count_; ++i) {
            if (levels_[i].price == price) {
                // Shift everything left
                std::move(levels_.begin() + i + 1, levels_.begin() + count_, levels_.begin() + i);
                count_--;
                
                int64_t new_best = count_ > 0 ? levels_[0].price : 0;
                bool changed = (new_best != last_best_);
                last_best_ = new_best;
                return changed;
            }
            if (Comparator()(price, levels_[i].price)) break; // Passed where it should be
        }
        return false;
    }

    bool upsertLevel(int64_t price, double qty) {
        for (size_t i = 0; i < count_; ++i) {
            if (levels_[i].price == price) {
                levels_[i].qty = qty; // Update existing
                return false;         // Best price doesn't change on simply updating qty
            }
            if (Comparator()(price, levels_[i].price)) {
                // Insert here, shift right
                if (count_ < MAX_LEVELS) {
                    std::move_backward(levels_.begin() + i, levels_.begin() + count_, levels_.begin() + count_ + 1);
                    count_++;
                } else if (i < MAX_LEVELS) {
                    // Drops worst price if full
                    std::move_backward(levels_.begin() + i, levels_.begin() + MAX_LEVELS - 1, levels_.begin() + MAX_LEVELS);
                } else {
                    return false; // Fits past MAX_LEVELS, ignore
                }
                
                levels_[i] = Level{price, qty};
                int64_t new_best = count_ > 0 ? levels_[0].price : 0;
                bool changed = (new_best != last_best_);
                last_best_ = new_best;
                return changed;
            }
        }
        
        // Append if room
        if (count_ < MAX_LEVELS) {
            levels_[count_++] = Level{price, qty};
            int64_t new_best = levels_[0].price;
            bool changed = (new_best != last_best_);
            last_best_ = new_best;
            return changed;
        }
        return false;
    }
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
