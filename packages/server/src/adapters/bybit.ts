import { logger } from '../logger.js';

export function startBybit(symbol: string) {
    logger.info({ symbol }, 'Stub: Bybit adapter started');
}

export function stopBybit(symbol: string) {
    logger.info({ symbol }, 'Stub: Bybit adapter stopped');
}
