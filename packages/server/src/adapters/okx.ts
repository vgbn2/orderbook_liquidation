import { logger } from '../logger.js';

export function startOkx(symbol: string) {
    logger.info({ symbol }, 'Stub: OKX adapter started');
}

export function stopOkx(symbol: string) {
    logger.info({ symbol }, 'Stub: OKX adapter stopped');
}
