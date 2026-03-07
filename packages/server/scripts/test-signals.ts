import 'dotenv/config';
import { fredAdapter } from '../src/adapters/fred.js';
import { finnhubAdapter } from '../src/adapters/finnhub.js';
import { gdeltAdapter } from '../src/adapters/gdelt.js';
import { geminiAdapter } from '../src/adapters/gemini.js';
import { signalIntelligenceEngine } from '../src/engines/signals/intelligence.js';

async function runVerification() {
    console.log('─── Signal Intelligence Pipeline Verification ───\n');

    try {
        console.log('1. Testing Finnhub Forecasts...');
        const forecasts = await finnhubAdapter.fetchForecasts();
        console.log(`   - Retrieved ${forecasts.size} forecasted indicators.`);

        console.log('\n2. Testing FRED Macro Engine & Surprise Meter...');
        const fredData = await fredAdapter.fetch();
        if (!fredData) throw new Error('FRED Data missing');
        console.log(`   - Overall Bias:      ${fredData.overallBias}`);
        console.log(`   - Macro Score:       ${fredData.overallScore}`);
        console.log(`   - Surprise Score:    ${fredData.macroSurpriseScore}`);
        console.log(`   - Real Yield:        ${fredData.realYield}%`);

        console.log('\n3. Testing GDELT News Aggregation...');
        const news = await gdeltAdapter.fetchGlobalRiskNews();
        console.log(`   - Retrieved ${news.length} risk-related headlines.`);

        console.log('\n4. Testing Gemini AI Risk Analysis...');
        const aiAnalysis = await geminiAdapter.analyzeGeopolitics(news);
        if (!aiAnalysis) throw new Error('AI Analysis missing');
        console.log(`   - Risk Score:   ${aiAnalysis.riskScore}/10`);
        console.log(`   - AI Summary:   ${aiAnalysis.summary}`);

        console.log('\n5. Testing Central Signal Engine...');
        // Mock market state
        (global as any).marketState = {
            orderbook: { totalBids: 1500, totalAsks: 1000 },
            technicals: { trend: { daily: 'bullish', weekly: 'bullish' }, htfRSI: { weekly: 60, monthly: 55 } },
            liquidations: { longsVsshortsRatio: 1.2 }
        };

        // Force fetch via private method for test
        await (signalIntelligenceEngine as any).fetchSlowData();
        console.log('   - Slow data injected into engine.');

        console.log('\n✨ Verification Successful!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Verification failed:', err);
        process.exit(1);
    }
}

runVerification();
