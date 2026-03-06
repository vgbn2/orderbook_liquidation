---
phase: 6
level: 3
researched_at: 2026-03-06
---

# Phase 6 Research: Multi-Factor Signal Intelligence

## Questions Investigated
1. **Source for Crypto Fear & Greed Index?**
   - **Finding:** Alternative.me provides a robust, free API (`https://api.alternative.me/fng/`). It returns a value (0-100), classification (Fear/Greed), and timestamp.
2. **Source for AAII Investor Sentiment?**
   - **Finding:** No direct public API. **Alternative:** Use the **Altcoin Season Index** logic as a proxy for "Retail Mania" and **Alternative.me Fear & Greed** as a proxy for "Market Fear."
   - **Custom Logic:** Implement an `AltcoinSeasonEngine` that calculates performance of Top 100 coins vs BTC over a 90-day window. If >75% outperform BTC, it's Altcoin Season.
3. **Source for Macro/Economic Data?**
   - **Finding:** **FRED API** (St. Louis Fed) is the most reliable for GDP, inflation, and employment. **NewsAPI** can provide the qualitative "catalyst" context.
4. **Calculations for Advanced TA?**
   - **RSI:** Standard 14-period calculation. Needs to be implemented in a rolling window.
   - **SMA (20, 50, 100):** Simple rolling averages.
   - **Accumulation/Distribution:** Use **Money Flow Volume** formula: `[(Close-Low)-(High-Close)] / (High-Low) * Volume`. This detects if volume is backing price movement or if it's "weak" distribution.

## Decisions Made
| Stablecoin Divergence | DefiLlama + CoinGecko | Detects fresh capital vs leverage-driven rallies. |
| Altcoin Season | Internal Logic (Top 100 vs BTC) | Custom implementation using CoinGecko free data. |
| Crypto Sentiment | Alternative.me API | Free, reliable, and widely used in the industry. |
| Economic Baseline | FRED API | Provides authoritative, historical data for fundamental context. |
| RSI/SMA Engine | Custom TypeScript util | Lightweight and integrates directly with our `marketDataStore`. |
| Risk Analysis | Downside/Upside Ratio | Comparing ATR-based risk vs nearest historical liquidity pool. |

## Patterns to Follow
- **Signal Weighting:** Use a weighted average of TA (40%), Sentiment (30%), and Macro (30%) to produce a final "Decision Grade".
- **Real-time vs Interval:** TA should be real-time; Macro/Sentiment can be fetched on much longer intervals (hourly/daily).

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
