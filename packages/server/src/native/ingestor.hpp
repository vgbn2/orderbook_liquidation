#ifndef INGESTOR_HPP
#define INGESTOR_HPP

#include "types.hpp"
#include "ring_buffer.hpp"
#include "simdjson.h"
#include <string>
#include <iostream>

class MarketIngestor {
public:
    MarketIngestor(RingBuffer<RingBufferEvent, 65536>& rb) : ring_buffer(rb), dropped_count(0) {}

    // Called for every raw WebSocket message received
    void onRawMessage(ExchangeID origin, const char* data, size_t length) {
        simdjson::dom::parser parser;
        simdjson::dom::element doc;
        
        auto error = parser.parse(data, length).get(doc);
        if (error) return;

        switch (origin) {
            case ExchangeID::BINANCE:
                parseBinance(doc);
                break;
            case ExchangeID::BYBIT:
                parseBybit(doc);
                break;
            case ExchangeID::OKX:
                parseOKX(doc);
                break;
            case ExchangeID::HYPERLIQUID:
                parseHyperliquid(doc);
                break;
            case ExchangeID::GATE:
                parseGateio(doc);
                break;
            case ExchangeID::MEXC:
                parseMexc(doc);
                break;
            case ExchangeID::BITGET:
                parseBitget(doc);
                break;
            default:
                break;
        }
    }

private:
    void parseBinance(simdjson::dom::element& doc) {
        std::string_view event_type;
        if (!doc["e"].get(event_type)) {
            if (event_type == "depthUpdate") parseBinanceDepth(doc);
            else if (event_type == "trade") parseBinanceTrade(doc);
        }
    }

    void parseBybit(simdjson::dom::element& doc) {
        // Bybit V5: {"topic":"orderbook.50.BTCUSDT","type":"delta","data":{"b":[],"a":[]}}
        std::string_view topic;
        if (!doc["topic"].get(topic) && topic.find("orderbook") != std::string_view::npos) {
            auto data = doc["data"];
            processLevels(ExchangeID::BYBIT, data["b"], true, false);
            processLevels(ExchangeID::BYBIT, data["a"], false, false);
        }
    }

    void parseOKX(simdjson::dom::element& doc) {
        // OKX: {"arg":{"channel":"books","instId":"BTC-USDT-SWAP"},"action":"update","data":[{"bids":[],"asks":[]}]}
        std::string_view action;
        if (!doc["action"].get(action)) {
            for (auto item : doc["data"]) {
                processLevels(ExchangeID::OKX, item["bids"], true, action == "snapshot");
                processLevels(ExchangeID::OKX, item["asks"], false, action == "snapshot");
            }
        }
    }

    void parseHyperliquid(simdjson::dom::element& doc) {
        // HL: {"channel":"l2Book","data":{"levels":[ [ {"px":"...","sz":"..."} ], [...] ] }}
        auto data = doc["data"];
        auto levels = data["levels"];
        // HL levels is [bids, asks]
        processHLLevels(ExchangeID::HYPERLIQUID, levels.at(0), true);
        processHLLevels(ExchangeID::HYPERLIQUID, levels.at(1), false);
    }

    void parseGateio(simdjson::dom::element& doc) {
        // Gate.io: {"channel":"spot.order_book","event":"update","result":{"bids":[],"asks":[]}}
        std::string_view channel;
        if (!doc["channel"].get(channel) && channel == "spot.order_book") {
            auto result = doc["result"];
            processLevels(ExchangeID::GATE, result["bids"], true, true);
            processLevels(ExchangeID::GATE, result["asks"], false, true);
        }
    }

    void parseMexc(simdjson::dom::element& doc) {
        // MEXC: {"c":"spot@public.limit.depth.v3.api@BTCUSDT@50","d":{"bids":[],"asks":[]}}
        auto data = doc["d"];
        processLevels(ExchangeID::MEXC, data["bids"], true, true);
        processLevels(ExchangeID::MEXC, data["asks"], false, true);
    }

    void parseBitget(simdjson::dom::element& doc) {
        // Bitget: {"channel":"books50","action":"snapshot","data":[{"bids":[],"asks":[]}]}
        std::string_view action;
        if (!doc["action"].get(action)) {
            for (auto item : doc["data"]) {
                processLevels(ExchangeID::BITGET, item["bids"], true, action == "snapshot");
                processLevels(ExchangeID::BITGET, item["asks"], false, action == "snapshot");
            }
        }
    }

    void processLevels(ExchangeID ex, simdjson::dom::array arr, bool is_bid, bool is_snapshot) {
        for (auto entry : arr) {
            double price, qty;
            std::string_view p_str, q_str;
            if (entry.at(0).get(p_str) || entry.at(1).get(q_str)) continue;
            
            simdjson::active_implementation->fast_parse_float(p_str.data(), p_str.data() + p_str.size(), price);
            simdjson::active_implementation->fast_parse_float(q_str.data(), q_str.data() + q_str.size(), qty);
            
            pushUpdate(ex, price, qty, is_bid, is_snapshot);
        }
    }

    void processHLLevels(ExchangeID ex, simdjson::dom::array arr, bool is_bid) {
        for (auto entry : arr) {
            double price, qty;
            std::string_view p_str, q_str;
            if (entry["px"].get(p_str) || entry["sz"].get(q_str)) continue;
            
            simdjson::active_implementation->fast_parse_float(p_str.data(), p_str.data() + p_str.size(), price);
            simdjson::active_implementation->fast_parse_float(q_str.data(), q_str.data() + q_str.size(), qty);
            
            pushUpdate(ex, price, qty, is_bid, false);
        }
    }

    void pushUpdate(ExchangeID ex, double p, double q, bool is_bid, bool is_snap) {
        RingBufferEvent ev;
        ev.type = EventType::MARKET_UPDATE;
        ev.payload.market.source = ex;
        ev.payload.market.price = static_cast<int64_t>(p * PRICE_SCALE);
        ev.payload.market.quantity = q;
        ev.payload.market.is_bid = is_bid;
        ev.payload.market.is_snapshot = is_snap;
        ev.payload.market.timestamp = 0; // Will be set by engine

        if (!ring_buffer.push(ev)) dropped_count++;
    }

    void parseBinanceDepth(simdjson::dom::element& doc) {
        processLevels(ExchangeID::BINANCE, doc["b"], true, false);
        processLevels(ExchangeID::BINANCE, doc["a"], false, false);
    }

    void parseBinanceTrade(simdjson::dom::element& doc) {
        // Binance Trade: {"e":"trade","E":1625... "p":"123.4", "q":"1.0", "m":true}
        double price, qty;
        std::string_view p_str, q_str;
        if (doc["p"].get(p_str) || doc["q"].get(q_str)) return;

        simdjson::active_implementation->fast_parse_float(p_str.data(), p_str.data() + p_str.size(), price);
        simdjson::active_implementation->fast_parse_float(q_str.data(), q_str.data() + q_str.size(), qty);

        bool is_sell = false;
        doc["m"].get(is_sell); // m: true means buyer is market maker -> sell

        RingBufferEvent ev;
        ev.type = EventType::TRADE;
        ev.payload.market.price = static_cast<int64_t>(price * PRICE_SCALE);
        ev.payload.market.qty = qty;
        ev.payload.market.source = ExchangeID::BINANCE;
        ev.payload.market.is_bid = !is_sell; // buy if not sell
        
        if (!ring_buffer.push(ev)) dropped_count++;
    }

    RingBuffer<RingBufferEvent, 65536>& ring_buffer;
    uint64_t dropped_count;
    uint64_t log_threshold = 1000;
};

#endif // INGESTOR_HPP