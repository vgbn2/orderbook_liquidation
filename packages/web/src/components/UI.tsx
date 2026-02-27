import React, { useState } from 'react';

/**
 * terminus-ui.tsx
 * Shared component DNA for the Terminus platform.
 * All components follow the DESIGN_TOKENS defined in index.css
 */

// ── TYPES ──────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    isActive?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

interface BadgeProps {
    type: 'live' | 'new' | 'hot' | 'beta' | 'pinned' | 'fixed';
    label?: string;
    className?: string;
}

interface PanelSectionProps {
    title: string;
    isCollapsible?: boolean;
    isPinnable?: boolean;
    isPinned?: boolean;
    onPin?: () => void;
    children: React.ReactNode;
    defaultCollapsed?: boolean;
}

interface StatCardProps {
    label: string;
    value: string | number;
    valueColor?: string;
    trend?: 'up' | 'down' | 'neutral';
}

// ── BUTTON ─────────────────────────────────────────────────

export const Button: React.FC<ButtonProps> = ({
    variant = 'ghost',
    isActive = false,
    size = 'md',
    children,
    className = '',
    style,
    ...props
}) => {
    const baseClass = `terminus-button variant-${variant} size-${size} ${isActive ? 'terminus-button-active' : ''} ${className}`;

    return (
        <button className={baseClass} style={style} {...props}>
            {children}
        </button>
    );
};

// ── BADGE ──────────────────────────────────────────────────

export const Badge: React.FC<BadgeProps> = ({ type, label, className = '' }) => {
    const config = {
        live: { color: 'var(--color-positive)', dot: true },
        new: { color: 'var(--color-accent)', dot: false },
        hot: { color: 'var(--color-negative)', dot: false },
        beta: { color: 'var(--color-warning)', dot: false },
        pinned: { color: 'var(--color-text-secondary)', icon: '📌' },
        fixed: { color: 'var(--color-positive)', dot: false },
    }[type];

    return (
        <span
            className={`terminus-badge badge-${type} ${className}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '1px 6px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-normal)',
                textTransform: 'uppercase',
                background: `${config.color}20`,
                color: config.color,
                border: `1px solid ${config.color}30`,
            }}
        >
            {config.dot && <span style={{ width: 4, height: 4, borderRadius: '50%', background: config.color }} />}
            {config.icon && <span style={{ fontSize: '8px' }}>{config.icon}</span>}
            {label || type}
        </span>
    );
};

// ── TOGGLE ─────────────────────────────────────────────────

export const Toggle: React.FC<{ isOn: boolean; onChange: () => void; labelOn?: string; labelOff?: string }> = ({
    isOn,
    onChange,
    labelOn = 'ON',
    labelOff = 'OFF'
}) => (
    <button
        onClick={onChange}
        style={{
            height: '22px',
            padding: '0 8px',
            borderRadius: 'var(--radius-pill)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-bold)',
            letterSpacing: 'var(--tracking-wide)',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'all 0.15s',
            border: isOn ? 'none' : '1px solid var(--color-border-medium)',
            background: isOn ? 'var(--color-accent)' : 'var(--color-bg-overlay)',
            color: isOn ? 'var(--color-bg-base)' : 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}
    >
        {isOn ? labelOn : labelOff}
    </button>
);

// ── STAT CARD ──────────────────────────────────────────────

export const StatCard: React.FC<StatCardProps> = ({ label, value, valueColor, trend }) => {
    const color = valueColor || (trend === 'up' ? 'var(--color-positive)' : trend === 'down' ? 'var(--color-negative)' : 'var(--color-text-primary)');

    return (
        <div style={{
            background: 'var(--color-bg-raised)',
            border: '1px solid var(--color-border-medium)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
        }}>
            <span className="terminus-label">{label}</span>
            <span className="terminus-value" style={{ color }}>{value}</span>
        </div>
    );
};

// ── PANEL SECTION ─────────────────────────────────────────

export const PanelSection: React.FC<PanelSectionProps> = ({
    title,
    isCollapsible = true,
    isPinnable = false,
    isPinned = false,
    onPin,
    children,
    defaultCollapsed = false,
}) => {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    return (
        <div style={{ borderBottom: '1px solid var(--color-border-medium)' }}>
            <div className="terminus-panel-header" style={{ cursor: isCollapsible ? 'pointer' : 'default' }} onClick={() => isCollapsible && setIsCollapsed(!isCollapsed)}>
                <span className="terminus-label" style={{ flex: 1, color: 'var(--color-text-secondary)' }}>
                    {title}
                </span>

                {isPinnable && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onPin?.(); }}
                        style={{ background: 'none', border: 'none', color: isPinned ? 'var(--color-accent)' : 'var(--color-text-muted)', cursor: 'pointer', marginRight: 'var(--space-2)', fontSize: '10px' }}
                    >
                        {isPinned ? '📌' : '📍'}
                    </button>
                )}

                {isCollapsible && (
                    <span style={{
                        fontSize: '8px',
                        color: 'var(--color-text-muted)',
                        transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                        transition: 'transform 0.1s'
                    }}>
                        ▼
                    </span>
                )}
            </div>

            {!isCollapsed && (
                <div style={{ padding: 'var(--space-3)' }}>
                    {children}
                </div>
            )}
        </div>
    );
};

// ── INPUT ──────────────────────────────────────────────────

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input
        {...props}
        style={{
            height: 'var(--h-input)',
            padding: '0 var(--space-3)',
            background: 'var(--color-bg-raised)',
            border: '1px solid var(--color-border-medium)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-md)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-primary)',
            width: '100%',
            outline: 'none',
            ...props.style
        }}
        className="terminus-input"
    />
);
