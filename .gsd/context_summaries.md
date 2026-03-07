# Context Summary: Native C++ Core

## 📦 packages/server/src/native/terminus_core.cpp
**Purpose:** N-API bridge connecting Node.js to high-performance C++ math and orderbook engines.
**Key exports:** 
- `initSnapshot`, `applyDelta`, `getAggregated` (Orderbook)
- `gaussianPDF`, `gaussianCDF`, `gaussianPPF`, `kalman1D`, `pearsonCorrelation` (Math)
**Dependencies:** `napi.h`, `orderbook.hpp`, `aggregator.hpp`, `quant_math.cpp`
**Patterns:** Uses global singletons for `CrossExchangeAggregator` and `VWAFEngine`. 

## 📦 packages/server/src/native/orderbook.hpp
**Purpose:** Header-only implementation of a price-level based orderbook.
**Key classes:**
- `OrderbookSide`: Manages a `std::map<int64_t, Level>` for bids/asks. Bids are DESC, Asks are ASC.
- `ExchangeBook`: Manages a pair of `OrderbookSide` and handles delta updates. 
**Patterns:** Uses integer-based price scaling (`PRICE_SCALE = 100`) to avoid float precision issues.

## 📦 packages/server/src/native/aggregator.hpp
**Purpose:** Merges orderbooks from multiple exchanges into a unified view.
**Key classes:**
- `CrossExchangeAggregator`: Manages a map of `ExchangeID` to `ExchangeBook`.
**Patterns:** Thread-safe using `std::shared_mutex` (reader-writer lock).

## 📦 packages/server/src/native/quant_math.cpp
**Purpose:** Implementation of statistical distribution and signal processing functions.
**Key functions:** `NormalDistribution::pdf/cdf/ppf`, `Kalman1D::update`, `Correlation::pearson`.
**Watch for:** Uses standard math libraries for performance; inputs are usually `double`.
