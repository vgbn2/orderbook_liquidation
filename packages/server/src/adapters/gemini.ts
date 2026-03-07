import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../logger.js';
import { GeopoliticalNews } from './gdelt.js';

export interface GeopoliticalRiskAnalysis {
    riskScore: number; // 0-10
    bias: 'bullish' | 'bearish' | 'neutral';
    summary: string;
    hotZones: string[];
    timestamp: number;
}

class GeminiAdapter {
    private genAI: GoogleGenerativeAI | null = null;
    private lastAnalysis: GeopoliticalRiskAnalysis | null = null;
    private lastFetch = 0;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
    }

    async analyzeGeopolitics(news: GeopoliticalNews[]): Promise<GeopoliticalRiskAnalysis | null> {
        if (!this.genAI || news.length === 0) return this.lastAnalysis;

        // Rate limit analysis to once per 2 hours (cost & token efficiency)
        if (Date.now() - this.lastFetch < 7200000 && this.lastAnalysis) {
            return this.lastAnalysis;
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

            const newsText = news.slice(0, 20).map(n => `- ${n.title} (${n.source})`).join('\n');

            const prompt = `
                Analyze the following geopolitical news headlines and assess the risk to global financial markets (specifically high-risk assets like Crypto/Equities).
                
                NEWS:
                ${newsText}

                Provide a JSON response with:
                {
                    "riskScore": number (0-10, where 10 is extreme systemic risk),
                    "bias": "bullish" | "bearish" | "neutral" (impact on market sentiment),
                    "summary": "1-2 sentence market impact summary",
                    "hotZones": ["string array of high-risk regions or topics"]
                }
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean JSON from markdown if needed
            const jsonStr = text.replace(/```json|```/gi, '').trim();
            const data = JSON.parse(jsonStr);

            this.lastAnalysis = {
                ...data,
                timestamp: Date.now()
            };
            this.lastFetch = Date.now();

            logger.info({ riskScore: data.riskScore }, 'AI Geopolitical Risk Analysis updated');
            return this.lastAnalysis;

        } catch (err) {
            logger.error({ err }, 'Gemini analysis failed');
            return this.lastAnalysis;
        }
    }
}

export const geminiAdapter = new GeminiAdapter();
