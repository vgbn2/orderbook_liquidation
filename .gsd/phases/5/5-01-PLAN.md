---
phase: 5
plan: fix-timeframe-switching
wave: 1
gap_closure: true
---

# Fix: Timeframe Switching & Candle Loading

## Problem
The TODO.md file explicitly notes "Fix timeframe switching medium". Timeframe switching is broken, which also means that candle data is either not reloading correctly or not being fetched based on the timeframe context.

## Root Cause
The `useCandleStore` manages the `timeframe` and `symbol` states, but the active data-fetching mechanism in `Chart.tsx` or its surrounding components fails to react properly to these state changes to seamlessly swap out the `unique` candles array or the `activeIndicators`.

## Tasks

<task type="auto">
  <name>Fix timeframe switching logic</name>
  <files>src/stores/candleStore.ts, src/components/chart/Chart.tsx</files>
  <action>
    Investigate the specific issue causing timeframe switches to fail. 
    Ensure `candleStore` properly clears/updates the primary `candles` array when `setTimeframe` is called.
    Ensure `Chart.tsx` explicitly watches for `timeframe` and `symbol` changes and calls the appropriate API or socket mechanisms (e.g. `fetchCandle` equivalent) to backfill the missing data.
  </action>
  <verify>grep for `timeframe` dependencies in `Chart.tsx`</verify>
  <done>Timeframe changes successfully trigger a UI update and re-render of the canvas with the new candle data limits.</done>
</task>
