import { ErrorBoundary } from '../../shared/ErrorBoundary.tsx';
import { OptionsPanel } from '../panels/OptionsPanel.tsx';
import { FloatingPanelWrapper } from '../../shared/FloatingPanelWrapper.tsx';

interface Props { onClose: () => void; }

export function FloatingOptionsPanel({ onClose }: Props) {
    return (
        <FloatingPanelWrapper
            title="◈ OPTIONS · GEX"
            titleColor="#ffeb3b"
            initialPosition={{ x: Math.max(60, window.innerWidth / 2 - 280), y: 120 }}
            defaultHeight={480}
            collapsedRight={500}
            onClose={onClose}
        >
            <ErrorBoundary name="OptionsPanel">
                <OptionsPanel />
            </ErrorBoundary>
        </FloatingPanelWrapper>
    );
}
