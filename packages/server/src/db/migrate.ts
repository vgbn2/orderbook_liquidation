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
    DROP INDEX IF EXISTS idx_candles_sym_tf_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_candles_sym_tf_unique
    ON ohlcv_candles (symbol, timeframe, time);
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

  // ── Aggregated VWAP Candles ─────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS aggregated_candles (
      time          TIMESTAMPTZ NOT NULL,
      symbol        TEXT NOT NULL,
      interval_sec  INTEGER NOT NULL,
      open          DOUBLE PRECISION NOT NULL,
      high          DOUBLE PRECISION NOT NULL,
      low           DOUBLE PRECISION NOT NULL,
      close         DOUBLE PRECISION NOT NULL,
      volume        DOUBLE PRECISION NOT NULL DEFAULT 0,
      quote_volume  DOUBLE PRECISION NOT NULL DEFAULT 0,
      vwap          DOUBLE PRECISION NOT NULL,
      trade_count   INTEGER NOT NULL DEFAULT 0
    );
  `);
  await query(`
    SELECT create_hypertable('aggregated_candles', 'time', if_not_exists => TRUE);
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_candles_unique
    ON aggregated_candles (symbol, interval_sec, time DESC);
  `);

  // ── Missing Indexes on Hypertables ───────────────
  await query(`
    CREATE INDEX IF NOT EXISTS idx_liq_symbol_time ON liquidation_events (symbol, time DESC);
    CREATE INDEX IF NOT EXISTS idx_trades_symbol_time ON big_trades (symbol, time DESC);
    CREATE INDEX IF NOT EXISTS idx_ob_symbol_time ON orderbook_snapshots (symbol, time DESC);
  `);

  // ── Compression Setup ───────────────────────────
  await query(`
    ALTER TABLE big_trades SET (timescaledb.compress, timescaledb.compress_segmentby = 'symbol');
    ALTER TABLE ohlcv_candles SET (timescaledb.compress, timescaledb.compress_segmentby = 'symbol');
    ALTER TABLE orderbook_snapshots SET (timescaledb.compress, timescaledb.compress_segmentby = 'symbol');
    ALTER TABLE liquidation_events SET (timescaledb.compress, timescaledb.compress_segmentby = 'symbol');
    ALTER TABLE aggregated_candles SET (timescaledb.compress, timescaledb.compress_segmentby = 'symbol');
  `);

  // ── Compression Policies ─────────────────────────
  await query(`
    SELECT add_compression_policy('big_trades', INTERVAL '7 days', if_not_exists => true);
    SELECT add_compression_policy('ohlcv_candles', INTERVAL '30 days', if_not_exists => true);
    SELECT add_compression_policy('orderbook_snapshots', INTERVAL '3 days', if_not_exists => true);
    SELECT add_compression_policy('liquidation_events', INTERVAL '14 days', if_not_exists => true);
    SELECT add_compression_policy('aggregated_candles', INTERVAL '30 days', if_not_exists => true);
  `);

  // ── Retention Policies ───────────────────────────
  await query(`
    SELECT add_retention_policy('big_trades', INTERVAL '30 days', if_not_exists => true);
    SELECT add_retention_policy('orderbook_snapshots', INTERVAL '14 days', if_not_exists => true);
    SELECT add_retention_policy('ohlcv_candles', INTERVAL '2 years', if_not_exists => true);
    SELECT add_retention_policy('liquidation_events', INTERVAL '1 year', if_not_exists => true);
    SELECT add_retention_policy('aggregated_candles', INTERVAL '1 year', if_not_exists => true);
    SELECT add_retention_policy('funding_snapshots', INTERVAL '1 year', if_not_exists => true);
    SELECT add_retention_policy('confluence_zones', INTERVAL '30 days', if_not_exists => true);
  `);

  // ── Users (Phase 1) ──────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      last_seen   TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── User Preferences ─────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key         TEXT NOT NULL,
      value       JSONB NOT NULL,
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, key)
    );
  `);

  // ── Watchlist ────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS watchlist_items (
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol      TEXT NOT NULL,
      position    INTEGER NOT NULL DEFAULT 0,
      added_at    TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, symbol)
    );
  `);

  // ── Alerts ───────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol      TEXT NOT NULL,
      condition   TEXT NOT NULL,
      threshold   DOUBLE PRECISION,
      is_active   BOOLEAN DEFAULT TRUE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS alert_history (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      alert_id         UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
      user_id          TEXT NOT NULL,
      triggered_at     TIMESTAMPTZ DEFAULT NOW(),
      price_at_trigger DOUBLE PRECISION,
      message          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_alert_history_user ON alert_history (user_id, triggered_at DESC);
  `);

  // ── Trade Journal ────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol                TEXT NOT NULL,
      side                  TEXT CHECK (side IN ('long', 'short')),
      entry_price           DOUBLE PRECISION NOT NULL,
      exit_price            DOUBLE PRECISION,
      size_usd              DOUBLE PRECISION NOT NULL,
      entry_at              TIMESTAMPTZ NOT NULL,
      exit_at               TIMESTAMPTZ,
      pnl_usd               DOUBLE PRECISION,
      pnl_pct               DOUBLE PRECISION,
      setup_tags            TEXT[] DEFAULT '{}',
      notes                 TEXT,
      quant_bias_at_entry   TEXT,
      quant_drift_at_entry  DOUBLE PRECISION,
      created_at            TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_journal_user_time ON journal_entries (user_id, entry_at DESC);
  `);

  // ── Strategies ───────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS strategies (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      config_json JSONB NOT NULL,
      is_public   BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS backtest_runs (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      strategy_id  UUID REFERENCES strategies(id) ON DELETE SET NULL,
      symbol       TEXT NOT NULL,
      timeframe    TEXT NOT NULL,
      start_date   TIMESTAMPTZ,
      end_date     TIMESTAMPTZ,
      total_return DOUBLE PRECISION,
      max_drawdown DOUBLE PRECISION,
      win_rate     DOUBLE PRECISION,
      sharpe       DOUBLE PRECISION,
      trade_count  INTEGER,
      result_json  JSONB,
      ran_at       TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_backtest_user ON backtest_runs (user_id, ran_at DESC);
  `);

  // ── Chart Drawings ───────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS chart_drawings (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol      TEXT NOT NULL,
      timeframe   TEXT NOT NULL,
      type        TEXT NOT NULL,
      coords_json JSONB NOT NULL,
      label       TEXT,
      color       TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_drawings_user_sym ON chart_drawings (user_id, symbol, timeframe);
  `);

  logger.info('Migrations complete — Schema updated to Phase 1');
}
