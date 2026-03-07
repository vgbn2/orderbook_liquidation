---
phase: 4
plan: 3
wave: 3
depends_on: ["4.2"]
files_modified: ["packages/server/src/engines/signals/orderbook.ts", "packages/server/src/engines/core/native-bridge.ts"]
autonomous: true
user_setup: []

must_haves:
  truths:
    - "JS OrderbookEngine delegates to Native core"
    - "Signals (Walls, Grades) continue working correctly"
---

# Plan 4.3: Engine Integration & Verification

<objective>
Bridge the existing JS signals to the new C++ Orderbook core and verify end-to-end performance.

Purpose: Complete the Phase 4 milestone.
Output: High-performance Terminus core.
</objective>

<context>
Load for context:
- packages/server/src/engines/signals/orderbook.ts
- packages/server/src/engines/core/native-bridge.ts
</context>

<tasks>

<task type="auto">
  <name>Update Native Bridge</name>
  <files>packages/server/src/engines/core/native-bridge.ts</files>
  <action>
    Update `NativeOrderbookWrapper` to match the C++ exports in `terminus_core.node`.
    Remove fallback logic if possible, or ensure it's robust.
  </action>
  <verify>Bridge loads the native library without errors.</verify>
  <done>Bridge updated.</done>
</task>

<task type="auto">
  <name>Refactor OrderbookEngine to Use Native</name>
  <files>packages/server/src/engines/signals/orderbook.ts</files>
  <action>
    Modify `OrderbookEngine` to call `nativeOrderbook` for `initSnapshot`, `applyDelta`, and `getAggregated`.
    Remove internal JS `Map` tracking since C++ now holds the state.
    Keep wall detection in JS for now (Phase 4 scope limited to basic porting).
  </action>
  <verify>Server starts and orderbook data flows from C++ -> JS -> Frontend.</verify>
  <done>JS/C++ integration complete.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] UI displays correct orderbook levels
- [ ] Server logs show 'Native C++ Engine loaded'
- [ ] Performance metrics (if available) show reduced latency
</verification>

<success_criteria>
- [ ] Phase 4 complete: Core engine is native C++
</success_criteria>
