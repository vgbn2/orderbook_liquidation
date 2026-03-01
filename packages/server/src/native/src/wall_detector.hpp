#pragma once
#include "types.hpp"

// Detects disproportionately large levels — limit walls / iceberg orders.
// Runs on the aggregated snapshot in-place.

namespace WallDetector {
    constexpr double WALL_THRESHOLD_PCT = 0.03;  // level > 3% of total depth = wall

    inline void detect(AggregatedSnapshot& snap) {
        double total_bid_qty = 0, total_ask_qty = 0;
        for (size_t i = 0; i < snap.bid_count; ++i) total_bid_qty += snap.bids[i].qty;
        for (size_t i = 0; i < snap.ask_count; ++i) total_ask_qty += snap.asks[i].qty;

        snap.bid_wall_count = 0;
        snap.ask_wall_count = 0;

        if (total_bid_qty > 0) {
            for (size_t i = 0; i < snap.bid_count && snap.bid_wall_count < 8; ++i) {
                double pct = snap.bids[i].qty / total_bid_qty;
                if (pct >= WALL_THRESHOLD_PCT) {
                    snap.bid_walls[snap.bid_wall_count++] = Wall{
                        snap.bids[i].price_f(), snap.bids[i].qty, pct, true
                    };
                }
            }
        }

        if (total_ask_qty > 0) {
            for (size_t i = 0; i < snap.ask_count && snap.ask_wall_count < 8; ++i) {
                double pct = snap.asks[i].qty / total_ask_qty;
                if (pct >= WALL_THRESHOLD_PCT) {
                    snap.ask_walls[snap.ask_wall_count++] = Wall{
                        snap.asks[i].price_f(), snap.asks[i].qty, pct, false
                    };
                }
            }
        }
    }
}
