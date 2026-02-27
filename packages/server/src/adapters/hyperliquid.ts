import { logger } from '../logger.js';

export function startHyperliquid(symbol: string) {
    logger.info({ symbol }, 'Stub: Hyperliquid adapter started');
}

export function stopHyperliquid(symbol: string) {
    logger.info({ symbol }, 'Stub: Hyperliquid adapter stopped');
}
