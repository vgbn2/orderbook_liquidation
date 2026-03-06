---
phase: 2
plan: 2
wave: 1
depends_on: []
files_modified: [
  'packages/web/src/components/exchange/LiquidationPanel.tsx',
  'packages/web/src/components/exchange/QuantPanel.tsx',
  'packages/web/src/components/exchange/ReplayPanel.tsx'
]
autonomous: true

must_haves:
  truths:
    - "LiquidationPanel renders without React hook order crashes."
    - "QuantPanel's BellCurveChart safely handles undefined initialization states."
    - "ReplayPanel's pause button accurately fires 'pause_replay' WS events."
  artifacts: []
---

# Plan 2.2: Structural Bug Fixes

<objective>
Fix critical React rendering and event binding bugs identified in CODEBASE.md (BUG-2, BUG-4, BUG-6).

Purpose: Restores core panel stability to prevent white-screens.
Output: stable Liquidation, Quant, and Replay panels.
</objective>

<context>
Load for context:
- .gsd/CODEBASE.md (Section 8: Known Bugs)
- packages/web/src/components/exchange/LiquidationPanel.tsx
- packages/web/src/components/exchange/QuantPanel.tsx
- packages/web/src/components/exchange/ReplayPanel.tsx
</context>

<tasks>

<task type="auto">
  <name>Fix LiquidationPanel hook crash</name>
  <files>packages/web/src/components/exchange/LiquidationPanel.tsx</files>
  <action>
    Move `useMemo` hooks above the early `if (!data) return ...` guard.
    Place null checks inside the `useMemo` block itself.
    AVOID: Returning null before all React hooks complete execution.
  </action>
  <verify>grep "useMemo" packages/web/src/components/exchange/LiquidationPanel.tsx appears before early returns.</verify>
  <done>Panel renders without "Rendered more hooks" React errors.</done>
</task>

<task type="auto">
  <name>Fix QuantPanel sigmaGrid crash</name>
  <files>packages/web/src/components/exchange/QuantPanel.tsx</files>
  <action>
    Add a null guard or fallback rendering state before the `<BellCurveChart />` component attempts to pass `quantSnapshot.sigmaGrid` if it is undefined.
  </action>
  <verify>grep "sigmaGrid" packages/web/src/components/exchange/QuantPanel.tsx shows bounded check.</verify>
  <done>QuantPanel does not bubble up errors to ErrorBoundary on backend restart.</done>
</task>

<task type="auto">
  <name>Wire ReplayPanel pause button</name>
  <files>packages/web/src/components/exchange/ReplayPanel.tsx</files>
  <action>
    Add `onClick={() => send({ action: 'pause_replay' })}` alongside the stop and start buttons. Ensure `send` is grabbed from `useMarketDataStore` if not already present.
  </action>
  <verify>grep "pause_replay" packages/web/src/components/exchange/ReplayPanel.tsx</verify>
  <done>Pause button is clickable and sends correct action payload over WS.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] No React hook crashes on LiquidationPanel mount.
- [ ] Replay pause button triggers state updates.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
