---
phase: 3
plan: 3
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  truths:
    - "Significant liquidations tracking is verified as implemented in marketDataStore."
  artifacts: []
---

# Plan 3.3: Significant Liquidations Tracking

<objective>
Verify and formalize the Significant Liquidations (Whale Tracking) feature listed in Phase 3 of the roadmap.

Purpose: Track liquidations > $1M in the global state to allow the UI to alert users or render a "Whale Feed" component.
Output: Verification of existing implementation, or missing code added.
</objective>

<context>
Load for context:
- packages/web/src/stores/marketDataStore.ts
</context>

<tasks>

<task type="auto">
  <name>Verify Significant Liquidations Implementation</name>
  <files>packages/web/src/stores/marketDataStore.ts</files>
  <action>
    Inspect `packages/web/src/stores/marketDataStore.ts`. 
    If `significantLiquidations` and `addSignificantLiquidation` are already fully implemented (ignoring sub-$10k events and keeping the last 50), do nothing. The task is complete.
    If missing, implement `significantLiquidations` in the store following the $10k threshold rule.
  </action>
  <verify>grep "significantLiquidations" packages/web/src/stores/marketDataStore.ts</verify>
  <done>Significant liquidations are demonstrably tracked in the global state store.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] `marketDataStore.ts` safely discards small liquidations from the `significantLiquidations` array.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
