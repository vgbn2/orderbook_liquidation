---
phase: 4
plan: 1
wave: 1
depends_on: []
files_modified: ["packages/server/binding.gyp", "packages/server/native/terminus_core.cpp"]
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Native addon compiles successfully on Windows (msvc)"
    - "Addon exports Kalman and Normal math functions"
  artifacts:
    - "packages/server/build/Release/terminus_core.node exists"
---

# Plan 4.1: Native Infrastructure & Math Port

<objective>
Consolidate native C++ logic into a unified `terminus_core` addon and ensure it compiles on the user's Windows environment.

Purpose: Foundation for ultra-low latency port.
Output: `terminus_core.node` with math exports.
</objective>

<context>
Load for context:
- packages/server/binding.gyp
- packages/server/native/quant_math.cpp
</context>

<tasks>

<task type="auto">
  <name>Consolidate to terminus_core.cpp</name>
  <files>packages/server/native/terminus_core.cpp</files>
  <action>
    Create a new file `terminus_core.cpp`. 
    Port all logic from `quant_math.cpp` into it.
    Update the exports to use `terminus_core` as the module name.
    Keep the Kalman1D and Normal distribution helpers.
  </action>
  <verify>File exists and contains ported code.</verify>
  <done>terminus_core.cpp created and ready for build.</done>
</task>

<task type="auto">
  <name>Update binding.gyp</name>
  <files>packages/server/binding.gyp</files>
  <action>
    Rename target `quant_math_native` to `terminus_core`.
    Update `sources` to point to `native/terminus_core.cpp`.
    Ensure `node-addon-api` dependencies are correct.
  </action>
  <verify>binding.gyp reflects the new target.</verify>
  <done>binding.gyp updated.</done>
</task>

<task type="auto">
  <name>Build Native Addon</name>
  <files>packages/server/package.json</files>
  <action>
    Run `npm run build:native` (or `node-gyp rebuild` in packages/server) to compile the C++ addon.
  </action>
  <verify>ls packages/server/build/Release/terminus_core.node</verify>
  <done>Addon compiled successfully.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] terminus_core.node exists
- [ ] Running a small node script can call `require('./build/Release/terminus_core.node').kalman1D([1,2,3])`
</verification>

<success_criteria>
- [ ] Native infrastructure is ready for orderbook porting
</success_criteria>
