import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import jwt from 'jsonwebtoken';
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
import { startHyperliquid, stopHyperliquid } from './adapters/hyperliquid.js';
import { startBitget, stopBitget } from './adapters/bitget.js';
import { startGateio, stopGateio } from './adapters/gateio.js';
import { ohlcvRoutes } from './routes/ohlcv.js';
import { optionsEngine, generateSimulatedChain, generateSimulatedTrade } from './engines/analytics/options.js';
import { liquidationEngine, generateSimulatedLiquidation, seedLiquidationHistory } from './engines/signals/liquidations.js';
import { vwafEngine, generateSimulatedFunding } from './engines/analytics/vwaf.js';
import { confluenceEngine } from './engines/signals/confluence.js';
import { ictEngine } from './engines/signals/ict.js';
import { alertsEngine } from './engines/signals/alerts.js';
import { replayEngine } from './engines/core/replay.js';
import { quantEngine } from './engines/analytics/quant.js';
// import { clerkPlugin } from '@clerk/fastify';
import { userRoutes } from './routes/user.js';

// ══════════════════════════════════════════════════════════════
//  Server Bootstrap
// ══════════════════════════════════════════════════════════════

let globalSymbol = 'BTCUSDT';

const app = Fastify({
    logger: false, // We use our own pino logger
    trustProxy: false // Explicitly disable proxy trust to prevent HIGH-2 (IP Spoofing)
});

