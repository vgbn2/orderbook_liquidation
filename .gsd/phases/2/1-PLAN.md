---
phase: 2
plan: 1
wave: 1
depends_on: []
files_modified: ['packages/web/src/utils/safe.ts', 'packages/web/src/components/exchange/Orderbook.tsx']
autonomous: true

must_haves:
  truths:
    - "Safe formatting utilities exist for prices, money, and percentages."
    - "Sub-$1 assets display correct precision instead of truncating to tenths."
  artifacts:
    - "packages/web/src/utils/safe.ts exists and functions correctly."
---

# Plan 2.1: Foundation Utilities & Price Formatting Fix

<objective>
Implement generic safe formatting utilities and fix the sub-$1 price formatting bug (BUG-5).

Purpose: Creates a single source of truth for numeric and array guarantees, ensuring UI components don't crash on undefined backend data, and formatting is dynamically handled across differing asset price magnitudes.
Output: `utils/safe.ts` and updated `Orderbook.tsx`.
</objective>

<context>
Load for context:
- .gsd/SPEC.md
- .gsd/CODEBASE.md (Section 9 "utils/safe.ts" & "BUG-5")
- packages/web/src/components/exchange/Orderbook.tsx
</context>

<tasks>

<task type="auto">
  <name>Create safe formatting utilities</name>
  <files>packages/web/src/utils/safe.ts</files>
  <action>
    Export `fmt` object containing `price`, `money`, and `pct` formatting functions. 
    Export `safe` object containing `arr` (guarantee array) and `num` (guarantee number) functions.
    Make `fmt.price` sensitive to magnitudes (e.g., v>=10000 no decimals, v>=1 2 decimals, v<1 5 decimals).
    AVOID: Throwing errors on null/NaN in formatter logic because data streams can push malformed packets.
  </action>
  <verify>grep "fmt = {" packages/web/src/utils/safe.ts</verify>
  <done>Utility file created and correctly exports `fmt` and `safe` functions.</done>
</task>

<task type="auto">
  <name>Fix Orderbook sub-$1 price formatting</name>
  <files>packages/web/src/components/exchange/Orderbook.tsx</files>
  <action>
    Import `fmt` from `utils/safe.ts`. Replace occurrences of `price.toFixed(1)` or similar hardcoded precision logic with `fmt.price(price)`.
    AVOID: Altering the rendering logic beyond formatting.
  </action>
  <verify>grep "fmt.price" packages/web/src/components/exchange/Orderbook.tsx</verify>
  <done>Price scales dynamically adjusting to asset magnitude, fixing DOGE/XRP visuals.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Sub-$1 assets correctly format to 5 decimal places instead of 1.
- [ ] Safe utility exports are accessible globally.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
