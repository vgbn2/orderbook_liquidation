---
phase: 2
level: 2
researched_at: 2026-03-05
---

# Phase 2 Research: Architectural UI Redesign & Engine Fixes

## Questions Investigated
1. Why is the Quant Panel missing the Sigma Distributions?
2. Why is the Replay Panel returning no data / unresponsive?
3. How can we decentralize the UI components without breaking existing states?

## Findings

### Quant Engine (Missing Distributions)
The UI in `QuantPanel.tsx` expects `quantSnapshot.sigmaGrid` array, which the new TypeScript `quantMath.ts` does return properly.
However, because Yahoo Finance (`yahoo-finance2`) was throwing an instantiation error before our previous fix, the `quantEngine.ts` cache did not hold any snapshot. This causes a permanent "INITIALIZING MACRO ENGINE..." state in the UI. 
Since `start.bat` doesn't hot-reload the backend, the user must restart the server process for the fix to take effect.

### Replay Engine (Unresponsive)
The `replayEngine.ts` fetches replay events via SQL queries to `orderbook_snapshots`, `big_trades`, and `liquidation_events` within the selected time range, streaming them over WS `BATCH` chunks.
If the database doesn't have recorded tabular data in that specific historical time range, or if the time range inputted by the UI is out of bounds, it sends an empty array, resulting in nothing replaying. We need to verify data existence and perhaps add better fallback logging to the panel.

### UI Decentralization & Extensibility
The right sidebar in `App.tsx` is bloated. Cramping future FX, Stocks, and Commodities panels into it will break the UX.
We have an existing, robust floating panel template (`FloatingBacktestPanel.tsx`) with dragging, resizing, and docking logic. 
This template can be adopted for:
- `FloatingQuantPanel.tsx`
- `FloatingLiquidationPanel.tsx`
- `FloatingOptionsPanel.tsx`

`TerminusNav.tsx` will dispatch custom window events (e.g., `window.dispatchEvent(new Event('toggle_quant_panel'))`), which `App.tsx` will listen to in order to render/hide these floating child components seamlessly without complex prop drilling.

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| UI Layout | Floating Panels + Summary Sidebar | Decentralizes views and keeps the main terminal uncluttered, allowing for new asset classes to be added to the high-level summary grading without crowding the screen. |
| Navigation | DOM Event Dispatching | Simplifies global state management. Panels can manage their own docked/floating UI states (like the Backtest Panel does). |

## Dependencies Identified
| Component | Existing Base | Purpose |
|---------|---------|---------|
| `useDraggable.ts` | hook | Enables moving the floating panels around the screen freely |

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
