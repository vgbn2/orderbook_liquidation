// ─────────────────────────────────────────────────────────────────────────────
// components/shared/ErrorBoundary.tsx
//
// Wraps any panel or component. If it throws, only that panel shows an error —
// the rest of the app keeps working.
//
// Usage:
//   <ErrorBoundary name="QuantPanel">
//     <QuantPanel />
//   </ErrorBoundary>
// ─────────────────────────────────────────────────────────────────────────────

import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
    children: ReactNode;
    /** Label shown in the error fallback UI */
    name?: string;
    /** Optional custom fallback. Receives the error if you want to show details. */
    fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // In production you'd send this to Sentry / Datadog / etc.
        console.error(`[ErrorBoundary:${this.props.name ?? 'unknown'}]`, error, info.componentStack);
    }

    reset = () => this.setState({ error: null });

    render() {
        const { error } = this.state;
        const { children, name, fallback } = this.props;

        if (!error) return children;

        if (fallback) return fallback(error, this.reset);

        return (
            <div style={{
                padding: '12px',
                margin: '8px',
                background: 'rgba(255,45,78,0.08)',
                border: '1px solid rgba(255,45,78,0.3)',
                borderRadius: '6px',
                fontFamily: 'JetBrains Mono, monospace',
            }}>
                <div style={{ fontSize: '11px', color: '#ff2d4e', fontWeight: 700, marginBottom: '4px' }}>
                    ⚠ {name ?? 'Component'} error
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,45,78,0.7)', marginBottom: '8px' }}>
                    {error.message}
                </div>
                <button
                    onClick={this.reset}
                    style={{
                        fontSize: '10px',
                        padding: '3px 8px',
                        background: 'rgba(255,45,78,0.15)',
                        border: '1px solid rgba(255,45,78,0.4)',
                        borderRadius: '3px',
                        color: '#ff2d4e',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }
}
