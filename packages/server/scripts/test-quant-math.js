import { computeQuantAnalytics } from '../dist/engines/analytics/quantMath.js';
import { logger } from '../dist/logger.js';

async function test() {
    const symbol = 'BTCUSDT';
    const prices = Array.from({ length: 100 }, (_, i) => 60000 + Math.sin(i / 5) * 1000 + i * 10);
    const dates = prices.map((_, i) => new Date(Date.now() - (100 - i) * 24 * 3600 * 1000).toISOString());
    const macroPrices = {
        'DXY': Array.from({ length: 100 }, (_, i) => 100 + Math.cos(i / 10) * 2),
        'SPY': Array.from({ length: 100 }, (_, i) => 450 + i * 0.5)
    };

    console.log('--- Testing Quant Analytics with Native Math ---');
    try {
        const result = computeQuantAnalytics(symbol, prices, dates, macroPrices);

        console.log('✅ Result keys:', Object.keys(result));
        console.log('✅ Kalman smoothed first 5:', result.kalman.slice(0, 5));
        console.log('✅ Projections horizon 14:', result.projections.length);
        console.log('✅ Quantiles p50:', result.quantiles.p50.price.toFixed(2));
        console.log('✅ Macro Breakdown (Native Correlation):', result.macroBreakdown);

        if (result.kalman.length === prices.length && result.projections.length === 14) {
            console.log('🚀 ALL QUANT MATH TESTS PASSED (NATIVE)');
        }
    } catch (err) {
        console.error('❌ Quant Analytics failed:', err);
        process.exit(1);
    }
}

test();
