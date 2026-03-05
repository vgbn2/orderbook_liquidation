interface PanelSkeletonProps {
    label: string;
}

export function PanelSkeleton({ label }: PanelSkeletonProps) {
    return (
        <div style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            opacity: 0.4,
            minHeight: '80px', // never collapses
            justifyContent: 'center',
            alignItems: 'center',
        }}>
            <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'var(--text-muted)' }}>
                {label}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                AWAITING DATA...
            </div>
        </div>
    );
}
