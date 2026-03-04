# Terminus (orderbook_liquidation)

Terminus is a high-performance, institutional-grade trading platform that blends distributed systems engineering with sophisticated quantitative finance. It provides real-time orderbook analysis, liquidity tracking, and advanced market visualization.

---

## 🚀 Key Features

*   **Orderbook Microstructure Analysis**: Real-time aggregation of Level 2 (L2) depth across multiple exchanges (Binance, Bybit, OKX, Hyperliquid).
*   **Institutional Quant Metrics**: Custom formulas for Global Long/Short bias, Volume-Weighted Average Funding (VWAF), and Open Interest.
*   **ICT Concept Detection**: Automated, real-time identification of Fair Value Gaps (FVGs), Order Blocks (OBs), and Liquidity Sweeps.
*   **Volume Profile (VRVP)**: High-performance algorithms mapping volume at specific price levels to find PoC (Point of Control) and Value Areas.
*   **Advanced Backtesting**: Institutional-grade backtesting engine with metrics like Sharpe Ratio, Max Drawdown, and Equity Curves.
*   **High-Frequency Performance**: Powered by C++ native addons for math-heavy operations to eliminate GC lag.

---

## 🏗️ System Architecture

Terminus is built as a monorepo using **NPM Workspaces**:

-   **`packages/server`**: A high-performance Node.js backend using Fastify and WebSockets.
-   **`packages/web`**: A modern React frontend designed for 60fps data visualization.

### Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Node.js, TypeScript, Fastify, Redis (Pub/Sub), C++ (N-API), ioredis, PostgreSQL |
| **Frontend** | React, Vite, Zustand, HTML5 Canvas, TradingView Lightweight Charts |
| **Data Flow** | Real-time WebSockets -> Aggregation Engine -> Redis Pub/Sub -> Web Client |

---

## 🚦 Getting Started

### Prerequisites

*   **Node.js**: v18+ recommended
*   **Docker**: Required for Redis and PostgreSQL
*   **C++ Build Tools**: Required for compiling native addons (`node-gyp`)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-repo/orderbook_liquidation.git
    cd orderbook_liquidation
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Set up environment variables:
    ```bash
    cp .env.example .env
    # Edit .env with your configuration
    ```

### Running the Application

**Run with Docker (Recommended for external services):**
```bash
npm run docker:up
```

**Run in Development Mode:**
This starts both the server and the web application concurrently.
```bash
npm run dev
```

---

## 📜 Development Scripts

*   `npm run dev`: Start all packages in watch mode.
*   `npm run build`: Build all packages for production.
*   `npm run docker:up`: Start Redis and PostgreSQL using Docker Compose.
*   `npm run docker:down`: Stop Docker services.

---

## 📚 Further Information

For deep dives into the technical concepts, math formulas, and architectural decisions, please refer to:
- [SYSTEM_ARCHITECTURE_AND_RESOURCES.md](./SYSTEM_ARCHITECTURE_AND_RESOURCES.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

*GSD Methodology applied via Google Antigravity*
