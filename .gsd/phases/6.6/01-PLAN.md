---
phase: 6.6
plan: 1
wave: 2
depends_on: [6.5-01]
---

# Plan: 6.6-01 AI Geopolitical Intelligence

Integrate LLM-powered geopolitical risk analysis into the Signal Intelligence Engine.

## Objective
Implement news-based automated risk scoring using GDELT and Gemini.

## Context Files
- `packages/server/src/engines/signals/intelligence.ts`
- `packages/server/src/adapters/fred.ts`

## Tasks

### [NEW] 1. Implement GDELT News Adapter
- **File**: `packages/server/src/adapters/gdelt.ts`
- **Action**: Implement the GKG news fetcher with risk keyword filtering.
- **Done Criteria**: `gdeltAdapter.fetch()` returns a snapshot of relevant headlines.
- **Type**: auto

### [NEW] 2. Implement Gemini LLM Adapter
- **File**: `packages/server/src/adapters/gemini.ts`
- **Action**: Implement the Gemini 1.5 Flash prompt and JSON response parser.
- **Done Criteria**: `geminiAdapter.analyse(headlines)` returns a `GeopoliticalSnapshot` with a risk score.
- **Type**: auto

### [MODIFY] 3. Integrate Geopolitical Category
- **File**: `packages/server/src/engines/signals/intelligence.ts`
- **Action**: Add "Geopolitical" as the 5th category, update weight distribution, and include in broadcasts.
- **Done Criteria**: Overall Edge Score includes 10% geopolitical sentiment.
- **Type**: auto

### [MODIFY] 4. Add Geopolitical Panel to Dashboard
- **File**: `packages/web/src/components/exchange/pages/IntelligencePage.tsx`
- **Action**: Implement the `GeopoliticalPanel` and `HotZoneCard` sub-components.
- **Done Criteria**: UI displays AI-summarized hot zones and the 0-10 risk scale.
- **Type**: auto

## Verification
1. Run server with `DEBUG=gemini` to see LLM prompts.
2. Verify "Hot Zone" details appear in the IntelligencePage frontend.
3. Confirm weights sum to 1.00 in the Decision Engine.
