import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from '../logger.js';
import { clientHub } from '../ws/client-hub.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_PATH = join(__dirname, '../../scripts/fetch_macro.py');

const INTERVAL = 60 * 60 * 1000; // 1 hour
const MAX_RETRIES = 3;
const TIMEOUT = 60_000; // 60s for Python

export interface QuantSnapshot {
    ts: number;
    currentPrice: number;
    meta: {
        baseDrift: number;
        macroDrag: number;
        adjustedDrift: number;
        stepVolatility: number;
        horizon: number;
    };
    kalman: number[];
    dates: string[];
    projections: number[];
    cones: Array<{
        step: number;
        center: number;
        upper1: number;
        lower1: number;
        upper2: number;
        lower2: number;
    }>;
    sigmaGrid: Array<{
        sigma: number;
        price: number;
        pctMove: number;
        probability: number;
    }>;
    quantiles: Record<string, { price: number; pctMove: number }>;
    macroBreakdown: Array<{
        ticker: string;
        correlation: number;
        zScore: number;
        impact: number;
    }>;
}

class QuantEngine {
    private lastSnapshot: QuantSnapshot | null = null;
    private isRunning = false;
    private timer: ReturnType<typeof setInterval> | null = null;

    getLastSnapshot(): QuantSnapshot | null {
        return this.lastSnapshot;
    }

    start() {
        logger.info('QuantEngine starting — first cycle now, then every 1hr');
        this.runCycle();
        this.timer = setInterval(() => this.runCycle(), INTERVAL);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private async runCycle(attempt = 1): Promise<void> {
        if (this.isRunning) {
            logger.debug('QuantEngine: previous cycle still running, skipping');
            return;
        }
        this.isRunning = true;

        try {
            const raw = await this.fetchMacroData();
            if (raw.error) {
                throw new Error(raw.error);
            }

            this.lastSnapshot = raw as QuantSnapshot;
            clientHub.broadcast('quant.analytics' as any, this.lastSnapshot);
            logger.info({
                price: raw.currentPrice,
                drift: raw.meta?.adjustedDrift,
            }, 'QuantEngine cycle complete');
        } catch (err) {
            logger.error({ err, attempt }, 'QuantEngine cycle failed');
            if (attempt < MAX_RETRIES) {
                this.isRunning = false;
                setTimeout(() => this.runCycle(attempt + 1), 5000);
                return;
            }
            clientHub.broadcast('quant.error' as any, {
                ts: Date.now(),
                message: String(err),
                retryIn: INTERVAL,
            });
        } finally {
            this.isRunning = false;
        }
    }

    private fetchMacroData(): Promise<any> {
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';

            const proc = spawn('python', [SCRIPT_PATH], {
                timeout: TIMEOUT,
                env: { ...process.env },
            });

            proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
            proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

            proc.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python exited ${code}: ${stderr.slice(0, 500)}`));
                    return;
                }
                try {
                    resolve(JSON.parse(stdout));
                } catch {
                    reject(new Error(`Invalid JSON from Python: ${stdout.slice(0, 200)}`));
                }
            });

            proc.on('error', (err) => {
                reject(new Error(`Failed to spawn Python: ${err.message}`));
            });
        });
    }
}

export const quantEngine = new QuantEngine();
