export type AssetClass = 'crypto_perp' | 'crypto_spot' | 'fx' | 'equity' | 'unknown';

export function getAssetClass(symbol: string): AssetClass {
    if (!symbol) return 'unknown';
    const s = symbol.toUpperCase();

    // Simple heuristic for demo purposes
    if (s.endsWith('USDT') || s.endsWith('USDC') || s.endsWith('USD')) {
        return 'crypto_perp';
    }
    if (s.length === 6 && !s.includes('USD')) {
        // e.g., EURGBP
        return 'fx';
    }

    return 'crypto_spot'; // fallback
}

export const PANEL_CAPABILITIES = {
    quant: ['crypto_perp', 'crypto_spot', 'fx', 'equity'],
    liquidation: ['crypto_perp'],
    options: ['crypto_perp', 'crypto_spot'],
} as const;

export type PanelId = keyof typeof PANEL_CAPABILITIES;

export function supportsPanel(symbol: string, panelId: PanelId): boolean {
    const assetClass = getAssetClass(symbol);
    return PANEL_CAPABILITIES[panelId]?.includes(assetClass as any) ?? false;
}
