import axios from 'axios';
import { logger } from '../logger.js';

// ── Geopolitical Risk Themes ─────────────────────────────────

const RISK_THEMES = [
    'WAR', 'CONFL', 'TERROR', 'SANCTION', 'PROTEST',
    'ELECTION', 'COUP', 'MILITARY', 'NUCLEAR'
];

export interface GeopoliticalNews {
    title: string;
    url: string;
    source: string;
    date: string;
    tone: number;
    relevance: number;
}

class GdeltAdapter {
    private lastFetch = 0;
    private cache: GeopoliticalNews[] = [];

    async fetchGlobalRiskNews(): Promise<GeopoliticalNews[]> {
        // Cache for 30 minutes
        if (Date.now() - this.lastFetch < 1800000 && this.cache.length > 0) {
            return this.cache;
        }

        try {
            // GDELT Context 2.0 Search API
            // Query for US/Major power risk keywords
            const query = `(war OR conflict OR sanctions OR "geopolitical risk") (country:US OR country:CH OR country:RU OR country:EU OR country:ME)`;
            const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxresults=50`;

            const res = await axios.get(url);

            if (res.data && res.data.articles) {
                const news: GeopoliticalNews[] = res.data.articles.map((art: any) => ({
                    title: art.title,
                    url: art.url,
                    source: art.source,
                    date: art.seendate,
                    tone: 0, // GDELT doc api doesn't give raw tone easily in artlist mode
                    relevance: 1.0
                }));

                this.cache = news;
                this.lastFetch = Date.now();
                return news;
            }
        } catch (err) {
            logger.warn({ err }, 'GDELT fetch failed');
        }

        return this.cache;
    }
}

export const gdeltAdapter = new GdeltAdapter();
