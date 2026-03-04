import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { logger } from '../logger.js';
import { clientHub } from '../ws/client-hub.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_PATH = join(__dirname, '../../scripts/fetch_macro.py');

const INTERVAL = 60 * 60 * 1000; // 1 hour
const MAX_RETRIES = 3;
const TIMEOUT = 60_000; // 60s for Python

function findPythonBinary(): string {
    const candidates = ['python3', 'python', 'python3.11', 'python3.10'];
    for (const candidate of candidates) {
        try {
            const result = execSync(`${candidate} --version`, { stdio: 'pipe' }).toString();
            if (result.includes('Python 3')) {
                return candidate;
            }
        } catch {
            continue;
        }
    }
    throw new Error('No Python 3 interpreter found in PATH');
}

const VENV_PYTHON = join(__dirname, '../../scripts/venv/bin/python3');
const PYTHON_BIN = existsSync(VENV_PYTHON) ? VENV_PYTHON : findPythonBinary();

export interface QuantSnapshot {
    symbol: string;
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
    private cache: Map<string, QuantSnapshot> = new Map();
    private activeSymbol = 'BTCUSDT';
    private isRunning = false;
    private timer: ReturnType<typeof setInterval> | null = null;

    getLastSnapshot(symbol?: string): QuantSnapshot | null {
        return this.cache.get(symbol || this.activeSymbol) || null;
    }

    switchSymbol(newSymbol: string) {
        if (this.activeSymbol === newSymbol) return;
        this.activeSymbol = newSymbol;

        const cached = this.cache.get(newSymbol);
        if (cached) {
            clientHub.broadcast('quant.analytics' as any, cached);
        } else {
            // Trigger run for new symbol
            this.runCycle(newSymbol, 1);
        }
    }

    start(initialSymbol = 'BTCUSDT') {
        this.activeSymbol = initialSymbol;
        logger.info(`QuantEngine starting for ${this.activeSymbol} — first cycle now, then every 1hr`);
        this.runCycle(this.activeSymbol);
        this.timer = setInterval(() => this.runCycle(this.activeSymbol), INTERVAL);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private async runCycle(symbol: string, attempt = 1): Promise<void> {
        if (this.isRunning) {
            logger.debug('QuantEngine: previous cycle still running, skipping');
            return;
        }
        this.isRunning = true;

        try {
            const raw = await this.fetchMacroData(symbol);
            if (raw.error) {
                throw new Error(raw.error);
            }

            const snapshot = raw as QuantSnapshot;
            snapshot.symbol = symbol;
            this.cache.set(symbol, snapshot);

            // Only broadcast if this is still the active symbol
            if (this.activeSymbol === symbol) {
                clientHub.broadcast('quant.analytics' as any, snapshot);
            }

            logger.info({
                symbol,
                price: raw.currentPrice,
                drift: raw.meta?.adjustedDrift,
            }, 'QuantEngine cycle complete');
        } catch (err) {
            logger.error({ err, attempt, symbol }, 'QuantEngine cycle failed');
            if (attempt < MAX_RETRIES) {
                this.isRunning = false;
                setTimeout(() => this.runCycle(symbol, attempt + 1), 5000);
                return;
            }
            if (this.activeSymbol === symbol) {
                clientHub.broadcast('quant.error' as any, {
                    ts: Date.now(),
                    message: String(err),
                    retryIn: INTERVAL,
                });
            }
        } finally {
            this.isRunning = false;
        }
    }

    private fetchMacroData(symbol: string): Promise<any> {
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';

            const proc = spawn(PYTHON_BIN, [SCRIPT_PATH, '--symbol', symbol], {
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
