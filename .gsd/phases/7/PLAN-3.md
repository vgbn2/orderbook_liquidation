---
phase: 7
plan: 3
wave: 3
depends_on: ["PLAN-2"]
files_modified: []
autonomous: false
user_setup: []

must_haves:
  truths:
    - "Chart loads instantly from cache after initial visit"
    - "IndexedDB size grows with usage but respects limits"
    - "Network tab shows background gap-fills instead of full 500-candle fetches"
  artifacts: []
---

# Plan 7.3: Verification of Candle Cache & Pre-Warm

<objective>
Verify that the complete Candle Cache and Predictive Pre-Warm system functions end-to-end without black screens, and that idle browser time is actively utilized to pre-fetch anticipated data.

Purpose: Goal-backward verification that the user never sees a loading spinner for previously visited or highly-ranked symbol/timeframes.
Output: Empirical proof of caching behavior.
</objective>

<context>
No code changes required. This is a verification step.
</context>

<tasks>

<task type="checkpoint:human-verify">
  <name>Verify Instant Cache Hits</name>
  <files>None</files>
  <action>
    1. Load BTCUSDT 1m. Wait for full load.
    2. Switch to ETHUSDT 1m.
    3. Switch back to BTCUSDT 1m.
    Observer: Does the chart render instantly before the network request finishes? Is there a black screen?
  </action>
  <verify>Visual confirmation of instant load and no "Loading..." spinner.</verify>
  <done>Instant load of cached pair.</done>
</task>

<task type="checkpoint:human-verify">
  <name>Verify Predictive Pre-Warming</name>
  <files>None</files>
  <action>
    1. Click on SOLUSDT 1m a few times to build its score in the `usageProfile`.
    2. Sit idle on BTCUSDT 1m for >5 seconds.
    3. Open Browser DevTools Network tab. Filter by "Fetch/XHR".
    Observer: Do you see an automatic, background fetch to `/api/ohlcv?symbol=SOLUSDT` triggered by `startPrewarm` without you clicking anything?
  </action>
  <verify>DevTools Network tab shows background fetches initiated from App.tsx.</verify>
  <done>System actively anticipates user actions.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] No regressions in standard charting functionality.
- [ ] QuantEngine distributions still update properly.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
