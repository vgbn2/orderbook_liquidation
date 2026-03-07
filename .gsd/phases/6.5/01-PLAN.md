---
phase: 6.5
plan: 1
wave: 1
---

# Plan: 6.5-01 Elite Intelligence Dashboard Foundation

Migrate the EdgeFinder to a dedicated full-page experience and implement the Macro Surprise Meter.

## Objective
Establish the frontend routing and the backend surprise calculation engine.

## Context Files
- `packages/web/src/stores/settingsStore.ts`
- `packages/web/src/App.tsx`
- `packages/server/src/engines/signals/intelligence.ts`
- `packages/server/src/adapters/fred.ts`

## Tasks

### [NEW] 1. Create IntelligencePage Layout
- **File**: `packages/web/src/components/exchange/pages/IntelligencePage.tsx`
- **Action**: Implement the base layout with slots for gauges, macro table, and panels.
- **Done Criteria**: Component compiles and renders "EDGEFINDER" title.
- **Type**: auto

### [MODIFY] 2. Register Dashboard View
- **File**: `packages/web/src/stores/settingsStore.ts`
- **Action**: Add `edgefinder` to `currentView` and update the `setView` logic.
- **Done Criteria**: `settingsStore` allows setting `edgefinder` view.
- **Type**: auto

### [MODIFY] 3. Integrate with App Routing
- **File**: `packages/web/src/App.tsx`
- **Action**: Lazy-load `IntelligencePage` and add it to the view conditional block.
- **Done Criteria**: App can switch to the new page without crashing.
- **Type**: auto

### [NEW] 4. Implement Finnhub Forecast Adapter
- **File**: `packages/server/src/adapters/finnhub.ts`
- **Action**: Implement the economic calendar fetcher and FRED ID mapping.
- **Done Criteria**: `finnhubAdapter.fetch()` returns a map of consensus estimates.
- **Type**: auto

### [MODIFY] 5. Implement Macro Surprise Logic
- **File**: `packages/server/src/adapters/fred.ts`
- **Action**: Integrate `finnhub.ts`, implement `computeSurprise` with PMI penalties.
- **Done Criteria**: Macro indicators now include `surpriseScore` and `surpriseGrade`.
- **Type**: auto

### [MODIFY] 6. Blend Surprise into Intelligence Score
- **File**: `packages/server/src/engines/signals/intelligence.ts`
- **Action**: Update `macroScore` calculation to blend regime bias (70%) and surprise (30%).
- **Done Criteria**: Total score reflects both long-term regime and short-term surprises.
- **Type**: auto

## Verification
1. Run `test-intelligence.ts`.
2. Inspect log output for "Finnhub calendar fetched".
3. Verify macro score changes when mock forecasts are applied.
