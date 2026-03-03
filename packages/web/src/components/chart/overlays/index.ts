// ─────────────────────────────────────────────────────────────────────────────
// components/chart/overlays/index.ts
//
// Root entry for the chart plugin system.
// Importing any overlay registers it with the overlayRegistry automatically.
// ─────────────────────────────────────────────────────────────────────────────

import './liquidityOverlay';
import './ictOverlay';
import './sessionOverlay';
import './volumeProfileOverlay';

// Re-export registry for convenience
export * from './overlayRegistry';
