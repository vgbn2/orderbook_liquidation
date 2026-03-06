## Phase 6 Decisions

**Date:** 2026-03-06

### Scope
- **Sentiment:** Implement Crypto Fear & Greed (API) and AAII (Manual/Scraper).
- **Macro:** Link FRED API for key economic indicators (GDP, Inflation).
- **TA:** 
  - Real-time: RSI, SMA (20/50/100), and A/D Volume logic.
  - HTF (High Timeframe): Monthly and Weekly RSI for macro-overbought/oversold context.
  - **Divergence:** Detection of RSI and Volume divergences vs Price.
- **Cross-Market Correlation:** 
  - Expand `MAX_ASSETS` to include Nasdaq (`^IXIC`), Gold (`GC=F`), **Crude Oil (`CL=F`)**, and BTC/ETH Beta.
  - Monitor correlation shifts (decoupling) as early-warning signals.
  - **Altcoin Season Index:** Calculate internally using Top 100 performance vs BTC.
- **Signal Duration:** 
  - Macro/Sentiment signals are "Regime" level (duration: 4–12 weeks).
  - TA/Confluence signals are "Execution" level (duration: 1–7 days).
- **Yield Calculation:** 
  - `Real Yield = 10Y Treasury Rate - CPI YoY`.
- **UI: EdgeFinder Dashboard:**
  - Implement a multi-symbol heat-map table (Score -10 to 10).
  - Categories: Technical, Sentiment (COT + F&G), Growth (GDP, PMI, Retail), Inflation (CPI, PPI), Jobs (NFP, Unemployment).

### Approach
- **Performance:** Use a "Cache-First" approach for slow-moving data (Macro/Sentiment). Fetch on server startup and refresh in background every 6-24 hours.
- **Stability:** All external API calls will be wrapped in try/catch with fallbacks to last known values to prevent "breaking anything" if service is down.
- **Engine:** Integrate these as "Signal Providers" into the existing `signals` engine architecture.

### Constraints
- **Speed:** No synchronous blocking calls during the main engine loop.
- **Data Integrity:** TA must use the same OHLCV source as the charts to ensure consistency.
