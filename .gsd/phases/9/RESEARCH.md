---
phase: 9
level: 1
researched_at: 2026-03-07
---

# Phase 9 Research: Pipeline Hardening & Correctness

## Questions Investigated
1. **GDELT 429**: What combination is triggering the rate limit in the terminal?
2. **Intelligence Persistence**: Why do new clients see a blank intelligence panel?
3. **Usage Profile Decay**: Why has the pre-warming system stopped recording visits?
4. **Computation Efficiency**: Is the 4-second TA update interval excessive?

## Findings

### 1. GDELT 429 Race Condition
- **Cause A**: `index.ts` triggers `switchSymbol` twice in rapid succession on a single user action.
- **Cause B**: GDELT adapter lacks persistent caching (Redis), causing immediate fetch on every server restart.
- **Cause C**: Global data (GDELT/FRED) is being refetched for every symbol switch (BTC -> ETH), burning rate limits for non-symbol-specific data.
- **Recommendation**: Deduplicate calls in `index.ts`, add Redis caching to `gdelt.ts`, and suppress slow-data refetching on symbol switches in `intelligence.ts`.

### 2. Intelligence Snapshot Visibility
- **Finding**: `SignalIntelligenceEngine` broadcasts but never saves the final snapshot to Redis. 
- **Effect**: New WebSocket clients remain blank until the next 5-minute compute cycle.
- **Recommendation**: Write the snapshot to Redis before broadcasting.

### 3. Pre-Warm Logic Regression
- **Finding**: Refactoring in v21 moved `recordArrive` behind an early return in `App.tsx`.
- **Effect**: Visits are no longer recorded for existing (non-stale) cache hits, causing pre-warm scores to decay.
- **Recommendation**: Move `recordArrive` before the early return in the cache-hit path.

### 4. Technical Analysis & DB Consistency
- **TA Churn**: Running full RSI/divergence/SMA calculations every 4 seconds for daily candles is redundant.
- **Data Corruption**: `options.ts` and `vwaf.ts` hardcode `'BTCUSDT'` in DB inserts, causing issues when switching symbols.
- **Recommendation**: Decouple TA updates to a 60s interval and parameterize symbol fields in all snapshot engines.

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| GDELT Fix | Dual Layer Cache | Redis for persistence, in-memory for same-session dedup. |
| TA Frequency | 60s Interval | Daily candles don't move fast enough to justify 4s CPU churn. |
| Symbol Handling | `setSymbol()` | Required for accurate DB historicals across multiple assets. |

## Ready for Planning
- [x] v21 report analyzed
- [x] Fix priorities established
- [x] Exact code patches identified
