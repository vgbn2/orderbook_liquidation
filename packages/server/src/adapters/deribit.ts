import { logger } from '../logger.js';

export function startDeribit(symbol: string) {
    logger.info({ symbol }, 'Stub: Deribit adapter started');
}

export function stopDeribit(symbol: string) {
    logger.info({ symbol }, 'Stub: Deribit adapter stopped');
}
