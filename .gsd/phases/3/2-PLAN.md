---
phase: 3
plan: 2
wave: 1
depends_on: []
files_modified: [
  'packages/web/src/components/exchange/panels/TerminalSummaryPanel.tsx'
]
autonomous: true

must_haves:
  truths:
    - "TerminalSummaryPanel computes a real liqRatio from live liquidation heatmap data."
    - "The Grade Algorithm accurately weights drift/expectedMove, liqRatio, and Options GEX."
  artifacts: []
---

# Plan 3.2: Grade Algorithm Wiring

<objective>
Wire up the `liqRatio` in `TerminalSummaryPanel.tsx` to fully activate the Grade Algorithm. Currently, `liqRatio` is hardcoded to 1.0.

Purpose: Provide a unified "Signal Grade" (e.g., STRONG BUY) based on quantitative drift, order flow (liquidations), and options positioning.
Output: Dynamic `liqRatio` calculation in the summary panel.
</objective>

<context>
Load for context:
- packages/web/src/components/exchange/panels/TerminalSummaryPanel.tsx
- .gsd/SPEC.md
</context>

<tasks>

<task type="auto">
  <name>Calculate dynamic liqRatio</name>
  <files>packages/web/src/components/exchange/panels/TerminalSummaryPanel.tsx</files>
  <action>
    In `TerminalSummaryPanel.tsx`:
    1. Extract `liquidations` from `useMarketDataStore`.
    2. In the `useMemo` block, iterate over `liquidations.heatmap` to sum `long_liq_usd` and `short_liq_usd` using the same logic found in `LiquidationPanel.tsx`.
    3. Calculate `liqRatio = shorts / (longs || 1)`.
    4. Replace the hardcoded `const liqRatio = 1.0` with the calculated sum.
    5. Pass this new `liqRatio` into `computeSignalGrade()`.
  </action>
  <verify>grep "liqRatio = " packages/web/src/components/exchange/panels/TerminalSummaryPanel.tsx</verify>
  <done>The signal grade updates dynamically in response to live liquidations instead of remaining perfectly neutral.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] `TerminalSummaryPanel` successfully extracts the heatmap without crashing.
- [ ] `liqRatio` dynamically shifts above/below 1.0 when active liquidations occur.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
