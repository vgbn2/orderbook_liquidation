---
phase: 2
plan: 3
wave: 2
depends_on: ['2']
files_modified: [
  'packages/web/src/components/exchange/cards/QuantCard.tsx',
  'packages/web/src/components/exchange/cards/LiquidationCard.tsx',
  'packages/web/src/components/exchange/panels/FloatingQuantPanel.tsx',
  'packages/web/src/components/exchange/panels/FloatingLiquidationPanel.tsx'
]
autonomous: true

must_haves:
  truths:
    - "QuantPanel and LiquidationPanel are refactored into Floating wrappers."
    - "The original sidebar definitions are removed from App.tsx rendering flow."
  artifacts:
    - "packages/web/src/components/exchange/panels/FloatingQuantPanel.tsx"
    - "packages/web/src/components/exchange/panels/FloatingLiquidationPanel.tsx"
---

# Plan 2.3: UI Decentralization - Quant & Liquidation Panels

<objective>
Extract the Quant and Liquidation panels from the bloat mapping in `App.tsx` and the right sidebar into independent floating panels using `FloatingPanelWrapper` and `useDraggable`.

Purpose: Enable new asset classes and prevent cramming all analytics views into a single 320px column.
Output: Two discrete floating panel components.
</objective>

<context>
Load for context:
- .gsd/CODEBASE.md (Section 7, Rule 5: Floating Panel Pattern)
- packages/web/src/components/shared/FloatingPanelWrapper.tsx
- packages/web/src/components/exchange/panels/QuantPanel.tsx
- packages/web/src/components/exchange/panels/LiquidationPanel.tsx
</context>

<tasks>

<task type="auto">
  <name>Extract FloatingQuantPanel</name>
  <files>packages/web/src/components/exchange/panels/FloatingQuantPanel.tsx</files>
  <action>
    Create a new component that wraps the existing `QuantPanel.tsx` internal logic inside the `FloatingPanelWrapper` (or use `useDraggable` directly if no wrapper exists). 
    Define an `onClose` prop.
    AVOID: Modifying `QuantPanel` internal logic. Instead, create this as a wrapper importing the inner component, or move the codebase into this floating definition.
  </action>
  <verify>grep "useDraggable" packages/web/src/components/exchange/panels/FloatingQuantPanel.tsx</verify>
  <done>Component created and exposes standard floating overlay interface.</done>
</task>

<task type="auto">
  <name>Extract FloatingLiquidationPanel</name>
  <files>packages/web/src/components/exchange/panels/FloatingLiquidationPanel.tsx</files>
  <action>
    Create a new component wrapping `LiquidationPanel.tsx` internal logic inside the floating context. Define an `onClose` prop.
  </action>
  <verify>grep "useDraggable" packages/web/src/components/exchange/panels/FloatingLiquidationPanel.tsx</verify>
  <done>Component created and exposes standard floating overlay interface.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Both floating panel components exist and utilize `useDraggable` or `FloatingPanelWrapper`.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
