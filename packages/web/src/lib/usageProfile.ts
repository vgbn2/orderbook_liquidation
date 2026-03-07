export interface UsageEntry {
    visits: number;
    avgDwell: number;
    lastSeen: number;
    lastSession: number;
}

export type UsageProfile = Record<string, Record<string, UsageEntry>>;

export interface ActiveVisit {
    symbol: string;
    timeframe: string;
    arrivedAt: number;
}

const LS_USAGE_PROFILE = 'terminus_usage_profile';
const OBSERVATION_WINDOW_MS = 5 * 60 * 1000;
const MIN_SCORE_THRESHOLD = 0.2;
const PREWARM_TOP_N = 5;

let activeVisit: ActiveVisit | null = null;
let isObservationActive = false;

function loadProfile(): UsageProfile {
    const raw = localStorage.getItem(LS_USAGE_PROFILE);
    return raw ? JSON.parse(raw) : {};
}

function saveProfile(profile: UsageProfile): void {
    localStorage.setItem(LS_USAGE_PROFILE, JSON.stringify(profile));
}

export function recordArrive(symbol: string, timeframe: string): void {
    if (!isObservationActive) return;
    if (activeVisit) recordLeave(activeVisit.symbol, activeVisit.timeframe);
    activeVisit = { symbol, timeframe, arrivedAt: Date.now() };
}

export function recordLeave(symbol: string, timeframe: string): void {
    if (!activeVisit || symbol !== activeVisit.symbol || timeframe !== activeVisit.timeframe) return;

    const dwellSec = (Date.now() - activeVisit.arrivedAt) / 1000;
    if (dwellSec < 3) {
        activeVisit = null;
        return;
    }

    const profile = loadProfile();
    if (!profile[symbol]) profile[symbol] = {};
    if (!profile[symbol][timeframe]) {
        profile[symbol][timeframe] = { visits: 0, avgDwell: 0, lastSeen: 0, lastSession: 0 };
    }

    const entry = profile[symbol][timeframe];
    entry.visits += 1;
    entry.avgDwell = (entry.avgDwell * (entry.visits - 1) + dwellSec) / entry.visits;
    entry.lastSeen = Date.now();

    saveProfile(profile);
    activeVisit = null;
}

function scoreCombo(entry: UsageEntry): number {
    const now = Date.now();
    const daysSinceLastSeen = (now - entry.lastSeen) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.exp(-daysSinceLastSeen / 3);
    const dwellScore = Math.min(entry.avgDwell / 300, 1.0);
    const freqScore = Math.min(Math.log(entry.visits + 1) / Math.log(50), 1.0);
    return freqScore * 0.4 + recencyScore * 0.35 + dwellScore * 0.25;
}

export function scoreAndRank(): { symbol: string; timeframe: string; score: number }[] {
    const profile = loadProfile();
    const results: { symbol: string; timeframe: string; score: number }[] = [];

    for (const symbol in profile) {
        for (const timeframe in profile[symbol]) {
            const score = scoreCombo(profile[symbol][timeframe]);
            if (score >= MIN_SCORE_THRESHOLD) {
                results.push({ symbol, timeframe, score });
            }
        }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, PREWARM_TOP_N);
}

export function startObservation(onComplete: (ranked: any[]) => void): void {
    isObservationActive = true;
    setTimeout(() => {
        isObservationActive = false;
        if (activeVisit) recordLeave(activeVisit.symbol, activeVisit.timeframe);
        onComplete(scoreAndRank());
    }, OBSERVATION_WINDOW_MS);

    window.addEventListener('beforeunload', () => {
        if (activeVisit) recordLeave(activeVisit.symbol, activeVisit.timeframe);
    });
}
