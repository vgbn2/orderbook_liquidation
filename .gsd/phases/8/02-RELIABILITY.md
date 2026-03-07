---
phase: 8
plan: 2
wave: 2
depends_on: ["8.1"]
files_modified:
  - packages/server/src/adapters/finnhub.ts
  - packages/server/src/engines/signals/intelligence.ts
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Finnhub adapter handles 429 errors without crashing or logging excessive errors"
    - "Intelligence engine correctly identifies stale data indicators"
  artifacts:
    - "packages/server/src/adapters/finnhub.ts updated"
    - "packages/server/src/engines/signals/intelligence.ts updated"
---

# Plan 8.2: API Reliability & Intelligence Hardening

<objective>
Harden the external API communication layer to handle rate limits gracefully and ensure the intelligence engine doesn't rely on stale or missing data.

Purpose: Stabilize the "Elite Intelligence Dashboard" against restrictive free-tier API limits.
Output: Resilient data fetching and robust signal logic.
</objective>

<context>
Load for context:
- packages/server/src/adapters/finnhub.ts
- packages/server/src/engines/signals/intelligence.ts
- .gsd/phases/8/RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Implement Finnhub Rate Limiting</name>
  <files>packages/server/src/adapters/finnhub.ts</files>
  <action>
    Add a dedicated retry/cooldown logic for Finnhub calls. 
    Increase the cache TTL for sentiment data (since it doesn't change rapidly).
    AVOID: Rapid sequential polling that triggers 429s.
  </action>
  <verify>Run the finnhub adapter tests and ensure 429s are handled gracefully.</verify>
  <done>Successful data fetching within rate limits.</done>
</task>

<task type="auto">
  <name>Add Stale Data Protection</name>
  <files>packages/server/src/engines/signals/intelligence.ts</files>
  <action>
    Modify the intelligence engine to track the "freshness" of incoming data. 
    If an adapter fails (e.g., due to rate limit), use the cached value but flag it as 'stale' or reduce the impact on the overall score.
  </action>
  <verify>Simulate an API failure and check if the dashboard reflects the status correctly.</verify>
  <done>Intelligence engine robust to temporary external failures.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] No unhandled 429 errors from Finnhub in server logs.
- [ ] Dashboard shows valid (though possibly stale) data during API downtime.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] System uptime for intelligence dashboard increased to >99%.
</success_criteria>
