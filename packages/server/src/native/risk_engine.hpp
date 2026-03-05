#ifndef RISK_ENGINE_HPP
#define RISK_ENGINE_HPP

#include "types.hpp"
#include "ring_buffer.hpp"
#include <vector>
#include <cmath>

class RiskEngine {
public:
    static constexpr size_t MAX_ACCOUNTS = 10000;

    RiskEngine(RingBuffer<RingBufferEvent, 65536>& rb) : ring_buffer(rb) {
        // Pre-allocate accounts
        accounts.reserve(MAX_ACCOUNTS);
    }

    void onEvent(const RingBufferEvent& event) {
        if (event.type == EventType::ORACLE_TICK) {
            checkAllPositions(event.payload.oracle.price);
        } else if (event.type == EventType::USER_ORDER) {
            handleUserOrder(event.payload.order);
        }
    }

    void handleUserOrder(const OrderPayload& order) {
        // Find or create account (simplified for demo)
        // In a real system, this would use a fast hash map or direct indexing
        for (auto& acc : accounts) {
            if (acc.account_id == order.account_id) {
                // Update position (simplified)
                if (order.is_buy) {
                    acc.position_size += order.quantity;
                } else {
                    acc.position_size -= order.quantity;
                }
                return;
            }
        }
        
        // New account
        Account new_acc;
        new_acc.account_id = order.account_id;
        new_acc.wallet_balance = 1000000; // $10,000 initial (scaled)
        new_acc.position_size = order.is_buy ? order.quantity : -order.quantity;
        new_acc.maintenance_margin_bps = 50; // 0.5%
        new_acc.is_frozen = false;
        accounts.push_back(new_acc);
    }

private:
    void checkAllPositions(int64_t mark_price) {
        for (auto& acc : accounts) {
            if (acc.position_size == 0 || acc.is_frozen) continue;

            // equity = wallet_balance + unrealized_pnl
            // upnl = (mark_price - entry_price) * position_size
            int64_t upnl = (mark_price - acc.entry_price) * acc.position_size;
            int64_t equity = acc.wallet_balance + upnl;
            
            int64_t position_notional = std::abs(acc.position_size * mark_price);
            int64_t maintenance_margin = (position_notional * acc.maintenance_margin_bps) / 10000;

            if (equity <= maintenance_margin) {
                triggerLiquidation(acc);
            }
        }
    }

    void triggerLiquidation(Account& acc) {
        acc.is_frozen = true;

        RingBufferEvent liq_event;
        liq_event.type = EventType::LIQUIDATION;
        liq_event.payload.order.account_id = acc.account_id;
        liq_event.payload.order.quantity = std::abs(acc.position_size);
        liq_event.payload.order.is_buy = (acc.position_size < 0);
        liq_event.payload.order.is_liquidation = true;
        
        // Push back into ring buffer for matching engine
        ring_buffer.push(liq_event);
    }

    std::vector<Account> accounts; // In production, use alignas(64) array
    RingBuffer<RingBufferEvent, 65536>& ring_buffer;
};

#endif // RISK_ENGINE_HPP
