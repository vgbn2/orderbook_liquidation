import { logger } from '../logger.js';
import { clientHub } from '../ws/client-hub.js';
import { redis } from '../db/redis.js';
import {
    Trade,
    LiquidationEvent,
    AggregatedOrderbook,
    ConfluenceZone,
    VWAFData
} from '../adapters/types.js';

export interface Alert {
    id: string;
    time: number;
    type: 'WALL' | 'LIQ' | 'CONF' | 'FUNDING' | 'TRADE' | 'AMD';
    severity: 'info' | 'warn' | 'critical';
    message: string;
    price?: number;
    direction?: 'BULLISH' | 'BEARISH';
}

class AlertsEngine {
    private lastSpot: number = 0;
    private activeAlerts: Alert[] = [];

    setSpot(price: number) {
        this.lastSpot = price;
    }

    /**
     * Monitor for Wall penetrations
     */
    checkWalls(ob: AggregatedOrderbook) {
        const threshold = 0.0005; // 0.05% proximity
        const walls = [...ob.walls.bid_walls, ...ob.walls.ask_walls];

        for (const wall of walls) {
            const proximity = Math.abs(this.lastSpot - wall.price) / this.lastSpot;
            if (proximity < threshold) {
                this.triggerAlert({
                    type: 'WALL',
                    severity: wall.pct > 5 ? 'critical' : 'warn',
                    message: `Price approaching ${wall.side === 'bid' ? 'Support' : 'Resistance'} wall at ${wall.price}`,
                    price: wall.price
                });
            }
        }
    }

    /**
     * Check for whale liquidations
     */
    checkLiquidation(ev: LiquidationEvent) {
        if (ev.size_usd >= 100000) {
            this.triggerAlert({
                type: 'LIQ',
                severity: ev.size_usd >= 500000 ? 'critical' : 'warn',
                message: `Whale ${ev.side.toUpperCase()} Liq: $${(ev.size_usd / 1000).toFixed(0)}k at ${ev.price}`,
                price: ev.price
            });
        }
    }

    /**
     * Check for high confluence zones
     */
    checkConfluence(zones: ConfluenceZone[]) {
        for (const zone of zones) {
            if (zone.strength === 'high' && this.lastSpot >= zone.price_low && this.lastSpot <= zone.price_high) {
                this.triggerAlert({
                    type: 'CONF',
                    severity: 'critical',
                    message: `Price entered HIGH CONFLUENCE zone (${zone.center})`,
                    price: zone.center
                });
            }
        }
    }

    /**
     * Check for funding divergence
     */
    checkFunding(data: VWAFData) {
        if (Math.abs(data.vwaf_annualized) > 30) {
            this.triggerAlert({
                type: 'FUNDING',
                severity: 'warn',
                message: `High Funding Divergence: ${data.vwaf_annualized.toFixed(2)}% annualized`,
            });
        }
    }

    private triggerAlert(a: Omit<Alert, 'id' | 'time'>) {
        // Simple de-duping (don't repeat very similar alerts in short window)
        const now = Date.now();
        const exists = this.activeAlerts.some(
            existing => existing.type === a.type &&
                Math.abs(existing.time - now) < 60000 && // 1 min cool down per type
                existing.message === a.message
        );

        if (exists) return;

        const alert: Alert = {
            ...a,
            id: Math.random().toString(36).substring(7),
            time: now,
        };

        this.activeAlerts.push(alert);
        if (this.activeAlerts.length > 50) this.activeAlerts.shift();

        logger.info({ alert }, 'New Market Alert');
        clientHub.broadcast('alerts' as any, alert);
        redis.set('alerts:latest', JSON.stringify(this.activeAlerts)).catch(() => { });
    }
}

export const alertsEngine = new AlertsEngine();
