---
phase: 4
plan: 2
wave: 2
depends_on: ["4.1"]
files_modified: ["packages/server/native/terminus_core.cpp", "packages/server/native/Orderbook.hpp"]
autonomous: true
user_setup: []

must_haves:
  truths:
    - "C++ Orderbook correctly aggregates bids and asks"
    - "applyDelta correctly updates prices and deletes zero quantities"
  artifacts:
    - "Orderbook.hpp containing class definition"
---

# Plan 4.2: C++ Orderbook Implementation

<objective>
Implement the core Orderbook logic in C++ (Map-based price tracking and aggregation) for maximum speed.

Purpose: High-performance data structure.
Output: C++ Orderbook implementation inside `terminus_core`.
</objective>

<context>
Load for context:
- packages/server/src/engines/signals/orderbook.ts (for logic reference)
- packages/server/native/terminus_core.cpp
</context>

<tasks>

<task type="auto">
  <name>Implement C++ Orderbook Class</name>
  <files>packages/server/native/Orderbook.hpp, packages/server/native/terminus_core.cpp</files>
  <action>
    Create `Orderbook.hpp` defining a class that manages two `std::map<double, double>` (bids, asks) where key is price and value is qty.
    Bids should be sorted descending, Asks sorted ascending.
    Implementation should include: `initSnapshot`, `applyDelta`, and `getTopLevels(n)`.
    Integrate into `terminus_core.cpp` and export the methods to Node.js.
  </action>
  <verify>C++ code compiles and handles sample deltas correctly.</verify>
  <done>Orderbook class implemented and exported.</done>
</task>

<task type="auto">
  <name>Verify with Test Script</name>
  <files>packages/server/test_native.js</files>
  <action>
    Create a small test script to verify `applyDelta` and `getAggregated` from Node.js.
  </action>
  <verify>node packages/server/test_native.js</verify>
  <done>Functionality verified via integration test.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] getAggregated(25) returns sorted bids/asks
- [ ] applyDelta correctly handles price updates
- [ ] applyDelta deletes levels when qty=0
</verification>

<success_criteria>
- [ ] C++ Orderbook engine is functional
</success_criteria>
