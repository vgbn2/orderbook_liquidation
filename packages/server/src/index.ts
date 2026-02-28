import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import { config } from './config.js';
import { logger } from './logger.js';
import { dbHealthCheck, closeDb } from './db/timescale.js';
import { redis, redisSub, redisHealthCheck, closeRedis } from './db/redis.js';
import { runMigrations } from './db/migrate.js';
import { wsManager } from './ws/manager.js';
import { clientHub } from './ws/client-hub.js';
import { binanceAdapter } from './adapters/binance.js';
import { startBybit, stopBybit } from './adapters/bybit.js';
import { startOkx, stopOkx } from './adapters/okx.js';
import { startDeribit, stopDeribit } from './adapters/deribit.js';
import { ohlcvRoutes } from './routes/ohlcv.js';
import { optionsEngine, generateSimulatedChain, generateSimulatedTrade } from './engines/options.js';
import { liquidationEngine, generateSimulatedLiquidation, seedLiquidationHistory } from './engines/liquidations.js';
import { vwafEngine, generateSimulatedFunding } from './engines/vwaf.js';
import { confluenceEngine } from './engines/confluence.js';
import { alertsEngine } from './engines/alerts.js';
import { replayEngine } from './engines/replay.js';
import { quantEngine } from './engines/quant.js';

// ══════════════════════════════════════════════════════════════
//  Server Bootstrap
// ══════════════════════════════════════════════════════════════

let globalSymbol = 'BTCUSDT';

const app = Fastify({
    logger: false, // We use our own pino logger
});

