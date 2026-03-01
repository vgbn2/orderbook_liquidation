# Terminus — System Architecture & Learning Resources

Terminus is a highly sophisticated trading application that blends high-frequency distributed systems engineering with institutional quantitative finance. This document outlines the core concepts used in the system and provides starting points for learning them.

---

## 1. Quantitative Finance & Trading Concepts (Domain Knowledge)

### Core Mechanics
*   **Orderbook Microstructure:** Aggregating Level 2 (L2) depth from multiple exchanges to identify limit walls, icebergs, and bid/ask spreads before execution.
*   **Funding Rates & Open Interest (VWAF):** A custom Volume-Weighted Average Funding (VWAF) metric using real-time futures data to gauge global market leverage (long/short bias).
*   **Backtesting & Statistics:** Formulas calculating institutional metrics on historical data (Sharpe Ratio, Max Drawdown, Equity Curves, Win Rates).

### Institutional / Algorithmic Concepts
*   **ICT (Inner Circle Trader) Concepts:** Real-time detection of Fair Value Gaps (FVGs), Order Blocks (OBs), and Liquidity Sweeps.
*   **Volume Profile (VRVP):** Visible Range Volume Profile algorithms map volume at specific price levels to find the Point of Control (POC) and Value Areas (VAH/VAL).

### Where to Learn:
*   **Market Microstructure:** Read *Trading and Exchanges: Market Microstructure for Practitioners* by Larry Harris. It is the bible for orderbook mechanics.
*   **Algorithmic Trading Stats:** Investopedia (search "Sharpe Ratio", "Maximum Drawdown") and QuantStart.com tutorials on building backtesters in Python (the math easily translates to JS/C++).
*   **ICT Concepts:** The "Inner Circle Trader" YouTube channel (specifically the 2022 Mentorship playlist) is where these concepts originate.
*   **Volume Profile:** TradingView's official documentation on Volume Profile and educational YouTube videos explaining "Auction Market Theory".

---

## 2. High-Frequency Backend Architecture

To process millions of data points per minute without crashing, the backend relies on high-performance streaming architecture.

### Technologies
*   **Node.js & TypeScript:** The entire orchestration server is written in strict TypeScript running on the asynchronous Node.js runtime.
*   **Asynchronous WebSockets:** Using the `ws` library to maintain persistent, bidirectional connections directly to the APIs of Binance, Bybit, OKX, and Hyperliquid.
*   **Redis (In-Memory Database):** Used as a lightning-fast, RAM-based pub/sub engine to instantly broadcast aggregated data from the ingestion engine to the connected web clients.
*   **C++ & N-API (Native Addons):** Moving heavily mathematical orderbook sorting logic out of JavaScript and into C++ to eliminate JavaScript "garbage collection" lag, utilizing low-level memory management and multi-threading.

### Where to Learn:
*   **Node.js & Advanced TypeScript:** The official Node.js guides and TypeScript Handbook. For advanced performance, look into "Node.js Event Loop architecture".
*   **WebSockets:** MDN Web Docs (Mozilla) on the WebSocket API. Try building a simple chat app first.
*   **Redis Pub/Sub:** The official Redis documentation (redis.io) has excellent, easy-to-understand tutorials on Publisher/Subscriber patterns.
*   **C++ for High-Frequency Trading (HFT):** Learn modern C++ (C++17/20) via LearnCpp.com. To understand N-API (connecting C++ to Node.js), read the `node-addon-api` GitHub repository examples. Books like *C++ Concurrency in Action* by Anthony Williams are crucial for multi-threading.

---

## 3. Frontend & Data Visualization (React Client)

Rendering thousands of shifting data points at 60 Frames-Per-Second without freezing the user's browser requires specialized frontend knowledge.

### Technologies
*   **React & Vite:** The core UI framework and build tool.
*   **Zustand (State Management):** A minimal, fast state manager that allows components to subscribe to specific data changes (like a new price tick) without causing the entire application to re-render.
*   **HTML5 `<canvas>` & Lightweight Charts:** Bypassing standard HTML DOM rendering to draw charts directly to the GPU. The application uses TradingView's Lightweight Charts library as a base.
*   **Custom Canvas Rendering:** Writing raw JavaScript algorithms that interact with the Canvas 2D API to draw custom overlays (like the ICT blocks and VRVP histograms) perfectly synced with chart coordinates.

### Where to Learn:
*   **React & Vite:** React.dev (the new official documentation) is fantastic. Learn hooks (`useEffect`, `useRef`, `useCallback`) deeply, as they are essential for performance.
*   **Zustand:** The Zustand GitHub repository readme is short and provides everything you need to know about atomic state updates.
*   **Canvas API & High-Performance UI:** MDN Web Docs on Canvas 2D. To understand *why* we use canvas over HTML divs for performance, read articles on "Browser Rendering Pipeline" (DOM vs Canvas vs WebGL).
*   **TradingView Lightweight Charts:** Their official documentation (tradingview.github.io/lightweight-charts/) explains the coordinate systems used to draw custom plugins.
