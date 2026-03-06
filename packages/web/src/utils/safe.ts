/**
 * Safe utilities for data formatting and shape guarantees.
 * 
 * Never trust incoming data shapes from WebSocket.
 * Never throw errors on null/NaN in formatter logic.
 */

export const fmt = {
    /**
     * Price formatting with dynamic decimal precision based on magnitude.
     * v >= 10000: 0 decimals ($67,000)
     * v >= 1: 2 decimals ($67.50)
     * v < 1: 5 decimals ($0.15000)
     */
    price: (v: number | null | undefined): string => {
        if (v == null || Number.isNaN(v)) return '---';

        if (v >= 10000) {
            return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
        }
        if (v >= 1) {
            return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return `$${v.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}`;
    },

    /**
     * Formats large numbers into readable money strings (K, M, B).
     */
    money: (v: number | null | undefined): string => {
        if (v == null || Number.isNaN(v)) return '---';
        const absV = Math.abs(v);
        const sign = v < 0 ? '-' : '';

        if (absV >= 1e9) return `${sign}${(absV / 1e9).toFixed(2)}B`;
        if (absV >= 1e6) return `${sign}${(absV / 1e6).toFixed(2)}M`;
        if (absV >= 1e3) return `${sign}${(absV / 1e3).toFixed(1)}K`;
        return `${sign}$${absV.toFixed(2)}`;
    },

    /**
     * Formats percentages with explicit sign and %.
     */
    pct: (v: number | string | null | undefined, decimals = 2): string => {
        const n = typeof v === 'string' ? parseFloat(v) : v;
        if (n == null || Number.isNaN(n)) return '---';
        const sign = n > 0 ? '+' : '';
        return `${sign}${n.toFixed(decimals)}%`;
    },

    /**
     * Generic numeric formatter with decimals.
     */
    num: (v: number | null | undefined, decimals = 2): string => {
        if (v == null || Number.isNaN(v)) return '---';
        return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
};

export const safe = {
    /**
     * Guarantees returning an array. Converts null/undefined to [].
     */
    arr: <T = any>(v: any): T[] => {
        return Array.isArray(v) ? v : [];
    },

    /**
     * Guarantees returning a number. Converts null/undefined/NaN to fallback.
     */
    num: (v: any, fallback = 0): number => {
        const parsed = typeof v === 'number' ? v : Number(v);
        return Number.isNaN(parsed) ? fallback : parsed;
    },

    /**
     * Guarantees returning an object. Converts null/undefined/arrays to {}.
     */
    obj: <T = Record<string, any>>(v: any): T => {
        return (v != null && typeof v === 'object' && !Array.isArray(v)) ? v : ({} as T);
    },

    /**
     * Guarantees returning a string.
     */
    str: (v: any, fallback = ''): string => {
        if (v == null) return fallback;
        return String(v);
    }
};