async function start(): Promise<void> {
    // ── Register plugins ──────────────────────────
    await app.register(fastifyCors, { origin: true });
    await app.register(fastifyWebsocket);

    // ── Connect infrastructure ────────────────────
    logger.info('Connecting to Redis...');
    await redis.connect();
    await redisSub.connect();

    // Fix S6: Use Redis subscriber for distributed alerts/signals
    redisSub.subscribe('TERMINUS_ALERTS', (err) => {
        if (err) logger.error('Failed to subscribe to TERMINUS_ALERTS');
    });

    redisSub.on('message', (channel, message) => {
        if (channel === 'TERMINUS_ALERTS') {
            try {
                const parse = JSON.parse(message);
                clientHub.broadcast('alerts' as any, parse);
            } catch { /* ignore */ }
        }
    });

    logger.info('Connecting to TimescaleDB...');
    // Pool connects lazily on first query, but let's verify
    const dbOk = await dbHealthCheck();
    if (!dbOk) {
        logger.error('TimescaleDB is not reachable. Is Docker running?');
        process.exit(1);
    }

    // ── Run migrations ────────────────────────────
    await runMigrations();

    // ── Register routes ──────────────────────────
    await app.register(ohlcvRoutes);

    // ── Connect exchange adapters ────────────────
    logger.info('Connecting to Binance...');
    await binanceAdapter.connect();

    logger.info('Connecting to Bybit...');
    startBybit(globalSymbol);

    logger.info('Connecting to OKX...');
    startOkx(globalSymbol);

    logger.info('Connecting to Deribit...');
    startDeribit(globalSymbol);

    // Fetch initial historical candles
    const historicalCandles = await binanceAdapter.fetchKlines(globalSymbol, '1m', 500);
    if (historicalCandles.length > 0) {
        await redis.set(`candles:${globalSymbol}:1m`, JSON.stringify(historicalCandles), 'EX', 300);
        logger.info({ count: historicalCandles.length }, 'Historical candles cached');
    }

    // Connect orderbook depth stream
    logger.info('Connecting to Binance orderbook depth...');
    await binanceAdapter.connectOrderbook();

    // Connect trades stream
    logger.info('Connecting to Binance trades...');
    await binanceAdapter.connectTrades();

    // Start polling for funding & OI
    binanceAdapter.startPolling();

    // Start Quant Engine (macro analysis — runs every 1hr)
    quantEngine.start();

    // Init alerts engine spot
    alertsEngine.setSpot(historicalCandles[historicalCandles.length - 1]?.close || 95000);

    // ── Options engine (simulated in dev, Deribit in prod) ──
    const latestPrice = historicalCandles.length > 0
        ? historicalCandles[historicalCandles.length - 1].close
        : 95000;
    optionsEngine.setSpot(latestPrice);
    optionsEngine.loadChain(generateSimulatedChain(latestPrice));
    optionsEngine.startBroadcast();
    logger.info('Options analytics engine started');

    // Refresh simulated options chain every 20s
    setInterval(() => {
        const priceStr = redis.get(`price:${globalSymbol}`).catch(() => null);
        priceStr.then((p) => {
            const spot = p ? parseFloat(p) : latestPrice;
            optionsEngine.setSpot(spot);
            optionsEngine.loadChain(generateSimulatedChain(spot));
        });
    }, 20_000);

    // Simulate occasional large trades
    setInterval(() => {
        redis.get(`price:${globalSymbol}`).then((p) => {
            const spot = p ? parseFloat(p) : latestPrice;
            const trade = generateSimulatedTrade(spot);
            clientHub.broadcast('options.large_trade' as any, trade);
        }).catch(() => { });
    }, 8_000 + Math.random() * 12_000);

    // ── Liquidation engine ──────────────────────────
    liquidationEngine.setSpot(latestPrice);
    const seedEvents = seedLiquidationHistory(latestPrice, 80);
    for (const ev of seedEvents) {
        liquidationEngine.addEvent(ev);
    }
    liquidationEngine.startBroadcast();
    logger.info('Liquidation engine started');

    // Simulate periodic liquidation events
    setInterval(() => {
        redis.get(`price:${globalSymbol}`).then((p) => {
            const spot = p ? parseFloat(p) : latestPrice;
            liquidationEngine.setSpot(spot);
            if (Math.random() < 0.6) {
                const ev = generateSimulatedLiquidation(spot);
                liquidationEngine.addEvent(ev);
                alertsEngine.checkLiquidation(ev);
            }
        }).catch(() => { });
    }, 2_000);

    // ── VWAF Engine (simulated funding) ────────────
    const initialFunding = generateSimulatedFunding();
    for (const snap of initialFunding) {
        vwafEngine.update(snap);
    }
    vwafEngine.startBroadcast();
    logger.info('VWAF engine started');

    // Refresh simulated funding every 10s
    setInterval(() => {
        const funding = generateSimulatedFunding();
        for (const snap of funding) {
            vwafEngine.update(snap);
        }
    }, 10_000);

    // ── Confluence Engine ──────────────────────────
    confluenceEngine.setSpot(latestPrice);
    confluenceEngine.startBroadcast();
    logger.info('Confluence engine started');

    // Feed confluence engine with data from other engines every 4s
    setInterval(() => {
        redis.get(`price:${globalSymbol}`).then((p) => {
            const spot = p ? parseFloat(p) : latestPrice;
            alertsEngine.setSpot(spot);
            confluenceEngine.setSpot(spot);

            // Feed orderbook (was missing entirely)
            redis.get('orderbook.aggregated').then((raw) => {
                if (raw) {
                    const ob = JSON.parse(raw);
                    confluenceEngine.setOrderbook(ob);
                    alertsEngine.checkWalls(ob);
                }
            }).catch(() => { });

            // Feed options data
            const optData = optionsEngine.getLatest?.();
            if (optData) confluenceEngine.setOptions(optData);

            // Feed liquidation heatmap
            const liqHeatmap = liquidationEngine.getHeatmap?.();
            if (liqHeatmap) confluenceEngine.setLiqHeatmap(liqHeatmap);

            // Feed VWAF data
            const vwafData = vwafEngine.compute();
            if (vwafData) {
                confluenceEngine.setVWAF(vwafData);
                alertsEngine.checkFunding(vwafData);
            }

            // Check alerts for confluence and walls
            const confZones = confluenceEngine.getZones?.();
            if (confZones) alertsEngine.checkConfluence(confZones);

        }).catch(() => { });
    }, 4_000);

    // ── Health endpoint ───────────────────────────
    app.get('/health', async (_req, reply) => {
        const db = await dbHealthCheck();
        const rd = await redisHealthCheck();
        const exchanges = wsManager.getAllHealth();
        const wsStats = clientHub.getStats();

        const status = db && rd ? 'healthy' : 'degraded';

        return reply.code(status === 'healthy' ? 200 : 503).send({
            status,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            services: {
                timescaledb: db ? 'up' : 'down',
                redis: rd ? 'up' : 'down',
                exchanges,
            },
            clients: wsStats,
        });
    });

    // ── WebSocket endpoint for frontend clients ───
    app.register(async function (fastify) {
        fastify.get('/ws', { websocket: true }, (socket, _req) => {
            const clientId = clientHub.addClient(socket);

            // On connect, send a snapshot of current state from Redis
            (async () => {
                try {
                    const topics = [
                        'orderbook.aggregated',
                        'vwaf',
                        'options.analytics',
                        'liquidations',
                        'confluence',
                    ] as const;

                    for (const topic of topics) {
                        const cached = await redis.get(topic);
                        if (cached) {
                            clientHub.sendToClient(clientId, topic, JSON.parse(cached));
                        }
                    }
                } catch (err) {
                    logger.error({ clientId, err }, 'Failed to send initial snapshot');
                }
            })();

            // Listen for client-side actions (like Replay)
            socket.on('message', (raw) => {
                try {
                    const msg = JSON.parse(raw.toString());
                    if (msg.action === 'start_replay') {
                        replayEngine.startSession(clientId, msg.config);
                    } else if (msg.action === 'stop_replay') {
                        replayEngine.stopSession(clientId);
                    } else if (msg.action === 'switch_symbol') {
                        const newSymbol = msg.symbol;
                        globalSymbol = newSymbol.toUpperCase();
                        logger.info(`Switching global market to ${globalSymbol}`);

                        stopBybit(globalSymbol);
                        stopOkx(globalSymbol);
                        stopDeribit(globalSymbol);
                        startBybit(globalSymbol);
                        startOkx(globalSymbol);
                        startDeribit(globalSymbol);

                        binanceAdapter.switchSymbol(globalSymbol).then(() => {
                            binanceAdapter.fetchKlines(globalSymbol, '1m', 500).then(candles => {
                                if (candles.length > 0) {
                                    redis.set(`candles:${globalSymbol}:1m`, JSON.stringify(candles), 'EX', 300);
                                    const spot = candles[candles.length - 1].close;
                                    alertsEngine.setSpot(spot);
                                    optionsEngine.setSpot(spot);
                                    optionsEngine.loadChain(generateSimulatedChain(spot));
                                    liquidationEngine.setSpot(spot);
                                    confluenceEngine.setSpot(spot);
                                    vwafEngine.clear();
                                }
                                clientHub.broadcast('symbol_changed' as any, { symbol: globalSymbol });
                            });
                        });
                    }
                } catch (err) {
                    // Ignore malformed
                }
            });

            socket.on('close', () => {
                replayEngine.stopSession(clientId);
            });
        });
    });

    // ── Start listening ───────────────────────────
    await app.listen({ port: config.PORT, host: config.HOST });
    logger.info({ port: config.PORT, host: config.HOST }, '🚀 TERMINUS server running');
}

// ══════════════════════════════════════════════════════════════
//  Graceful Shutdown
// ══════════════════════════════════════════════════════════════

async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Received shutdown signal — cleaning up...');

    // 1. Stop accepting new connections
    await app.close();

    // 2. Stop engines
    optionsEngine.stop();
    liquidationEngine.stop();
    vwafEngine.stop();
    confluenceEngine.stop();

    // 3. Disconnect exchange adapters
    await binanceAdapter.disconnect();
    stopBybit(globalSymbol);
    stopOkx(globalSymbol);
    stopDeribit(globalSymbol);
    await wsManager.disconnectAll();

    // 3. Close database connections
    await closeRedis();
    await closeDb();

    logger.info('Shutdown complete');
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    shutdown('unhandledRejection');
});

// ── Start ───────────────────────────────────────
start().catch((err) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
});
