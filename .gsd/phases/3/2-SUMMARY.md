---
phase: 3
plan: 02
completed_at: 2026-03-06T15:08:00+07:00
duration_minutes: 2
---

# Summary: Grade Algorithm Wiring

## Results
- 1 task completed
- All verifications passed

## Tasks Completed
| Task | Description | Status |
|------|-------------|--------|
| 1 | Calculate dynamic liqRatio in TerminalSummaryPanel | ✅ |

## Deviations Applied
- None.

## Files Changed
- `packages/web/src/components/exchange/panels/TerminalSummaryPanel.tsx` - Extracted the `liquidations` hook, iterated over the heatmap to compute long/short totals, and dynamically derived `liqRatio`.

## Verification
- Validated that `TerminalSummaryPanel` re-renders and updates its Grade Algorithm output correctly as real liquidity data shifts the `liqRatio` metric away from the flat 1.0 baseline: ✅ Passed
