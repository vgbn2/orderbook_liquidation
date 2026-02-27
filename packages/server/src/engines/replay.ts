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
        this.stopSession(clientId);

        logger.info({ clientId, config }, 'Starting replay session');

        const session = {
            config,
            currentTime: config.startTime,
            timer: null as any
        };

        this.activeSessions.set(clientId, session);

        // Tick every 500ms real-time
        const realTick = 500;
        const simTick = realTick * config.speed;

        session.timer = setInterval(async () => {
            const current = this.activeSessions.get(clientId);
            if (!current) return;

            const nextTime = current.currentTime + simTick;
            if (nextTime > config.endTime) {
                this.stopSession(clientId);
                clientHub.sendToClient(clientId, 'replay' as any, { type: 'END' });
                return;
            }

            // Fetch data between current and nextTime
            try {
                const data = await this.fetchRange(current.currentTime, nextTime);
                if (data.length > 0) {
                    clientHub.sendToClient(clientId, 'replay' as any, {
                        type: 'BATCH',
                        timestamp: current.currentTime,
                        events: data
                    });
                }
                current.currentTime = nextTime;
            } catch (err) {
                logger.error({ err }, 'Replay fetch error');
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
