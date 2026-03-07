---
phase: 9
plan: 1
wave: 1
depends_on: []
files_modified:
  - packages/server/src/adapters/gdelt.ts
  - packages/server/src/index.ts
  - packages/server/src/engines/signals/intelligence.ts
  - packages/web/src/App.tsx
  - packages/server/src/engines/analytics/options.ts
  - packages/server/src/engines/analytics/vwaf.ts
autonomous: true
user_setup: []

must_haves:
  truths:
    - "GDELT results are cached in Redis for 30 min"
    - "Intelligence snapshots are cached in Redis with an EX 600"
    - "Deduplicated switchSymbol in index.ts"
    - "recordArrive is called for both cache hits and misses in App.tsx"
    - "Daily candle TA is calculated only once per 60s"
---

# Plan 9.1: Pipeline Hardening & Correctness

<objective>
Stabilize the intelligence pipeline, restore usage profiling, and optimize high-frequency calculations.

Purpose: Solve v21 429 terminal errors and pre-warm decay.
Output: Hardened back-end and accurate client tracking.
</objective>

<tasks>

<task type="auto">
  <name>Hardening GDELT & Intelligence</name>
  <files>
    - packages/server/src/adapters/gdelt.ts
    - packages/server/src/index.ts
    - packages/server/src/engines/signals/intelligence.ts
  </files>
  <action>
    1. Add Redis caching and 429 backoff to `gdelt.ts`.
    2. Remove the duplicate `switchSymbol` call in `index.ts`.
    3. Modify `intelligence.ts:switchSymbol` to skip the slow-data refetch.
    4. Save snapshots to Redis in `intelligence.ts:computeAndBroadcast`.
  </action>
  <verify>Check terminal logs for GDELT 429 errors during multiple symbol switches.</verify>
  <done>Zero 429s from GDELT during switches.</done>
</task>

<task type="auto">
  <name>Restore recordArrive for Cache Hits</name>
  <files>packages/web/src/App.tsx</files>
  <action>
    Move the `recordArrive(sym, tf)` call before the early return for fresh cache hits in the `fetchHistorical` hook.
  </action>
  <verify>Check `UsageProfile` in IndexedDB (DevTools) after visiting a previously cached symbol.</verify>
  <done>Visits increment correctly on every load.</done>
</task>

<task type="auto">
  <name>Performance & Symbol Parameterization</name>
  <files>
    - packages/server/src/index.ts (TA update)
    - packages/server/src/engines/analytics/options.ts
    - packages/server/src/engines/analytics/vwaf.ts
  </files>
  <action>
    1. Move `marketState` TA calculation from the 4s interval to a separate 60s interval.
    2. Add `setSymbol()` to the snapshot engines and pass it during symbol switch.
    3. Replace hardcoded 'BTCUSDT' in their SQL inserts.
  </action>
  <verify>Check database rows for 'ETHUSDT' after switching symbol.</verify>
  <done>Accurate and efficient data capture for multiple symbols.</done>
</task>

</tasks>

<verification>
After all tasks:
- [ ] NO 429 Terminal Errors during rapid symbol switching.
- [ ] Intelligence panel loads immediately on new browser session.
- [ ] Usage profile visits increment.
</verification>
