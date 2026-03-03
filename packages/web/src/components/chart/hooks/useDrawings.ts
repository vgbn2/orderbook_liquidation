import { useState, useEffect, useRef } from 'react';

export type DrawingTool = 'none' | 'line' | 'hline' | 'box' | 'fib' | 'ray';

export interface DrawingBase {
    id: string;
    color: string;
}

export interface LineDrawing extends DrawingBase {
    type: 'line';
    p1: { time: number; price: number };
    p2: { time: number; price: number };
}

export interface HLineDrawing extends DrawingBase {
    type: 'hline';
    price: number;
}

export interface BoxDrawing extends DrawingBase {
    type: 'box';
    p1: { time: number; price: number };
    p2: { time: number; price: number };
}

export interface FibDrawing extends DrawingBase {
    type: 'fib';
    p1: { time: number; price: number };
    p2: { time: number; price: number };
}

export interface RayDrawing extends DrawingBase {
    type: 'ray';
    p1: { time: number; price: number };
    p2: { time: number; price: number };
}

export type Drawing = LineDrawing | HLineDrawing | BoxDrawing | FibDrawing | RayDrawing;

export function useDrawings() {
    const [drawings, setDrawings] = useState<Drawing[]>([]);
    const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
    const initialLoadRef = useRef(false);

    // ── Persistence: Load ──
    useEffect(() => {
        const saved = localStorage.getItem('terminus_drawings');
        if (saved) {
            try {
                setDrawings(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load drawings', e);
            }
        }
        initialLoadRef.current = true;
    }, []);

    // ── Persistence: Save ──
    useEffect(() => {
        if (!initialLoadRef.current) return;
        localStorage.setItem('terminus_drawings', JSON.stringify(drawings));
    }, [drawings]);

    const addDrawing = (drawing: Drawing) => {
        setDrawings(prev => [...prev, drawing]);
    };

    const updateDrawing = (id: string, updates: Partial<Drawing>) => {
        setDrawings(prev => prev.map(d => d.id === id ? { ...d, ...updates } as Drawing : d));
    };

    const removeDrawing = (id: string) => {
        setDrawings(prev => prev.filter(d => d.id !== id));
        if (selectedDrawingId === id) setSelectedDrawingId(null);
    };

    return {
        drawings,
        setDrawings,
        addDrawing,
        updateDrawing,
        removeDrawing,
        selectedDrawingId,
        setSelectedDrawingId,
        selectedDrawing: drawings.find(d => d.id === selectedDrawingId)
    };
}
