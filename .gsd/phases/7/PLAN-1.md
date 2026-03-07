---
phase: 7
plan: 1
wave: 1
depends_on: []
files_modified:
  - packages/server/src/adapters/binance.ts
  - packages/web/src/App.tsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Server compiles without syntax errors"
    - "Web frontend compiles without import errors"
  artifacts:
    - "binance.ts has correctly scoped fetchKlinesSince method"
    - "App.tsx has clean imports for the new lib functions"
---

# Plan 7.1: Fix Partial Implementation Syntax Errors

<objective>
Fix the syntax errors introduced during the initial ad-hoc implementation of the Candle Cache system.

Purpose: We cannot proceed with integration or verification until the build is green.
Output: Clean compilation of both `server` and `web` packages.
</objective>

<context>
Load for context:
- `packages/server/src/adapters/binance.ts` (Lines 510-530 - looking for missing `}` around L519)
- `packages/web/src/App.tsx` (Lines 10-25 - looking for mangled imports at L15)
</context>

<tasks>

<task type="auto">
  <name>Fix BinanceAdapter syntax error</name>
  <files>packages/server/src/adapters/binance.ts</files>
  <action>
    Locate `fetchKlinesSince` around line 520. Ensure it is inside the `BinanceAdapter` class block. 
    There is likely a missing closing brace `}` for a previous method or catch block around line 519.
    AVOID: Modifying working connection logic. Only fix the structural syntax.
  </action>
  <verify>npm run build --workspace=@orderbook/server or visual inspection of ts lints</verify>
  <done>No TS parsing errors in binance.ts</done>
</task>

<task type="auto">
  <name>Fix App.tsx import syntax error</name>
  <files>packages/web/src/App.tsx</files>
  <action>
    Around line 15, `import { useSettingsStore } from './stores/settingsStore'; import { getCachedCandles...` was merged onto one line.
    Split this into separate valid import statements.
  </action>
  <verify>Visual inspection of imports</verify>
  <done>No TS parsing errors for App.tsx imports</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] `tsc --noEmit` runs clean on server (or close to it)
- [ ] `tsc --noEmit` runs clean on web (or UI is visibly unfrozen)
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
