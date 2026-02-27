# Terminus Frontend Pseudocode Overview

This document provides a high-level pseudocode overview of the `packages/web` directory (React Frontend).

## 1. Application Shell (`src/App.tsx`)
```javascript
COMPONENT App:
    STATE: 
        loading, timeframe, timezone, sidebarTab, showBacktestPanel
        drawingTools, activeIndicators
        
    HOOKS:
        useMarketStore (Zustand: connects to WebSocket, holds global market state)
        
    EFFECT OnMount:
        Fetch historical candles from REST API
        Initialize loading fallback
        
    RENDER:
        <TerminusNav /> (Top Navigation & Modals)
        <WatchlistTicker /> (Scrolling ticker)
        <Toolbar /> (Chart tools, timeframe, indicators)
        
        <MainLayout>:
            <ChartArea>:
                <LightweightChart />
                (Injects lines, indicators, fibonaccis based on state)
                
            <RightPanel>:
                <ReplayPanel /> (Market Replay controls)
                <Tabs onSwitch={setSidebarTab}>
                
                IF sidebarTab == 'macro':
                    <QuantPanel />
                    <LiquidationPanel />
                    <VWAFPanel />
                    <ConfluencePanel />
                ELSE IF sidebarTab == 'options':
                    <OptionsPanel />
                    
        IF showBacktestPanel:
            <FloatingBacktestPanel /> (Draggable, floating interface)
```

## 2. State Management (`src/stores/marketStore.ts`)
```javascript
STORE useMarketStore:
    STATE:
        candles[]
        orderbook (bids, asks)
        optionsAnalytics (gex, dex)
        liquidations (heatmap)
        confluenceZones[]
        connected (boolean boolean whether WebSocket is connected)
        
    ACTIONS:
        setCandles(data)
        updateRealtime(data)
        ...
```

## 3. Charting (`src/components/Chart.tsx`)
```javascript
COMPONENT Chart:
    PROPS: timeframe, activeTool, activeIndicators, drawings
    
    EFFECT OnMount:
        Initialize LightweightCharts instance
        Create Chart Series: Candlestick, Volume, CVD, VWAP, Liquidations, RSI, MACD
        
    EFFECT OnDataUpdate:
        Update Candlestick Series
        Calculate and Update Indicator Series (e.g. Volume Delta, Custom CVD)
        
    EFFECT OnActiveIndicatorsChange:
        Toggle visibility of respective Chart Series
        
    EFFECT OnCanvasDraw:
        Listen for user clicks to draw lines, boxes, etc.
        Overlay custom canvas drawings (fibonacci, session boxes)
        
    RENDER:
        <div ref={chartContainerRef} />
        <canvas ref={canvasOverlayRef} />
```

## 4. UI Components (`src/components/`)
All UI components follow a strict design token system configured in `index.css`.

- **`TerminusNav.tsx`**: Renders top navigation, websocket connection state, and the `MarketSwitcher` & `SettingsPopover` modals.
- **`UI.tsx`**: Shared UI component primitives (`Button`, `Badge`, `Toggle`, `StatCard`, `PanelSection`, `Input`).
- **`QuantPanel.tsx`**: Renders macroeconomic distribution charts and trend analyses.
- **`OptionsPanel.tsx`**: Renders visual GEX (Gamma Exposure) bars and whale flow analytics.
- **`ReplayPanel.tsx`**: Renders playback controls, calendar inputs, handles sending WS messages for starting/stopping market replay.
- **`FloatingBacktestPanel.tsx`**: A draggable floating window containing backtest configurations, the `EquityChart`, and trade execution logs.
- **`Toolbar.tsx`**: Renders drawing and indicator selectors that propagate state down to the `Chart.tsx`.
- **`Toast.tsx`**: Global toast notification event listener and container.
