---
phase: 7
plan: 2
wave: 2
depends_on: ["PLAN-1"]
files_modified:
  - packages/web/src/App.tsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Chart loads instantly from cache if data exists"
    - "Background gap-fill silently updates stale cache"
    - "Timeframe and symbol changes record usage profiling metrics"
    - "App idle triggers pre-warming of likely next symbol/timeframe"
  artifacts:
    - "fetchHistorical in App.tsx implements cache-first logic"
    - "useEffect hooks in App.tsx call startObservation and startPrewarm"
---

# Plan 7.2: Frontend Cache Integration & Pre-warming

<objective>
Wire up the newly created `candleCache`, `usageProfile`, and `preWarm` libraries into the main `App.tsx` state management.

Purpose: To eliminate the 2-3 second black screen on load/switch and proactively fetch data the user is likely to need.
Output: A seamless, instant-loading chart experience.
</objective>

<context>
Load for context:
- `packages/web/src/App.tsx` (Focus on `fetchHistorical` and lifecycle `useEffects`)
- `packages/web/src/lib/candleCache.ts` (Outline only: `getCachedCandles`, `saveCandles`, `mergeGapCandles`)
- `packages/web/src/lib/usageProfile.ts` (Outline only: `recordArrive`, `recordLeave`, `startObservation`)
- `packages/web/src/lib/preWarm.ts` (Outline only: `startPrewarm`)
</context>

<tasks>

<task type="auto">
  <name>Implement Cache-First fetchHistorical</name>
  <files>packages/web/src/App.tsx</files>
  <action>
    Rewrite `fetchHistorical` to:
    1. Call `getCachedCandles(sym, tf)`.
    2. If `fromCache !== 'none'`, immediately `setCandles` and `setLoading(false)`, then `recordArrive`.
    3. If `stale` is true, trigger a background fetch to `/api/ohlcv?since=...`. On success, apply `mergeGapCandles` and update state silently.
    4. If no cache, fallback to old logic limit=2000, `saveCandles`, and `recordArrive`.
    AVOID: Blocking the UI thread during IndexedDB reads. Make sure loading state is cleared as soon as cache hits.
  </action>
  <verify>Visual code review of fetchHistorical logic flow.</verify>
  <done>fetchHistorical uses cache efficiently without breaking fallback.</done>
</task>

<task type="auto">
  <name>Wire Usage Profiling & Pre-warming Hooks</name>
  <files>packages/web/src/App.tsx</files>
  <action>
    1. Update the symbol/timeframe change handlers to call `recordLeave(oldSym, oldTf)` before setting new states.
    2. Add a `useEffect` on mount `[]` that calls `startObservation((ranked) => startPrewarm(ranked))`.
    AVOID: Creating memory leaks or infinite re-renders. Only mount observation once.
  </action>
  <verify>Observation starts on mount.</verify>
  <done>Hooks accurately track arrive/leave and trigger pre-warm on idle.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] `fetchHistorical` checks cache before network.
- [ ] Gap-fill network request is made if cache is stale.
- [ ] `startObservation` runs once.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
