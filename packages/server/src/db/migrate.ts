import { query } from './timescale.js';
import { logger } from '../logger.js';

/**
 * Run all database migrations — create hypertables for time-series data.
 * Safe to run multiple times (IF NOT EXISTS).
 */
export async function runMigrations(): Promise<void> {
  logger.info('Running database migrations...');

  // ── OHLCV Candles ──────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS ohlcv_candles (
      time        TIMESTAMPTZ NOT NULL,
      exchange    TEXT NOT NULL,
      symbol      TEXT NOT NULL,
      timeframe   TEXT NOT NULL,
      open        DOUBLE PRECISION NOT NULL,
      high        DOUBLE PRECISION NOT NULL,
      low         DOUBLE PRECISION NOT NULL,
      close       DOUBLE PRECISION NOT NULL,
      volume      DOUBLE PRECISION NOT NULL DEFAULT 0
    );
  `);
  await query(`
    SELECT create_hypertable('ohlcv_candles', 'time', if_not_exists => TRUE);
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_candles_sym_tf_unique
    ON ohlcv_candles (symbol, timeframe, time DESC);
  `);

  // ── Funding Snapshots ──────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS funding_snapshots (
      time        TIMESTAMPTZ NOT NULL,
      exchange    TEXT NOT NULL,
      symbol      TEXT NOT NULL,
      rate        DOUBLE PRECISION NOT NULL,
      oi_usd      DOUBLE PRECISION NOT NULL DEFAULT 0,
      vwaf        DOUBLE PRECISION
    );
  `);
  await query(`
    SELECT create_hypertable('funding_snapshots', 'time', if_not_exists => TRUE);
  `);

  // ── Options Snapshots ──────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS options_snapshots (
      time        TIMESTAMPTZ NOT NULL,
      symbol      TEXT NOT NULL,
      strike      DOUBLE PRECISION NOT NULL,
      expiry      TIMESTAMPTZ NOT NULL,
      type        TEXT NOT NULL CHECK (type IN ('call', 'put')),
      oi          DOUBLE PRECISION NOT NULL DEFAULT 0,
      iv          DOUBLE PRECISION,
      delta       DOUBLE PRECISION,
      gamma       DOUBLE PRECISION
    );
  `);
  await query(`
    SELECT create_hypertable('options_snapshots', 'time', if_not_exists => TRUE);
  `);

  // ── Liquidation Events ─────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS liquidation_events (
      time        TIMESTAMPTZ NOT NULL,
      exchange    TEXT NOT NULL,
      symbol      TEXT NOT NULL,
      price       DOUBLE PRECISION NOT NULL,
      size_usd    DOUBLE PRECISION NOT NULL,
      side        TEXT NOT NULL CHECK (side IN ('long', 'short'))
    );
  `);
  await query(`
    SELECT create_hypertable('liquidation_events', 'time', if_not_exists => TRUE);
  `);

  // ── Confluence Zones ───────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS confluence_zones (
      time        TIMESTAMPTZ NOT NULL,
      symbol      TEXT NOT NULL,
      price_low   DOUBLE PRECISION NOT NULL,
      price_high  DOUBLE PRECISION NOT NULL,
      center      DOUBLE PRECISION NOT NULL,
      score       DOUBLE PRECISION NOT NULL,
      strength    TEXT NOT NULL,
      reasons     JSONB NOT NULL DEFAULT '[]'
    );
  `);
  await query(`
    SELECT create_hypertable('confluence_zones', 'time', if_not_exists => TRUE);
  `);

  // ── Orderbook Snapshots ────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS orderbook_snapshots (
      time        TIMESTAMPTZ NOT NULL,
      exchange    TEXT NOT NULL,
      symbol      TEXT NOT NULL,
      bids        JSONB NOT NULL,
      asks        JSONB NOT NULL,
      walls       JSONB NOT NULL
    );
  `);
  await query(`
    SELECT create_hypertable('orderbook_snapshots', 'time', if_not_exists => TRUE);
  `);

  // ── Big Trades ─────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS big_trades (
      time        TIMESTAMPTZ NOT NULL,
      exchange    TEXT NOT NULL,
      symbol      TEXT NOT NULL,
      price       DOUBLE PRECISION NOT NULL,
      qty         DOUBLE PRECISION NOT NULL,
      side        TEXT NOT NULL CHECK (side IN ('buy', 'sell'))
    );
  `);
  await query(`
    SELECT create_hypertable('big_trades', 'time', if_not_exists => TRUE);
  `);

  logger.info('Migrations complete — 7 hypertables ready');
}
