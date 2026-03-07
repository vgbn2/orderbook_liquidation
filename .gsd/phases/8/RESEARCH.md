---
phase: 8
level: 2
researched_at: 2026-03-07
---

# Phase 8 Research: System Hardening & Optimization

## Questions Investigated
1. **Database Latency**: Why are `options_snapshots` and `funding_snapshots` inserts exceeding 200ms?
2. **Port Reconciliation**: Why is there a mismatch between `start.bat` echoes and actual `.env` configuration?
3. **API Resilience**: How can we stabilize the Signal Intelligence pipeline against Finnhub 429 errors?

## Findings

### 1. Database Persistence Latency
The `OptionsEngine` and `VWAFEngine` currently fire multiple individual `INSERT` queries within a `setInterval` loop. For an options chain with 20+ strikes, this results in 40+ parallel non-batched queries every 5 seconds.
- **Cause**: Individual `query()` overhead + parallel execution saturation.
- **Recommendation**: Implement a `Batcher` pattern similar to `TradeBatcher.ts` or use a multi-row `INSERT ... VALUES ($1, $2), ($3, $4)...` syntax.

### 2. Port Configuration Mismatch
- `start.bat`: Reports Redis on `6379`.
- `docker-compose.yml`: Maps `6380 -> 6379`.
- `.env`: Uses `REDIS_PORT=6380`.
- **Status**: Connections work, but the user-facing logs in `start.bat` are misleading.
- **Recommendation**: Update `start.bat` to dynamically read from `.env` or simply hardcode the correct `6380` indicator to match the production-ready compose file.

### 3. Signal Intelligence Stability
The `test-signals.ts` script and live engine encounter `429 Too Many Requests` when polling Finnhub.
- **Findings**: Finnhub free tier is extremely restrictive (30 calls/min).
- **Recommendation**: 
    - Implement a `RateLimiter` or `Cooldown` in `finnhub.ts`.
    - Cache results for longer (intelligence doesn't need second-by-second updates).
    - Add a "Stale" indicator in the UI if the last update failed.

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Snapshots | Batching | Critical for system responsiveness and preventing event-loop lag. |
| Redis Port | Reconcile to 6380 | Consistency between dev scripts and `.env`. |
| API Layer | Add Backoff | Prevents "Invisible Thumb" logic corruption from empty/stale data. |

## Patterns to Follow
- **Batching**: Use the multi-row insert pattern established in `TradeBatcher.ts`.
- **Error Handling**: Use the `SafeNum` / `SafeArr` patterns for all incoming API data to prevent UI crashes.

## Anti-Patterns to Avoid
- **Parallel Looped Await**: Never fire `await query()` inside an `array.map()` or `for` loop without batching.

## Dependencies Identified
| Package | Version | Purpose |
|---------|---------|---------|
| `p-queue` | (Existing) | Used in `BackpressureQueue.ts` to manage DB load. |

## Risks
- **Data Loss**: If batching fails, we must ensure re-queuing doesn't cause OOM.
- **Rate Limits**: Increasing interval in `fred.ts` might miss macro surprises.

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
