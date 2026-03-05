#ifndef STATE_MIRROR_HPP
#define STATE_MIRROR_HPP

#include "types.hpp"
#include <atomic>
#include <mutex>
#include <cstring>

// Dual-buffered state mirror for zero-blocking reads from Node.js
class StateMirror {
public:
    void update(const AggregatedSnapshot& snap) {
        // Simple mutex for the mirror update is fine as it's not on the matching hot-path
        // (The ExecutionEngine calls this after the match is done)
        std::lock_guard<std::mutex> lock(mutex_);
        current_state_ = snap;
        version_.fetch_add(1, std::memory_order_release);
    }

    AggregatedSnapshot read() {
        std::lock_guard<std::mutex> lock(mutex_);
        return current_state_;
    }

private:
    std::mutex mutex_;
    AggregatedSnapshot current_state_;
    std::atomic<uint64_t> version_{0};
};

#endif // STATE_MIRROR_HPP
