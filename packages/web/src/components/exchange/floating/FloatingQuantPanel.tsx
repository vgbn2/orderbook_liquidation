import { ErrorBoundary } from '../../shared/ErrorBoundary.tsx';
import { QuantPanel } from '../panels/QuantPanel.tsx';
import { FloatingPanelWrapper } from '../../shared/FloatingPanelWrapper.tsx';

interface Props { onClose: () => void; }

export function FloatingQuantPanel({ onClose }: Props) {
    return (
        <FloatingPanelWrapper
            title="◈ MACRO QUANT"
            initialPosition={{ x: Math.max(60, window.innerWidth / 2 - 280), y: 80 }}
            defaultHeight={520}
            collapsedRight={20}
            onClose={onClose}
        >
            <ErrorBoundary name="QuantPanel">
                <QuantPanel />
            </ErrorBoundary>
        </FloatingPanelWrapper>
    );
}
