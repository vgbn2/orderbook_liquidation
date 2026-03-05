# TERMINUS — Product Roadmap
> Ordered by value delivered per effort. Each phase is independently shippable.

---

## Current State (as of 2026-03)
```
✅ Working:  Live chart, multi-exchange WS, orderbook, liquidation heatmap,
             ICT overlays, backtester, quant analytics (Python), options GEX,
             replay engine skeleton, TimescaleDB schema + liquidation write pipeline,
             Redis caching, JWT auth config present in server
❌ Broken:   6 bugs blocking symbol switching / formatting (see CODEBASE.md)
             Replay pause button dead
             QuantPanel crashes on null sigmaGrid
⚠️  Partial:  User accounts configured but no signup/login routes
              QuantSummary built but not wired in
              TimescaleDB connected but only liquidation_events being written
```

---

## Phase 0 — Stabilization (1 session, ~2 hours)
> Fix the structural bugs that generate noise on every feature you build.
> Do this before anything else or every new feature will inherit the bugs.

```
[ ] BUG-2  Move useMemo above early return in LiquidationPanel.tsx
[ ] BUG-4  Add onClick to ReplayPanel pause button
[ ] BUG-8  Add --space-1/2/3/4 and --radius-sm to index.css
[ ] BUG-1  Add missing symbols to SYMBOL_WHITELIST in server/index.ts:293
[ ] BUG-3  Add 7 missing store clears to handleSelectMarket in TerminusNav.tsx
[ ] BUG-6  Add null guard on sigmaGrid before BellCurveChart render in QuantPanel.tsx
[ ] BUG-5  Create formatPrice(v) utility, replace all .toFixed(1) in Orderbook + ExchangePage
```

---

## Phase 1 — User Accounts (3-5 days)
> Foundation everything else depends on. Use Clerk for auth — do not build auth yourself.

### 1A. Auth Integration (1 day)
```
Tool: Clerk (https://clerk.com) — React SDK, takes ~2 hours to wire up
      Handles: signup, login, sessions, JWTs, social login, MFA

Backend changes:
  [ ] Install @clerk/fastify
  [ ] Add clerkMiddleware to Fastify
  [ ] Verify JWT on WS upgrade (already have JWT_SECRET in config)
  [ ] Extract userId from token, attach to client connection in client-hub.ts

Frontend changes:
  [ ] Install @clerk/react
  [ ] Wrap App in <ClerkProvider>
  [ ] Add <SignIn> / <SignUp> pages (Clerk provides components)
  [ ] Add user avatar + menu to TerminusNav (top right)
```

### 1B. User Preferences Sync (1 day)
```
What: Replace localStorage with DB-backed preferences. Settings sync across devices.

DB table (add to migrate.ts):
  CREATE TABLE user_preferences (
    user_id     TEXT NOT NULL,
    key         TEXT NOT NULL,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, key)
  );

Keys to sync:
  'watchlist'        — custom symbol list
  'layout'           — rightPanelWidth, orderbookHeight, showOrderbook
  'indicators'       — active indicator set
  'default_tfs'      — { BTCUSDT: '1h', ETHUSDT: '4h' }
  'theme'            — dark/light
  'notifications'    — notification level

API routes (add to routes/):
  GET  /api/prefs          → return all user prefs
  PUT  /api/prefs/:key     → upsert single pref
  
Frontend:
  On login: fetch /api/prefs, hydrate stores
  On every settings change: PUT /api/prefs/:key (debounced 1s)
```

### 1C. Watchlist (0.5 days)
```
DB table:
  CREATE TABLE watchlist_items (
    user_id    TEXT NOT NULL,
    symbol     TEXT NOT NULL,
    position   INTEGER NOT NULL DEFAULT 0,
    added_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, symbol)
  );

API:
  GET  /api/watchlist
  POST /api/watchlist        { symbol }
  DELETE /api/watchlist/:symbol
  PUT  /api/watchlist/reorder { symbols: string[] }

Frontend: TerminusNav watchlist tab becomes user-specific + persistable
```

---

## Phase 2 — Alerts Persistence (1-2 days)
> Currently alerts live in memory and are lost on refresh. High frustration point.

```
DB tables (add to migrate.ts):
  CREATE TABLE alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL,
    symbol      TEXT NOT NULL,
    condition   TEXT NOT NULL,      -- 'price_above' | 'price_below' | 'liq_spike' etc
    threshold   DOUBLE PRECISION,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE alert_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id        UUID REFERENCES alerts(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    triggered_at    TIMESTAMPTZ DEFAULT NOW(),
    price_at_trigger DOUBLE PRECISION,
    message         TEXT
  );

API routes:
  GET    /api/alerts            → user's active alerts
  POST   /api/alerts            → create alert
  DELETE /api/alerts/:id        → remove alert
  GET    /api/alerts/history    → last 100 triggered

Server alertsEngine.ts changes:
  On trigger → INSERT alert_history + broadcast to user's WS connection
  On server boot → load all active alerts from DB, resume monitoring

Frontend AlertManager.tsx:
  Load from API on mount instead of empty state
  Show history tab
```

---

