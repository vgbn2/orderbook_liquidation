// ─────────────────────────────────────────────────────────────────────────────
// components/chart/overlays/index.ts
//
// Root entry for the chart plugin system.
// Importing any overlay registers it with the overlayRegistry automatically.
// ─────────────────────────────────────────────────────────────────────────────

import './ictFvgOverlay';
import './ictObOverlay';
import './ictSweepsOverlay';
import './liqHeatmapOverlay';
import './restingLiqOverlay';
import './liqClustersOverlay';
import './sessionBoxesOverlay';
import './volProfileOverlay';

// Re-export registry for convenience
export { runOverlays } from './overlayRegistry';
