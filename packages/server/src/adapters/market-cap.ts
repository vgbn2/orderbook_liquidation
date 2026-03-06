import { logger } from '../logger.js';
import { redis } from '../db/redis.js';

// ══════════════════════════════════════════════════════════════
//  Market Cap Adapter — CoinGecko (free) + DefiLlama (free)
//  Provides: Total Market Cap, Stablecoin Cap, Altcoin Index
// ══════════════════════════════════════════════════════════════

const COINGECKO_GLOBAL = 'https://api.coingecko.com/api/v3/global';
const COINGECKO_MARKETS = 'https://api.coingecko.com/api/v3/coins/markets';
const DEFILLAMA_STABLECOINS = 'https://stablecoins.llama.fi/stablecoins?includePrices=false';

const CACHE_KEY_MCAP = 'signal:market_cap';
const CACHE_KEY_ALT = 'signal:altcoin_index';
const CACHE_TTL = 12 * 60 * 60; // 12 hours

export interface MarketCapSnapshot {
    timestamp: number;
    totalCryptoMarketCap: number;
    stablecoinMarketCap: number;
    /**
     * Divergence Ratio = Total / Stablecoin.
     * Rising ratio + Rising Stablecoin = Healthy rally (fresh capital).
     * Rising ratio + Flat Stablecoin = Leverage-driven (fragile).
     */
    divergenceRatio: number;
    btcDominance: number;
}

export interface AltcoinIndexSnapshot {
    timestamp: number;
    /** 0-100. >75 = Altcoin Season, <25 = BTC Season */
    index: number;
    season: 'altcoin' | 'bitcoin' | 'neutral';
    /** How many of Top 100 outperformed BTC in 90 days */
    outperformerCount: number;
    totalCoins: number;
}

class MarketCapAdapter {
    private lastMcap: MarketCapSnapshot | null = null;
    private lastAlt: AltcoinIndexSnapshot | null = null;

    // ─── Market Cap Divergence ─────────────────────────────────

    async fetchMarketCaps(): Promise<MarketCapSnapshot | null> {
        try {
            const cached = await redis.get(CACHE_KEY_MCAP);
            if (cached) {
                this.lastMcap = JSON.parse(cached);
                return this.lastMcap;
            }

            // 1. Fetch Total Crypto Market Cap from CoinGecko
            const globalRes = await fetch(COINGECKO_GLOBAL);
            if (!globalRes.ok) throw new Error(`CoinGecko /global ${globalRes.status}`);
            const globalJson = await globalRes.json() as {
                data: {
                    total_market_cap: Record<string, number>;
                    market_cap_percentage: Record<string, number>;
                };
            };
            const totalCap = globalJson.data.total_market_cap?.usd ?? 0;
            const btcDom = globalJson.data.market_cap_percentage?.btc ?? 0;

            // 2. Fetch Stablecoin Market Cap from DefiLlama
            await new Promise(r => setTimeout(r, 300)); // Rate limit buffer
            const stableRes = await fetch(DEFILLAMA_STABLECOINS);
            if (!stableRes.ok) throw new Error(`DefiLlama stablecoins ${stableRes.status}`);
            const stableJson = await stableRes.json() as {
                peggedAssets: Array<{ circulating: { peggedUSD: number } }>;
            };
            const stableCap = stableJson.peggedAssets?.reduce(
                (sum, asset) => sum + (asset.circulating?.peggedUSD ?? 0), 0
            ) ?? 0;

            const snapshot: MarketCapSnapshot = {
                timestamp: Date.now(),
                totalCryptoMarketCap: totalCap,
                stablecoinMarketCap: stableCap,
                divergenceRatio: stableCap > 0 ? totalCap / stableCap : 0,
                btcDominance: btcDom,
            };

            this.lastMcap = snapshot;
            await redis.set(CACHE_KEY_MCAP, JSON.stringify(snapshot), 'EX', CACHE_TTL);
            logger.info({
                totalCap: `$${(totalCap / 1e12).toFixed(2)}T`,
                stableCap: `$${(stableCap / 1e9).toFixed(1)}B`,
                ratio: snapshot.divergenceRatio.toFixed(2),
            }, 'Market Cap divergence fetched');
            return snapshot;
        } catch (err) {
            logger.warn({ err }, 'Failed to fetch Market Cap data — using last known');
            return this.lastMcap;
        }
    }

    // ─── Altcoin Season Index (Custom Logic) ──────────────────

    async fetchAltcoinIndex(): Promise<AltcoinIndexSnapshot | null> {
        try {
            const cached = await redis.get(CACHE_KEY_ALT);
            if (cached) {
                this.lastAlt = JSON.parse(cached);
                return this.lastAlt;
            }

            // Fetch Top 100 market data with 90-day price change
            const url = `${COINGECKO_MARKETS}?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=90d`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`CoinGecko /markets ${res.status}`);

            const coins = await res.json() as Array<{
                id: string;
                symbol: string;
                price_change_percentage_90d_in_currency: number | null;
            }>;

            // Find BTC's 90-day performance
            const btc = coins.find(c => c.symbol === 'btc');
            const btcPerf = btc?.price_change_percentage_90d_in_currency ?? 0;

            // Count altcoins that outperformed BTC
            const altcoins = coins.filter(c => c.symbol !== 'btc' && c.symbol !== 'usdt' && c.symbol !== 'usdc');
            const outperformers = altcoins.filter(
                c => (c.price_change_percentage_90d_in_currency ?? -999) > btcPerf
            );

            const totalCoins = altcoins.length;
            const outperformerCount = outperformers.length;
            const index = totalCoins > 0 ? Math.round((outperformerCount / totalCoins) * 100) : 50;

            let season: AltcoinIndexSnapshot['season'] = 'neutral';
            if (index >= 75) season = 'altcoin';
            else if (index <= 25) season = 'bitcoin';

            const snapshot: AltcoinIndexSnapshot = {
                timestamp: Date.now(),
                index,
                season,
                outperformerCount,
                totalCoins,
            };

            this.lastAlt = snapshot;
            await redis.set(CACHE_KEY_ALT, JSON.stringify(snapshot), 'EX', CACHE_TTL);
            logger.info({ index, season, outperformers: outperformerCount }, 'Altcoin Season Index calculated');
            return snapshot;
        } catch (err) {
            logger.warn({ err }, 'Failed to calculate Altcoin Index — using last known');
            return this.lastAlt;
        }
    }

    // ─── Accessors ────────────────────────────────────────────

    getLastMarketCap(): MarketCapSnapshot | null { return this.lastMcap; }
    getLastAltcoinIndex(): AltcoinIndexSnapshot | null { return this.lastAlt; }
}

export const marketCapAdapter = new MarketCapAdapter();
