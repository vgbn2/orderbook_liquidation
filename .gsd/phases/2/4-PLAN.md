---
phase: 2
plan: 4
wave: 2
depends_on: ['3']
files_modified: [
  'packages/web/src/components/exchange/cards/OptionsCard.tsx',
  'packages/web/src/components/exchange/panels/FloatingOptionsPanel.tsx',
  'packages/web/src/App.tsx',
  'packages/web/src/hooks/useAppEvents.ts',
  'packages/web/src/components/shared/TerminusNav.tsx'
]
autonomous: true

must_haves:
  truths:
    - "OptionsPanel is refactored into a Floating wrapper."
    - "App.tsx listens to custom DOM events to toggle all 3 new floating panels."
    - "TerminusNav has dropdown items or buttons that dispatch the toggle events."
  artifacts:
    - "packages/web/src/components/exchange/panels/FloatingOptionsPanel.tsx"
---

# Plan 2.4: UI Decentralization - Options & Global Wiring

<objective>
Extract the Options panel into a floating component and wire all 3 new floating panels (Quant, Liquidation, Options) into the global `App.tsx` state using the DOM event dispatcher in `TerminusNav`. 

Purpose: Completes the architectural UI redesign, moving analytics out of the constrained right sidebar and into user-draggable windows.
Output: Fully functioning, draggable analytics overlays toggled from the top navigation.
</objective>

<context>
Load for context:
- packages/web/src/App.tsx
- packages/web/src/hooks/useAppEvents.ts
- packages/web/src/components/shared/TerminusNav.tsx
- packages/web/src/components/exchange/panels/FloatingOptionsPanel.tsx
</context>

<tasks>

<task type="auto">
  <name>Extract FloatingOptionsPanel</name>
  <files>packages/web/src/components/exchange/panels/FloatingOptionsPanel.tsx</files>
  <action>
    Create a new component wrapping `OptionsPanel.tsx` internal logic inside the floating context. Define an `onClose` prop.
  </action>
  <verify>grep "useDraggable" packages/web/src/components/exchange/panels/FloatingOptionsPanel.tsx</verify>
  <done>Component created and exposes standard floating overlay interface.</done>
</task>

<task type="auto">
  <name>Wire DOM events in useAppEvents and App</name>
  <files>
    packages/web/src/hooks/useAppEvents.ts
    packages/web/src/App.tsx
  </files>
  <action>
    In `useAppEvents.ts`, add event listeners for `TERMINUS_TOGGLE_QUANT`, `TERMINUS_TOGGLE_LIQ`, and `TERMINUS_TOGGLE_OPTIONS`.
    Update the hook signature to accept setters or utilize a local bound state. 
    In `App.tsx`, conditionally render `<FloatingQuantPanel>`, `<FloatingLiquidationPanel>`, and `<FloatingOptionsPanel>` safely at the root level overlay layer. Remove the hardcoded panel imports from the right sidebar element.
    AVOID: Breaking existing `TERMINUS_TOGGLE_BACKTEST` logic.
  </action>
  <verify>grep "TERMINUS_TOGGLE_QUANT" packages/web/src/hooks/useAppEvents.ts</verify>
  <done>App correctly listens and manages visibility state for all floating panels.</done>
</task>

<task type="auto">
  <name>Add dispatch triggers to TerminusNav</name>
  <files>packages/web/src/components/shared/TerminusNav.tsx</files>
  <action>
    Add dropdown items or buttons in the Analytics/Tools menu of `TerminusNav` that fire `window.dispatchEvent(new CustomEvent('TERMINUS_TOGGLE_QUANT'))`, etc.
  </action>
  <verify>grep "dispatchEvent" packages/web/src/components/shared/TerminusNav.tsx</verify>
  <done>Nav provides accessible buttons to open the new floating panels.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Option panel exists as a draggable float.
- [ ] Clicking nav buttons successfully toggles visibility of the three new panels without mutating unrelated state.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
