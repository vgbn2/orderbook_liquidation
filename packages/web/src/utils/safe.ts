// Safe number formatting — never crashes, never shows NaN
export const fmt = {
    price: (v: any, fallback = '---') => {
        if (v == null || isNaN(v)) return fallback;
        if (v >= 10000) return `$${(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        if (v >= 100) return `$${v.toFixed(2)}`;
        if (v >= 1) return `$${v.toFixed(3)}`;
        return `$${v.toFixed(5)}`;  // DOGE, XRP, etc
    },

    money: (v: any, fallback = '$0') => {
        if (v == null || isNaN(v)) return fallback;
        if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
        if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
        if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
        return `$${v.toFixed(0)}`;
    },

    pct: (v: any, fallback = '0.00%') => {
        if (v == null || isNaN(v)) return fallback;
        if (typeof v === 'string') {
            const numV = parseFloat(v.replace('%', ''));
            if (isNaN(numV)) return fallback;
            v = numV;
        }
        return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
    },

    num: (v: any, decimals = 2, fallback = '---') => {
        const parsed = Number(v);
        if (v == null || isNaN(parsed)) return fallback;
        return parsed.toFixed(decimals);
    },
};

// Safe array access — never crashes on empty/null arrays
export const safe = {
    arr: <T = any>(v: any): T[] => Array.isArray(v) ? v : [],
    num: (v: any, def = 0): number => {
        const parsed = Number(v);
        return (v == null || isNaN(parsed)) ? def : parsed;
    },
    str: (v: any, def = ''): string => (v == null) ? def : String(v),
    obj: <T = any>(v: any, def = {} as T): T => (v != null && typeof v === 'object' && !Array.isArray(v)) ? v : def,
    bool: (v: any, def = false): boolean => (v == null) ? def : Boolean(v),
};
