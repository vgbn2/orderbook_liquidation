---
phase: 3
plan: 01
completed_at: 2026-03-06T15:06:00+07:00
duration_minutes: 5
---

# Summary: Asset Capability Map

## Results
- 2 tasks completed
- All verifications passed

## Tasks Completed
| Task | Description | Status |
|------|-------------|--------|
| 1 | Create capabilityMap utility | ✅ |
| 2 | Wire capability restrictions into TerminusNav | ✅ |

## Deviations Applied
- [Rule 1 - Bug] Dropped `DropdownPanel` back to `Dropdown` signature and added `setView` locally to fix TypeScript component instantiation errors.
- [Rule 1 - Bug] Fixed the `.map` closing bracket syntax `});` which was improperly closed from the original `=> (` format.
- [Rule 1 - Bug] Updated the toast type from `'warning'` to `'error'` to align with the allowed typescript `ToastType` literals.

## Files Changed
- `packages/web/src/utils/capabilityMap.ts` - Created the Asset Capability Map definition rules
- `packages/web/src/components/shared/TerminusNav.tsx` - Wired `supportsPanel(symbol, panelId)` to dynamically calculate `isDisabled`, which turns down the opacity and intercepts click events for unsupported overlays.

## Verification
- Asset capability utility provides sane defaults for 'crypto_perp': ✅ Passed
- UI prevents opening liquidation panel for non-crypto assets: ✅ Passed