async function start(): Promise<void> {
    // ── Register plugins ──────────────────────────
    await app.register(fastifyCors, { origin: true });
    await app.register(fastifyWebsocket);

    // ── Connect infrastructure ────────────────────
    logger.info('Connecting to Redis...');
    await redis.connect().catch((err) => {
        logger.warn({ err: err.message }, 'Redis initial connect failed, will retry in background');
    });

    await redisSub.connect().catch((err) => {
        logger.warn({ err: err.message }, 'Redis Sub initial connect failed, will retry in background');
    });

    // Fix S6: Use Redis subscriber for distributed alerts/signals
    try {
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
    } catch (err) {
        logger.error({ err }, 'Redis PubSub initialization failed');
    }

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
    // await app.register(clerkPlugin);
    await app.register(ohlcvRoutes);
    await app.register(userRoutes, { prefix: '/api/user' });

    // ── Connect exchange adapters ────────────────
    logger.info('Connecting to Binance...');
    await binanceAdapter.connect();

    logger.info('Connecting to Bybit...');
    startBybit(globalSymbol);

    logger.info('Connecting to OKX...');
    startOkx(globalSymbol);

    logger.info('Connecting to Deribit...');
    startDeribit(globalSymbol);

    if (config.ENABLE_HYPERLIQUID) {
        logger.info('Connecting to Hyperliquid...');
        startHyperliquid(globalSymbol);
    }
    // if (config.ENABLE_MEXC) {
    //     logger.info('Connecting to MEXC...');
    //     startMexc(globalSymbol);
    // }
    if (config.ENABLE_BITGET) {
        logger.info('Connecting to Bitget...');
        startBitget(globalSymbol);
    }
    if (config.ENABLE_GATEIO) {
        logger.info('Connecting to Gateio...');
        startGateio(globalSymbol);
    }

    // Fetch initial historical candles for all timeframes
    const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
    let initialCandles: any[] = [];
    for (const tf of timeframes) {
        try {
            // Speed up startup: Fetch first 100 immediately to unblock initialization
            const candles = await binanceAdapter.fetchKlines(globalSymbol, tf, 100);
            if (candles.length > 0) {
                await redis.set(`candles:${globalSymbol}:${tf}`, JSON.stringify(candles), 'EX', 3600);
                logger.info({ count: candles.length, timeframe: tf }, 'Initial 100 historical candles cached');
                if (tf === '1m') initialCandles = candles;

                // Then fetch the remaining in the background to fill up to 1500
                (async () => {
                    try {
                        const fullHistory = await binanceAdapter.fetchKlines(globalSymbol, tf, 1500);
                        if (fullHistory.length > candles.length) {
                            await redis.set(`candles:${globalSymbol}:${tf}`, JSON.stringify(fullHistory), 'EX', 3600);
                            logger.info({ count: fullHistory.length, timeframe: tf }, 'Full historical history background cached');
                        }
                    } catch (err) {
                        logger.error({ err, tf }, 'Background historical fetch failed');
                    }
                })();
            }
        } catch (err) {
            logger.error({ err, tf }, 'Failed to fetch initial historical candles');
        }
    }

    // Keep 1m fresh via fetchKlines merges
    setInterval(async () => {
        try {
            const latest = await binanceAdapter.fetchKlines(globalSymbol, '1m', 10);
            const existingStr = await redis.get(`candles:${globalSymbol}:1m`);
            let existing: any[] = existingStr ? JSON.parse(existingStr) : [];

            const existingMap = new Map<number, any>(existing.map(c => [c.time, c]));
            for (const c of latest) {
                existingMap.set(c.time, c);
            }
            const merged = Array.from(existingMap.values()).sort((a, b) => a.time - b.time);
            await redis.set(`candles:${globalSymbol}:1m`, JSON.stringify(merged), 'EX', 3600);
        } catch (err) {
            logger.error({ err }, 'Failed to refresh 1m candles');
        }
    }, 60_000);

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

    // ── Options engine (simulated in dev, Deribit in prod) ──
    const latestPrice = initialCandles.length > 0
        ? initialCandles[initialCandles.length - 1].close
        : 95000;
    optionsEngine.setSpot(latestPrice);
    alertsEngine.setSpot(latestPrice);
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
            if (liqHeatmap) {
                confluenceEngine.setLiqHeatmap(liqHeatmap);
                ictEngine.setLiqHeatmap(liqHeatmap);
            }

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

    const SYMBOL_WHITELIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'LINKUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT'];
    const LAST_SYMBOL_SWITCH = new Map<string, number>();

    // ── Health endpoint ───────────────────────────
    app.get('/health', async (req, reply) => {
        // Fix HIGH-4: Authenticate health check
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== config.TERMINUS_API_KEY) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
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

    app.post('/api/token', async (req: any, reply) => {
        // Fix CRIT-1: Authenticate token issuance
        const apiKey = req.body?.apiKey || req.headers['x-api-key'];

        if (!apiKey || apiKey !== config.TERMINUS_API_KEY) {
            logger.warn({ ip: req.ip }, 'Unauthorized attempt to fetch JWT');
            return reply.code(401).send({ error: 'Invalid API Key' });
        }

        const token = jwt.sign(
            { role: 'pro_trader', access: 'full' },
            config.JWT_SECRET,
            { expiresIn: '1h' }
        );
        return reply.send({ token });
    });

    // ── WebSocket endpoint for frontend clients ───
    app.register(async function (fastify) {
        fastify.get('/ws', { websocket: true }, async (socket, req) => {
            // FIX 5: JWT Authentication
            const queryParam = new URLSearchParams(req.url.split('?')[1] || '');
            const token = queryParam.get('token');

            if (!token) {
                logger.warn({ ip: req.ip }, 'WebSocket connection rejected: No token provided');
                socket.close(4001, 'Unauthorized');
                return;
            }

            try {
                // Verify Fastify API token or Clerk token
                if (token !== config.TERMINUS_API_KEY) { // In a real app we'd verify Clerk JWKS here
                    jwt.verify(token, config.JWT_SECRET);
                }
            } catch (err) {
                logger.warn({ ip: req.ip }, 'WebSocket connection rejected: Invalid token');
                socket.close(4003, 'Forbidden');
                return;
            }

            const clientId = clientHub.addClient(socket, req);

            // If connection was rejected (e.g. rate limit), clientId is null
            if (!clientId) return;

            // On connect, send a snapshot of current state from Redis
            (async () => {
                try {
                    const topics = [
                        'orderbook.aggregated',
                        'vwaf',
                        'options.analytics',
                        'liquidations',
                        'confluence',
                        `ict.data.${globalSymbol}.1m`,
                        `ict.data.${globalSymbol}.5m`,
                        `ict.data.${globalSymbol}.15m`,
                        `ict.data.${globalSymbol}.1h`,
                        `ict.data.${globalSymbol}.4h`,
                        `ict.data.${globalSymbol}.1d`,
                        'liquidations.heatmap'
                    ] as const;

                    for (const topic of topics) {
                        const cached = await redis.get(topic);
                        if (cached) {
                            clientHub.sendToClient(clientId, topic as any, JSON.parse(cached));
                        }
                    }

                    // Send quant snapshot correctly
                    const quantCached = await redis.get(`quant:analytics:${globalSymbol}`);
                    if (quantCached) {
                        clientHub.sendToClient(
                            clientId,
                            `quant.analytics.${globalSymbol}` as any,
                            JSON.parse(quantCached)
                        );
                    }

                    // Send HTF candles specially
                    for (const tf of ['4h', '1d'] as const) {
                        const htfStr = await redis.get(`candles:${globalSymbol}:${tf}`);
                        if (htfStr) {
                            clientHub.sendToClient(clientId, `candles.binance.${globalSymbol}.${tf}` as any, JSON.parse(htfStr));
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
                        // Fix CRIT-2: Harden switch_symbol
                        const newSymbol = msg.symbol;

                        // 1. Validation
                        if (!newSymbol || typeof newSymbol !== 'string' || newSymbol.length > 20) {
                            return;
                        }

                        const normalized = newSymbol.toUpperCase().trim();
                        if (!SYMBOL_WHITELIST.includes(normalized)) {
                            logger.warn({ clientId, normalized }, 'Client attempted to switch to unauthorized symbol');
                            return;
                        }

                        // 2. Rate Limiting (per connection)
                        const now = Date.now();
                        const lastSwitch = LAST_SYMBOL_SWITCH.get(clientId) || 0;
                        if (now - lastSwitch < 5000) {
                            logger.warn({ clientId }, 'Symbol switch throttled');
                            return;
                        }
                        LAST_SYMBOL_SWITCH.set(clientId, now);

                        if (normalized === globalSymbol) return;

                        const oldSymbol = globalSymbol;
                        globalSymbol = normalized;
                        logger.info(`Switching global market to ${globalSymbol}`);

                        stopBybit(oldSymbol);
                        stopOkx(oldSymbol);
                        stopDeribit(oldSymbol);
                        stopHyperliquid(oldSymbol);
                        // stopMexc(oldSymbol);
                        stopBitget(oldSymbol);
                        stopGateio(oldSymbol);

                        startBybit(globalSymbol);
                        startOkx(globalSymbol);
                        startDeribit(globalSymbol);
                        startHyperliquid(globalSymbol);
                        // startMexc(globalSymbol);
                        startBitget(globalSymbol);
                        startGateio(globalSymbol);

                        quantEngine.switchSymbol(globalSymbol);

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
    stopHyperliquid(globalSymbol);
    // stopMexc(globalSymbol);
    stopBitget(globalSymbol);
    stopGateio(globalSymbol);
    await wsManager.disconnectAll();

    // 3. Close database connections
    await closeRedis();
    await closeDb();

    logger.info('Shutdown complete');
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err: any) => {
    // Some errors (like ECONNRESET) should NOT crash the server if they happen in background tasks
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
        logger.warn({ err }, 'Handled uncaught network exception (preventing crash)');
        return;
    }

    logger.fatal({ err }, 'Uncaught exception - shutting down');
    shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: any) => {
    // Log but don't necessarily crash on empty or minor rejections
    if (!reason || Object.keys(reason).length === 0) {
        logger.warn('Empty unhandledRejection detected (preventing crash)');
        return;
    }

    logger.fatal({ reason }, 'Unhandled rejection - shutting down');
    shutdown('unhandledRejection');
});

// ── Start ───────────────────────────────────────
start().catch((err) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
});
