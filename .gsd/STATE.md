# STATE — GSD Session State

**Status**: Active (resumed 2026-03-05T16:22)
**Phase**: Fix Quant Engine + Analytics UI
**Current Task**: Fix 3 UI issues in Analytics tab / QuantSummary

---

## Completed

- [x] `quant.ts` — Changed `import { YahooFinance }` → `import yf from 'yahoo-finance2'`, removed `new YahooFinance()`
- [x] `index.ts` — Commented out missing MEXC adapter (file `adapters/mexc.ts` doesn't exist). User then deleted the comment line entirely.
- [x] Server builds clean: `npx tsc --noEmit` → exit 0

---

## In Progress — 3 UI Issues

User provided visual diagnosis of the right panel:

### Issue 1: ANALYTICS tab appears blank
**Investigation result**: `App.tsx` line 334 DOES have `sidebarTab === 'analytics'` → `<QuantPanel />`. The branch exists and is correct.
**Actual cause**: `quantSnapshot` is `null` so `QuantPanel` renders the "INITIALIZING MACRO ENGINE..." spinner — which IS the content, just looks empty/blank.

### Issue 2: Spinner in wrong place
**Investigation result**: `QuantPanel` spinner (line 189-211) is full-height centered — `height: '100%'`, `display: 'flex', alignItems: 'center'`. This is correct positioning within the tab content area. The real problem is that it looks like an empty panel because the spinner has very little visual weight.

### Issue 3: QuantSummary absent above tabs
**Investigation result**: `QuantSummary` IS rendered above the tab bar at `App.tsx` line 297. However, when `quantSnapshot` is null, `QuantSummary` returns a tiny skeleton (lines 59-78) with `padding: '10px 12px'` and just a 14px spinner + "INITIALIZING..." text. This is ~34px tall — barely visible and could look invisible.

---

## Compressed File Summaries

### 📦 App.tsx (401 lines)
**Purpose**: Main app layout — nav, chart, right sidebar with tabs
**Key structure (right panel, lines 238-347)**:
- L258: `<Orderbook />`
- L264-293: Orderbook height resizer
- L295-346: Flex column container:
  - L297: `<QuantSummary />` — ABOVE tabs ✓
  - L301-321: Tab bar (macro | options | analytics)
  - L323-330: macro → HTFBias, Liquidation, VWAF, Confluence
  - L331-333: options → OptionsPanel
  - L334-336: analytics → QuantPanel ✓
**State**: `sidebarTab` = `'macro' | 'options' | 'analytics'`

### 📦 QuantSummary.tsx (201 lines)
**Purpose**: Slim card above tabs showing regime, bias, prob bar, "OPEN ANALYTICS" btn
**Loading state (L58-78)**: Returns tiny spinner + "INITIALIZING..." — no explicit minHeight
**Data state (L86-198)**: Shows regime icon/label, drift/vol/exp stats grid, bull/bear bar, button

### 📦 QuantPanel.tsx (412 lines)
**Purpose**: Full analytics panel in analytics tab — regime, correlations, quantiles, sigma dist
**Loading state (L189-211)**: Full-height centered "INITIALIZING MACRO ENGINE..." spinner
**Data state (L218-409)**: Market regime, correlations table, quantiles, bell curve + bias

### 📦 marketDataStore.ts
**quantSnapshot**: Defined at L86-87, initialized `null` at L187
**setQuantSnapshot**: L188-192 — sets state
**Data source**: `useWebSocket.ts` L216 — on `quant.analytics` message

### 📦 quant.ts (server, 195 lines)
**Purpose**: QuantEngine — fetches macro data via Yahoo Finance, computes analytics
**Fixed**: Import corrected. Runs on 30min intervals, broadcasts `quant.analytics.{symbol}`

---

## Root Cause Analysis

The fundamental problem is **`quantSnapshot` is null** at app startup because the QuantEngine takes time to fetch Yahoo Finance data + compute. Both `QuantSummary` and `QuantPanel` show loading states, but:

1. `QuantSummary` loading skeleton is too small (no minHeight) → appears invisible
2. `QuantPanel` loading is full-height centered spinner → looks like empty panel
3. The `App.tsx` tab structure itself is correct

---

## Next Steps

1. Give `QuantSummary` skeleton explicit `minHeight: 80px` so it's visible while loading
2. Improve `QuantPanel` loading state to look less like an empty panel (add border/background)
3. Verify the WebSocket topic in `useWebSocket.ts` matches the server broadcast topic

---

## Blockers

- The server needs to complete a full QuantEngine cycle (~Yahoo Finance API call) before `quantSnapshot` populates. This is working as designed — the fix is visual, not data-level.
