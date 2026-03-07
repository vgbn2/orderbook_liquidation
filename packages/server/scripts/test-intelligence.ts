import { signalIntelligenceEngine } from '../src/engines/signals/intelligence.js';
import { alternativeMeAdapter } from '../src/adapters/alternative-me.js';
import { fredAdapter } from '../src/adapters/fred.js';
import { marketCapAdapter } from '../src/adapters/market-cap.js';
import { binanceAdapter } from '../src/adapters/binance.js';

// Mock adapters
(alternativeMeAdapter as any).getLastData = () => ({
    value: 45,
    classification: 'Neutral',
    contrarianBias: 0.1
});

(fredAdapter as any).getLastSnapshot = () => ({
    realYield: 1.5,
    yieldSpread: 0.2,
    creditSpread: 95,
    indicators: [
        { seriesId: 'CPILFESL', label: 'Core CPI', category: 'inflation', value: 3.8, bias: 'neutral', change: 0.01 },
        { seriesId: 'PAYEMS', label: 'Non-Farm Payrolls', category: 'jobs', value: 275000, bias: 'bullish', change: 0.05 },
        { seriesId: 'BAMLC0A0CM', label: 'IG Credit Spread', category: 'credit', value: 95, bias: 'bullish', change: -0.02 }
    ],
    overallBias: 'bullish'
});

(marketCapAdapter as any).getLastMarketCap = () => ({
    btcDominance: 52.5,
    divergenceRatio: 12.4,
    stablecoinMarketCap: 140000000000
});

(marketCapAdapter as any).getLastAltcoinIndex = () => ({
    index: 35
});

(binanceAdapter as any).fetchKlines = async () => {
    // Return dummy candles for TA
    return Array(200).fill(0).map((_, i) => ({
        time: Date.now() - i * 86400000,
        open: 50000, high: 51000, low: 49000, close: 50500, volume: 1000,
        exchange: 'binance'
    }));
};

async function testMapping() {
    console.log('--- Testing Intelligence Mapping ---');

    // Trigger compute
    // We need to bypass the private access or use the public method if we can.
    // computeAndBroadcast is private, but switchSymbol triggers it.
    await signalIntelligenceEngine.switchSymbol('BTCUSDT');

    const snapshot = signalIntelligenceEngine.getLastSnapshot();
    if (!snapshot) {
        console.error('FAIL: No snapshot computed');
        process.exit(1);
    }

    console.log('Snapshot Overall Score:', snapshot.overallScore);
    console.log('Snapshot Overall Bias:', snapshot.overallBias);

    const cats = snapshot.categories;
    const catMap = cats.reduce((acc: any, c: any) => {
        acc[c.name] = c.details;
        return acc;
    }, {});

    const expectedKeys: Record<string, string[]> = {
        'Sentiment': ['fearGreedValue', 'fearGreedHeading', 'altcoinSeasonIndex'],
        'Macro': ['realYield', 'yieldSpread', 'creditSpread', 'indicators'],
        'Market Structure': ['btcDominance', 'stablecoinDivergence'],
        'Technical': ['rsi', 'htfRsi', 'smaAlignment']
    };

    let failed = false;
    for (const [catName, keys] of Object.entries(expectedKeys)) {
        console.log(`\nChecking category: ${catName}`);
        const details = catMap[catName];
        if (!details) {
            console.error(`  FAIL: Missing category ${catName}`);
            failed = true;
            continue;
        }

        for (const key of keys) {
            if (details[key] === undefined) {
                console.error(`  FAIL: Missing key "${key}" in ${catName}`);
                failed = true;
            } else {
                console.log(`  PASS: Key "${key}" =`, details[key]);
            }
        }
    }

    if (failed) {
        console.error('\nVERIFICATION FAILED');
        process.exit(1);
    } else {
        console.log('\nVERIFICATION PASSED');
        process.exit(0);
    }
}

testMapping().catch(err => {
    console.error(err);
    process.exit(1);
});
