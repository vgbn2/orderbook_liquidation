import { useState, useCallback, useEffect } from 'react';

interface ResizerProps {
    setRightPanelWidth: (w: number | ((prev: number) => number)) => void;
    setOrderbookHeight: (h: number | ((prev: number) => number)) => void;
}

export function useLayoutResizer({
    setRightPanelWidth,
    setOrderbookHeight
}: ResizerProps) {
    const [isResizing, setIsResizing] = useState(false);
    const [isVResizing, setIsVResizing] = useState(false);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        setIsResizing(true);
        e.preventDefault();
    }, []);

    const handleVMouseDown = useCallback((e: React.MouseEvent) => {
        setIsVResizing(true);
        e.preventDefault();
    }, []);

    useEffect(() => {
        if (!isResizing && !isVResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isResizing) {
                // Right panel width adjustment using functional update
                setRightPanelWidth(w => {
                    const next = window.innerWidth - e.clientX;
                    if (next > 200 && next < 800) return next;
                    return w;
                });
            } else if (isVResizing) {
                // Orderbook height adjustment using movement delta (with bounds)
                setOrderbookHeight(h => {
                    const next = h + e.movementY;
                    if (next > 100 && next < window.innerHeight - 200) return next;
                    return h;
                });
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            setIsVResizing(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, isVResizing, setRightPanelWidth, setOrderbookHeight]);

    return {
        isResizing,
        isVResizing,
        handleMouseDown,
        handleVMouseDown
    };
}
