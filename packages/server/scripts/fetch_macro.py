"""
fetch_macro.py — Standalone macro data fetcher for TERMINUS Quant Engine.
Outputs JSON to stdout. Called by Node.js via child_process.spawn.
"""
import json
import sys
import numpy as np
import yfinance as yf

TARGET = "BTC-USD"
MACROS = ["DX-Y.NYB", "^TNX", "^GSPC"]
LOOKBACK = "6mo"
KALMAN_R = 1e-1
KALMAN_Q = 1e-3

def kalman_1d(prices, R, Q):
    x = prices[0]
    P = 1.0
    filtered = []
    for z in prices:
        P = P + Q
        K = P / (P + R)
        x = x + K * (z - x)
        P = (1 - K) * P
        filtered.append(x)
    return filtered

def main():
    try:
        tickers = [TARGET] + MACROS
        data = yf.download(tickers, period=LOOKBACK, interval="1d",
                           group_by='ticker', progress=False)
        
        if data.empty:
            print(json.dumps({"error": "No data returned from yfinance"}))
            sys.exit(1)

        def get_close(ticker):
            try:
                if isinstance(data.columns, __import__('pandas').MultiIndex):
                    if ('Close', ticker) in data.columns:
                        return data['Close'][ticker].dropna()
                    elif (ticker, 'Close') in data.columns:
                        return data[ticker]['Close'].dropna()
                    else:
                        return None
                return data['Close'].dropna()
            except KeyError:
                return None

        target_series = get_close(TARGET)
        if target_series is None or len(target_series) < 30:
            print(json.dumps({"error": "Insufficient target data"}))
            sys.exit(1)

        prices = target_series.values.astype(float)
        dates = [str(d.date()) for d in target_series.index]

        # Kalman filter
        kalman_line = kalman_1d(prices, KALMAN_R, KALMAN_Q)

        # Log returns for correlation
        import pandas as pd
        df = pd.DataFrame({'Target': target_series})
        for m in MACROS:
            s = get_close(m)
            if s is not None:
                df[m] = s
        df = df.ffill().dropna()
        
        returns = np.log(df / df.shift(1)).dropna()
        correlations = returns.corr()['Target']

        # Rolling Z-scores (20-day)
        rolling_mean = df.rolling(window=20).mean()
        rolling_std = df.rolling(window=20).std()
        z_scores = ((df - rolling_mean) / rolling_std).iloc[-1]

        # Macro breakdown
        macro_breakdown = []
        total_drag = 0.0
        for m in MACROS:
            if m in df.columns:
                corr = float(correlations.get(m, 0))
                z = float(z_scores.get(m, 0))
                impact = corr * z
                total_drag += impact * 0.2
                macro_breakdown.append({
                    "ticker": m,
                    "correlation": round(corr, 4),
                    "zScore": round(z, 4),
                    "impact": round(impact, 4)
                })

        # Projection
        current_price = float(prices[-1])
        trend_window = 14
        slope = float(np.polyfit(np.arange(trend_window), kalman_line[-trend_window:], 1)[0])
        base_drift = slope / current_price
        adjusted_drift = base_drift + (total_drag / 100)
        step_vol = float(np.std(np.diff(np.log(prices))[-30:]))

        horizon = 14
        projections = []
        cones = []
        for step in range(1, horizon + 1):
            path_price = current_price * np.exp(adjusted_drift * step)
            sigma_t = step_vol * np.sqrt(step)
            projections.append(round(float(path_price), 2))
            cones.append({
                "step": step,
                "center": round(float(path_price), 2),
                "upper1": round(float(path_price * np.exp(sigma_t)), 2),
                "lower1": round(float(path_price * np.exp(-sigma_t)), 2),
                "upper2": round(float(path_price * np.exp(2 * sigma_t)), 2),
                "lower2": round(float(path_price * np.exp(-2 * sigma_t)), 2),
            })

        # Sigma grid
        from scipy.stats import norm as norm_dist
        mu_total = adjusted_drift * horizon
        sigma_total = step_vol * np.sqrt(horizon)
        final_price = projections[-1]

        sigma_grid = []
        for sig in np.arange(-3.0, 3.05, 0.5):
            sig = round(float(sig), 1)
            target = final_price * np.exp(sig * sigma_total)
            pct_move = (target / current_price - 1) * 100
            z = (np.log(target / current_price) - mu_total) / sigma_total if sigma_total > 0 else 0
            prob = float((1 - norm_dist.cdf(z)) * 100) if target > current_price else float(norm_dist.cdf(z) * 100)
            sigma_grid.append({
                "sigma": sig,
                "price": round(float(target), 2),
                "pctMove": round(float(pct_move), 2),
                "probability": round(prob, 1)
            })

        # Quantiles
        quantiles = {}
        for label, q in [("p5", 0.05), ("p25", 0.25), ("p50", 0.50), ("p75", 0.75), ("p95", 0.95)]:
            log_ret = norm_dist.ppf(q) * sigma_total + mu_total
            q_price = current_price * np.exp(log_ret)
            quantiles[label] = {
                "price": round(float(q_price), 2),
                "pctMove": round(float((q_price / current_price - 1) * 100), 2)
            }

        result = {
            "ts": int(__import__('time').time() * 1000),
            "currentPrice": round(current_price, 2),
            "meta": {
                "baseDrift": round(base_drift * 100, 6),
                "macroDrag": round(total_drag, 6),
                "adjustedDrift": round(adjusted_drift * 100, 6),
                "stepVolatility": round(step_vol * 100, 4),
                "horizon": horizon
            },
            "kalman": [round(float(k), 2) for k in kalman_line],
            "dates": dates,
            "projections": projections,
            "cones": cones,
            "sigmaGrid": sigma_grid,
            "quantiles": quantiles,
            "macroBreakdown": macro_breakdown
        }

        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
