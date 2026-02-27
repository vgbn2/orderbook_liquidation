import { useState, useEffect, useCallback, useRef } from 'react';

interface Position {
    x: number;
    y: number;
}

interface UseDraggableProps {
    initialPosition?: Position;
    onDragEnd?: (pos: Position) => void;
}

export function useDraggable({ initialPosition = { x: 0, y: 0 }, onDragEnd }: UseDraggableProps = {}) {
    const [isDragging, setIsDragging] = useState(false);

    // Store the position in a ref to avoid re-renders during drag
    const positionRef = useRef<Position>(initialPosition);
    // Element ref to directly mutate the DOM styles
    const elementRef = useRef<HTMLElement | null>(null);

    const dragOffset = useRef<Position>({ x: 0, y: 0 });

    useEffect(() => {
        // Load initial position from localStorage
        const stored = localStorage.getItem('panel_pos');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
                    positionRef.current = parsed;
                }
            } catch (e) {
                // ignore
            }
        }

        // Apply initial position if element is available
        if (elementRef.current) {
            elementRef.current.style.transform = `translate(${positionRef.current.x}px, ${positionRef.current.y}px)`;
        }
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
        // Only allow dragging with the left mouse button
        if (e.button !== 0) return;

        // Don't drag if clicking inside an interactive element
        const target = e.target as HTMLElement;
        if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.closest('button')) {
            return;
        }

        e.preventDefault();

        dragOffset.current = {
            x: e.clientX - positionRef.current.x,
            y: e.clientY - positionRef.current.y
        };

        setIsDragging(true);
    }, []);


    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;

        let newX = e.clientX - dragOffset.current.x;
        let newY = e.clientY - dragOffset.current.y;

        positionRef.current = { x: newX, y: newY };

        // Direct DOM manipulation
        if (elementRef.current) {
            elementRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
        }
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            // Save to localStorage
            localStorage.setItem('panel_pos', JSON.stringify(positionRef.current));
            if (onDragEnd) {
                onDragEnd(positionRef.current);
            }
        }
    }, [isDragging, onDragEnd]);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return {
        elementRef,
        isDragging,
        handleMouseDown
    };
}
