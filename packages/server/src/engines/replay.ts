import { logger } from '../logger.js';
import { query } from '../db/timescale.js';
import { clientHub } from '../ws/client-hub.js';

interface ReplayConfig {
    startTime: number; // unix ms
    endTime: number;
    speed: number;    // e.g. 1, 2, 5
}

class ReplayEngine {
    private activeSessions = new Map<string, {
        config: ReplayConfig;
        currentTime: number;
        timer: ReturnType<typeof setInterval> | null;
    }>();

    async startSession(clientId: string, config: ReplayConfig) {
        // Fix CRIT-3: Harden Replay Engine
        // 1. Validate and Clamp Speed (0.1x to 100x)
        const speed = Math.max(0.1, Math.min(config.speed || 1, 100));

        // 2. Limit Duration (max 30 days)
        const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
        const duration = config.endTime - config.startTime;

        if (duration <= 0 || duration > MAX_DURATION_MS) {
            logger.warn({ clientId, duration }, 'Replay session rejected: invalid duration');
            clientHub.sendToClient(clientId, 'replay' as any, { type: 'ERROR', message: 'Invalid duration' });
            return;
        }

        this.stopSession(clientId);

        logger.info({ clientId, config: { ...config, speed } }, 'Starting replay session');

        const session = {
            config: { ...config, speed },
            currentTime: config.startTime,
            timer: null as any
        };

        this.activeSessions.set(clientId, session);

        // Tick every 500ms real-time
        const realTick = 500;
        const simTick = realTick * speed;

        session.timer = setInterval(async () => {
            const current = this.activeSessions.get(clientId);
            if (!current) {
                if (session.timer) clearInterval(session.timer);
                return;
            }

            const nextTime = current.currentTime + simTick;
            if (nextTime > config.endTime) {
                this.stopSession(clientId);
                clientHub.sendToClient(clientId, 'replay' as any, { type: 'END' });
                return;
            }

            // Fetch data between current and nextTime
            try {
                const data = await this.fetchRange(current.currentTime, nextTime);
                if (data.length > 5000) {
                    // Fix CRIT-3 Attack 2: Prevent massive data transfer OOM
                    logger.warn({ clientId, count: data.length }, 'Replay range too large, truncating');
                    data.splice(5000);
                }

                // Always send BATCH to keep frontend scrubber synchronized, even if no data
                clientHub.sendToClient(clientId, 'replay' as any, {
                    type: 'BATCH',
                    timestamp: current.currentTime,
                    events: data
                });

                current.currentTime = nextTime;
            } catch (err) {
                logger.error({ err }, 'Replay fetch error');
                this.stopSession(clientId);
            }
        }, realTick);
    }

    stopSession(clientId: string) {
        const session = this.activeSessions.get(clientId);
        if (session) {
            if (session.timer) clearInterval(session.timer);
            this.activeSessions.delete(clientId);
            logger.info({ clientId }, 'Replay session stopped');
        }
    }

    private async fetchRange(start: number, end: number) {
        const startTime = new Date(start).toISOString();
        const endTime = new Date(end).toISOString();

        // Query multiple tables for events in this window
        const [obRes, tradeRes, liqRes] = await Promise.all([
            query(`SELECT * FROM orderbook_snapshots WHERE time >= $1 AND time < $2 ORDER BY time ASC`, [startTime, endTime]),
            query(`SELECT * FROM big_trades WHERE time >= $1 AND time < $2 ORDER BY time ASC`, [startTime, endTime]),
            query(`SELECT * FROM liquidation_events WHERE time >= $1 AND time < $2 ORDER BY time ASC`, [startTime, endTime]),
        ]);

        const events: any[] = [];

        // Normalize and merge
        obRes.rows.forEach(r => events.push({ type: 'orderbook', time: new Date(r.time).getTime(), data: r }));
        tradeRes.rows.forEach(r => events.push({ type: 'trade', time: new Date(r.time).getTime(), data: r }));
        liqRes.rows.forEach(r => events.push({ type: 'liquidation', time: new Date(r.time).getTime(), data: r }));

        return events.sort((a, b) => a.time - b.time);
    }
}

export const replayEngine = new ReplayEngine();
