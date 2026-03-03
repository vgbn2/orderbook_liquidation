#ifndef EXECUTION_ENGINE_HPP
#define EXECUTION_ENGINE_HPP

#include "types.hpp"
#include "ring_buffer.hpp"
#include "risk_engine.hpp"
#include "aggregator.hpp"
#include "state_mirror.hpp"
#include <thread>
#include <atomic>
#include <immintrin.h> // Required for _mm_pause()
#include <chrono>

class ExecutionEngine {
public:
    ExecutionEngine(RingBuffer<RingBufferEvent, 65536>& rb, CrossExchangeAggregator& agg, StateMirror& mirror)
        : ring_buffer(rb), aggregator(agg), state_mirror(mirror), risk_engine(rb), running(false) {}

    void start() {
        if (running) return;
        running = true;
        exec_thread = std::thread(&ExecutionEngine::run, this);
    }

    void stop() {
        running = false;
        if (exec_thread.joinable()) {
            exec_thread.join();
        }
    }

private:
    void run() {
        RingBufferEvent event;
        auto last_mirror_update = std::chrono::steady_clock::now();
        
        while (running) {
            if (ring_buffer.pop(event)) {
                processEvent(event);
                
                // Throttled Mirror Update (60Hz) to prevent UI/Bridge starvation
                auto now = std::chrono::steady_clock::now();
                if (std::chrono::duration_cast<std::chrono::milliseconds>(now - last_mirror_update).count() > 16) {
                    state_mirror.update(aggregator.getAggregated());
                    last_mirror_update = now;
                }
            } else {
                // Fix 1: Spinlock Death
                // _mm_pause() tells the CPU this is a busy-wait loop, 
                // preventing thermal throttling and core starvation.
                _mm_pause();
            }
        }
    }

    void processEvent(const RingBufferEvent& event) {
        switch (event.type) {
            case EventType::MARKET_UPDATE:
                // Fix: Implement missing MARKET_UPDATE logic
                aggregator.processUpdate(event.payload.market);
                break;
            
            case EventType::ORACLE_TICK:
                risk_engine.onEvent(event);
                break;

            case EventType::LIQUIDATION:
                handleLiquidation(event.payload.order);
                break;

            case EventType::USER_ORDER:
            case EventType::CANCEL_ORDER:
                risk_engine.onEvent(event);
                break;
        }
    }

    void handleLiquidation(const OrderPayload& liq) {
        // Execute against the best exchange book (simplified)
        // In a real system, we match against the aggregated book or smart-route
        
        // This is where matching happens aggressively
        // aggregator.matchAggressive(liq.quantity, liq.is_buy);
    }

    RingBuffer<RingBufferEvent, 65536>& ring_buffer;
    CrossExchangeAggregator& aggregator;
    StateMirror& state_mirror;
    RiskEngine risk_engine;
    std::atomic<bool> running;
    std::thread exec_thread;
};

#endif // EXECUTION_ENGINE_HPP