## Phase 3 — Trade Journal (3-5 days)
> Biggest differentiator. Most traders use a spreadsheet. You can replace it.

```
DB table:
  CREATE TABLE journal_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL,
    symbol          TEXT NOT NULL,
    side            TEXT CHECK (side IN ('long','short')),
    entry_price     DOUBLE PRECISION NOT NULL,
    exit_price      DOUBLE PRECISION,
    size_usd        DOUBLE PRECISION NOT NULL,
    entry_at        TIMESTAMPTZ NOT NULL,
    exit_at         TIMESTAMPTZ,
    pnl_usd         DOUBLE PRECISION,
    pnl_pct         DOUBLE PRECISION,
    setup_tags      TEXT[] DEFAULT '{}',   -- ['ICT','FVG','LiqSweep','HTF_Bias']
    notes           TEXT,
    quant_bias_at_entry   TEXT,            -- snapshot of bias when trade was entered
    quant_drift_at_entry  DOUBLE PRECISION,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );

API routes:
  GET    /api/journal                    → paginated entries
  POST   /api/journal                    → create entry
  PUT    /api/journal/:id                → update (add exit, notes)
  DELETE /api/journal/:id
  GET    /api/journal/stats              → win rate by tag, avg R:R, monthly P&L
  POST   /api/journal/import             → CSV import from Binance/Bybit

Frontend: New floating panel FloatingJournalPanel.tsx
  - Entry form: symbol, side, price, size, tags, notes
  - "Quick capture" button in TerminusNav or chart toolbar
  - Stats tab: win rate by setup tag, P&L calendar (GitHub heatmap style)
  - Auto-fill quant_bias_at_entry from current quantSnapshot when saving

Value: "My FVG setups win 68% of the time. My OB setups win 41%."
       "I consistently overtrade during high-vol breakout regime."
```

---

## Phase 4 — Strategy & Backtest Storage (2-3 days)
> Makes the existing backtester actually useful long-term.

```
DB tables:
  CREATE TABLE strategies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    config_json JSONB NOT NULL,
    is_public   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE backtest_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL,
    strategy_id     UUID REFERENCES strategies(id),
    symbol          TEXT NOT NULL,
    timeframe       TEXT NOT NULL,
    start_date      TIMESTAMPTZ,
    end_date        TIMESTAMPTZ,
    total_return    DOUBLE PRECISION,
    max_drawdown    DOUBLE PRECISION,
    win_rate        DOUBLE PRECISION,
    sharpe          DOUBLE PRECISION,
    trade_count     INTEGER,
    result_json     JSONB,              -- full trade list
    ran_at          TIMESTAMPTZ DEFAULT NOW()
  );

Features:
  - "My Strategies" library in BacktestPage sidebar
  - Run history: compare same strategy across different time periods
  - Public strategies: share a strategy via link (is_public=true)
  - Performance over time: did this strategy stop working after Feb 2025?
```

---

## Phase 5 — Chart Drawings Persistence (1 day)
> Quality of life. Users lose their analysis on every refresh today.

```
DB table:
  CREATE TABLE chart_drawings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL,
    symbol      TEXT NOT NULL,
    timeframe   TEXT NOT NULL,
    type        TEXT NOT NULL,         -- 'line'|'hline'|'box'|'fib'|'ray'
    coords_json JSONB NOT NULL,
    label       TEXT,
    color       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );

API: GET/POST/DELETE /api/drawings?symbol=X&timeframe=Y
Frontend: useDrawings.ts loads from API on symbol+tf change, saves on draw
```

---

## Phase 6 — UI Architecture Revamp (3-5 days)
> Decouple the sidebar. Make space for journal, analytics, new tools.

```
NEW: TerminalSummaryPanel.tsx (replaces sidebar tabs)
  Slim always-visible summary:
    - Signal grade: BEARISH | MODERATE confidence
    - 4 signal rows: Regime, Liq Bias, Options, HTF
    - 3 quick-launch buttons: [Quant] [Liquidations] [Options]
  Grade algorithm:
    signals from: adjustedDrift + liq ratio + options GEX + htfBias
    → weighted bull/bear score → STRONG/MODERATE/WEAK/CONFLICTED

NEW floating panels (triggered from TerminusNav Tools dropdown):
  FloatingQuantPanel.tsx       ← QuantPanel moved here
  FloatingLiquidationPanel.tsx ← LiquidationPanel enhanced version
  FloatingOptionsPanel.tsx     ← OptionsPanel moved here
  FloatingJournalPanel.tsx     ← new (Phase 3)

App.tsx changes:
  Remove 3-tab sidebar system
  Mount TerminalSummaryPanel where tabs were
  Wire TERMINUS_OPEN_* events in useAppEvents.ts
```

---

## Phase 7 — Enhanced Liquidation Panel (2 days)
> Transform from basic heatmap into a tape-reading tool.

