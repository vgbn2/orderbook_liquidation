import { orderbookEngine } from '../dist/engines/signals/orderbook.js';

async function test() {
    console.log('--- Testing OrderbookEngine with Native Core ---');
    try {
        orderbookEngine.setSymbol('BTCUSDT');

        // 1. Initial Snapshot
        const snapshot = {
            lastUpdateId: 1000,
            bids: [['60000.5', '1.5'], ['59999.0', '10.0']],
            asks: [['60001.0', '2.0'], ['60002.5', '5.5']]
        };

        console.log('Initializing binance snapshot...');
        orderbookEngine.initSnapshot('binance', snapshot);

        // 2. Initializing another for and aggregate
        console.log('Initializing bybit snapshot...');
        orderbookEngine.initSnapshot('bybit', {
            lastUpdateId: 500,
            bids: [['60000.0', '5.0']],
            asks: [['60001.5', '3.0']]
        });

        // 3. Get Aggregated
        const aggregated = orderbookEngine.getAggregated();
        console.log('✅ Aggregated Result:', {
            best_bid: aggregated.best_bid,
            best_ask: aggregated.best_ask,
            mid: aggregated.mid_price,
            spread: aggregated.spread,
            bid_count: aggregated.bids.length,
            ask_count: aggregated.asks.length
        });

        if (aggregated.best_bid === 60000.5 && aggregated.best_ask === 60001.0) {
            console.log('🚀 NATIVE ORDERBOOK INTEGRATION SUCCESS');
        } else {
            console.log('❌ Aggregation mismatch, check price scaling or mapping');
            console.log('Got best_bid:', aggregated.best_bid, 'expected 60000.5');
            process.exit(1);
        }
    } catch (err) {
        console.error('❌ Test failed with error:');
        console.error(err);
        if (err.stack) console.error(err.stack);
        process.exit(1);
    }
}

test();
