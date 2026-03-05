#ifndef RING_BUFFER_HPP
#define RING_BUFFER_HPP

#include <atomic>
#include <cstdint>
#include <vector>
#include <iostream>

/**
 * @brief Zero-Allocation Lock-Free SPSC Ring Buffer
 * Optimized for a single producer (Ingestor) and a single consumer (Risk/Matching Engine).
 */
template <typename T, size_t Size>
class RingBuffer {
    static_assert((Size & (Size - 1)) == 0, "Size must be a power of 2");

public:
    RingBuffer() : head(0), tail(0) {
        buffer.resize(Size);
    }

    // Producer side
    bool push(const T& item) {
        size_t h = head.load(std::memory_order_relaxed);
        size_t next_h = (h + 1) & (Size - 1);

        if (next_h == tail.load(std::memory_order_acquire)) {
            return false; // Buffer full
        }

        buffer[h] = item;
        head.store(next_h, std::memory_order_release);
        return true;
    }

    // Consumer side
    bool pop(T& item) {
        size_t t = tail.load(std::memory_order_relaxed);

        if (t == head.load(std::memory_order_acquire)) {
            return false; // Buffer empty
        }

        item = buffer[t];
        tail.store((t + 1) & (Size - 1), std::memory_order_release);
        return true;
    }

    bool empty() const {
        return head.load(std::memory_order_acquire) == tail.load(std::memory_order_acquire);
    }

private:
    std::vector<T> buffer;
    alignas(64) std::atomic<size_t> head;
    alignas(64) std::atomic<size_t> tail;
};

#endif // RING_BUFFER_HPP
