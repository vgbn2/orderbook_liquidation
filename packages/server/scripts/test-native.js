import bindings from 'bindings';

const core = bindings('terminus_core');

console.log('--- Native Module Verification ---');
console.log('Metadata:', Object.keys(core));

// Test Gaussian (Normal) Helpers
const pdf = core.normalPdf(0);
const cdf = core.normalCdf(0);
console.log(`Gaussian: pdf(0)=${pdf.toFixed(4)}, cdf(0)=${cdf.toFixed(4)}`);
if (Math.abs(pdf - 0.3989) < 0.001 && Math.abs(cdf - 0.5) < 0.0001) {
    console.log('✅ Gaussian checks passed');
} else {
    console.log('❌ Gaussian checks failed');
}

// Test Kalman 1D
const input = new Float64Array([10, 11, 10, 9, 10, 11]);
const filtered = core.kalman1D(input, 1.0, 0.01);
console.log('Kalman Filtered:', filtered);
if (filtered.length === input.length) {
    console.log('✅ Kalman 1D output length matches');
}

// Test Orderbook structure (Aggregated Snapshot)
console.log('Testing GetAggregated...');
const snap = core.getAggregated();
console.log('Snapshot keys:', Object.keys(snap));
console.log('Snapshot best_bid:', snap.best_bid);
if (snap.hasOwnProperty('bids') && snap.hasOwnProperty('asks')) {
    console.log('✅ Aggregated structure valid');
}

console.log('--- DONE ---');