```
New features in FloatingLiquidationPanel.tsx:

A. Sentiment Gauge
   longTotal = sum(bucket.long_liq_usd)
   shortTotal = sum(bucket.short_liq_usd)
   Render tug-of-war bar. If longPct > 70%: "LONG FLUSH" signal.

B. Whale Feed (live tape)
   marketDataStore: add significantLiquidations: LiqEvent[]
   addSignificantLiquidation(event): only if event.size > 10_000, max 50
   Throttle display: max 10 events/sec (batch in 100ms buckets)
   Render: scrolling list, ⚡ on events > $500K
   onClick row → highlight price on cluster heatmap

C. Heatmap heat gradient
   Current: 3-color threshold (red/amber/accent)
   New: interpolate intensity through:
     0.0 → rgba(30,30,60,0.4)    cold
     0.4 → rgba(180,30,30,0.7)   warm
     0.7 → rgba(255,80,0,0.85)   hot
     1.0 → rgba(255,240,30,1.0)  extreme
   Top 3 clusters: floating price+value label above bar
```

---

## Phase 8 — Quant Engine C++ Port (1 week)
> Remove Python subprocess. Fix 800ms delay ("Initializing Macro Engine...").

```
Current flow: server spawns Python → yfinance downloads macro → compute → serialize → broadcast
              Time: 800ms–2000ms per run

Target flow: N-API C++ addon → compute in-process → broadcast
             Time: ~5ms per run

Files to create:
  packages/server/native/quant_math.cpp    Kalman filter, sigma grid, Pearson correlations
  packages/server/native/binding.gyp       Build config
  packages/server/src/engines/native-bridge.ts  (stub exists, needs implementation)

Kalman filter:
  x = x + K*(observed - x)
  K = P / (P + R)
  P = (1-K) * (P + Q)

Sigma grid (9 points, -3σ to +3σ):
  for each sigma: price = current * exp(drift + sigma * vol)
  probability = normal_pdf(sigma) * 100

Pearson correlation (30-day window):
  r = Σ((a-ā)(b-b̄)) / sqrt(Σ(a-ā)² * Σ(b-b̄)²)

Macro data still fetched via HTTP (yfinance → REST), but cached in Redis 1hr.
C++ replaces only the math computation, not the data fetch.
```

---

## Phase 9 — Multi-User Architecture (2 weeks)
> Current: globalSymbol shared across all clients. One symbol per server.
> Required before any paid tier or public launch.

```
Remove globalSymbol. Each client tracks its own symbol.

server changes:
  ClientConnection interface adds: symbol, subscribedStreams Set<string>
  
  On switch_symbol:
    Stop streaming old symbol to THIS client only (not all clients)
    Start streaming new symbol to THIS client
    If new symbol has no active subscribers → start exchange adapters for it
    If old symbol has no more subscribers → stop exchange adapters for it

Symbol-keyed engine instances:
  liquidationEngine becomes Map<symbol, LiquidationEngine>
  quantEngine becomes Map<symbol, QuantEngine>
  etc.

Redis keys already support this pattern:
  candles:{symbol}:{tf}  ← already symbol-keyed
  price:{symbol}         ← already symbol-keyed

Backpressure:
  Per-symbol stream managers
  Max N symbols active simultaneously (configurable, default 10)
  LRU eviction of inactive symbol streams
```

---

## Phase 10 — Asset Class Expansion (ongoing)
> Add forex, equities, commodities. Architecture prepared in Phase 9.

```
Asset capability map (drives which panels enable/disable):
  crypto_perp: { options:true,  liq:true,  quant:true,  funding:true  }
  crypto_spot:  { options:false, liq:false, quant:true,  funding:false }
  fx_pair:      { options:false, liq:false, quant:true,  funding:false }
  equity:       { options:true,  liq:false, quant:true,  funding:false }

UI behavior:
  If !caps.options → "Open Options" button disabled with tooltip
  If !caps.liq     → LiquidationPanel shows "Not available for [asset class]"
  Quant panel always works (it's statistical — works on any price series)

Data sources to add:
  Forex:    OANDA API or Interactive Brokers
  Equities: Alpaca (US stocks, free tier available)
  Macro:    Already partially implemented via yfinance in quant engine
```

---

## Effort Summary
```
Phase 0  Stabilization          ~2 hours    must do first
Phase 1  User accounts          3-5 days    unlocks everything
Phase 2  Alerts persistence     1-2 days    high user value
Phase 3  Trade journal          3-5 days    biggest differentiator
Phase 4  Strategy storage       2-3 days    makes backtester useful
Phase 5  Chart drawings persist 1 day       QoL
Phase 6  UI revamp              3-5 days    cleanliness
Phase 7  Enhanced liq panel     2 days      power user feature
Phase 8  C++ quant engine       1 week      performance
Phase 9  Multi-user arch        2 weeks     required for launch
Phase 10 Asset expansion        ongoing     growth
```

---

## Tech Decisions Already Made (Don't Revisit)
```
Auth:         Clerk (not building custom — weeks of work + security risk)
Email alerts: Resend API (not building email server)
File storage: Cloudflare R2 or S3 (for journal screenshots)
DB:           TimescaleDB (already connected, schema exists)
Cache:        Redis (already working)
Do NOT add:   Prisma/Drizzle ORM (raw pg queries are faster, schema exists)
              GraphQL (REST is sufficient)
              Next.js (Vite+Fastify is working, don't migrate)
```
