---
phase: 3
plan: 1
wave: 1
depends_on: []
files_modified: [
  'packages/web/src/utils/capabilityMap.ts',
  'packages/web/src/components/shared/TerminusNav.tsx'
]
autonomous: true

must_haves:
  truths:
    - "capabilityMap.ts correctly classifies symbols into asset classes (crypto_perp, crypto_spot, fx, equity)."
    - "TerminusNav greys out or hides analytics panel buttons if the current asset does not support them."
  artifacts:
    - "packages/web/src/utils/capabilityMap.ts"
---

# Plan 3.1: Asset Capability Map

<objective>
Implement an Asset Capability Map to define which asset classes (crypto_perp, crypto_spot, fx, equity) support which analytics panels. Wire this into the UI so that unsupported tools are visually disabled or hidden.

Purpose: As we expand beyond crypto perpetuals, not all analytics apply to all assets (e.g., Forex does not have on-chain liquidations).
Output: `capabilityMap.ts` utility and guarded navigation items in `TerminusNav.tsx`.
</objective>

<context>
Load for context:
- packages/web/src/components/shared/TerminusNav.tsx
- .gsd/SPEC.md
</context>

<tasks>

<task type="auto">
  <name>Create capabilityMap utility</name>
  <files>packages/web/src/utils/capabilityMap.ts</files>
  <action>
    Create a new file `capabilityMap.ts`. Include a function `getAssetClass(symbol: string): 'crypto_perp' | 'crypto_spot' | 'fx' | 'equity'` (simple heuristic: if it ends in 'USDT' it's `crypto_perp`, for now).
    Export a capability matrix defining support for 'quant', 'liquidation', and 'options' panels across these classes.
  </action>
  <verify>cat packages/web/src/utils/capabilityMap.ts</verify>
  <done>Utility created and exports cleanly.</done>
</task>

<task type="auto">
  <name>Wire capability restrictions into TerminusNav</name>
  <files>packages/web/src/components/shared/TerminusNav.tsx</files>
  <action>
    Import the capability map in `TerminusNav.tsx`.
    Subscribe to the current symbol from `useCandleStore`.
    Determine the current asset class.
    For the "Macro Quant", "Liquidation", and "Options · GEX" dropdown items, conditionally render them as disabled/grayed out, or hide them entirely, if the current asset class does not support that panel.
  </action>
  <verify>grep "getAssetClass" packages/web/src/components/shared/TerminusNav.tsx</verify>
  <done>Unsupported panels are unclickable via the UI for incompatible assets.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Asset capability utility provides sane defaults for 'crypto_perp'.
- [ ] UI prevents opening liquidation panel for non-crypto assets (can test by forcing getAssetClass to return 'fx' temporarily).
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
