---
phase: 8
plan: 1
wave: 1
depends_on: []
files_modified:
  - packages/server/src/engines/analytics/options.ts
  - packages/server/src/engines/analytics/vwaf.ts
  - start.bat
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Options snapshots are batched into a single multi-row INSERT"
    - "Funding snapshots are batched into a single multi-row INSERT"
    - "start.bat reports the correct Redis port (6380)"
  artifacts:
    - "packages/server/src/engines/analytics/options.ts updated"
    - "packages/server/src/engines/analytics/vwaf.ts updated"
---

# Plan 8.1: Database Batching & Port Reconciliation

<objective>
Reduce database write load by batching snapshot inserts and fix the misleading port information in the startup script.

Purpose: Prevent "Slow query" warnings and improve system responsiveness.
Output: Optimized analytics engines and corrected start script.
</objective>

<context>
Load for context:
- packages/server/src/engines/analytics/options.ts
- packages/server/src/engines/analytics/vwaf.ts
- start.bat
- packages/server/src/db/TradeBatcher.ts (as pattern)
</context>

<tasks>

<task type="auto">
  <name>Batch Options Snapshots</name>
  <files>packages/server/src/engines/analytics/options.ts</files>
  <action>
    Refactor the `startBroadcast` loop to build a single multi-row `INSERT` statement instead of multiple individual `query` calls. 
    AVOID: Parallel non-awaited queries which saturate the pool and trigger slow-query warnings.
  </action>
  <verify>Check terminal logs for "Slow query" warnings during options broadcast.</verify>
  <done>Options inserts complete in < 200ms.</done>
</task>

<task type="auto">
  <name>Batch Funding Snapshots</name>
  <files>packages/server/src/engines/analytics/vwaf.ts</files>
  <action>
    Similar to Options, refactor the `VWAFEngine` loop to use a single multi-row `INSERT` for all exchange snapshots in the current cycle.
  </action>
  <verify>Check terminal logs for "Slow query" warnings during VWAF broadcast.</verify>
  <done>Funding inserts complete in < 200ms.</done>
</task>

<task type="auto">
  <name>Stabilize start.bat Port Report</name>
  <files>start.bat</files>
  <action>
    Update line 43 of `start.bat` to echo "Redis running on port 6380" to match the actual configuration in `.env` and `docker-compose.yml`.
  </action>
  <verify>Run start.bat and verify the echo matches the reality.</verify>
  <done>Start script is factually accurate.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] No "Slow query" warnings for snapshots in server logs.
- [ ] start.bat output is consistent with .env.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Database write latency for snapshots reduced by >50%.
</success_criteria>
