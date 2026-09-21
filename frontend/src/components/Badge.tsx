import React from 'react';

export interface BadgeProps {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'outline';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  children,
  className = '',
  style
}) => {
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'rgba(30, 58, 138, 0.1)',
      color: 'var(--primary-800)',
      border: '1px solid rgba(30, 58, 138, 0.2)'
    },
    success: {
      background: 'rgba(16, 185, 129, 0.12)',
      color: '#065f46',
      border: '1px solid rgba(16, 185, 129, 0.25)'
    },
    warning: {
      background: 'rgba(245, 158, 11, 0.12)',
      color: '#92400e',
      border: '1px solid rgba(245, 158, 11, 0.25)'
    },
    danger: {
      background: 'rgba(239, 68, 68, 0.12)',
      color: '#991b1b',
      border: '1px solid rgba(239, 68, 68, 0.25)'
    },
    neutral: {
      background: 'rgba(100, 116, 139, 0.1)',
      color: '#334155',
      border: '1px solid rgba(100, 116, 139, 0.2)'
    },
    outline: {
      background: 'transparent',
      color: 'var(--text-main)',
      border: '1px solid var(--border)'
    }
  };

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '6px',
    fontSize: '0.78rem',
    fontWeight: 600,
    lineHeight: 1.4,
    ...variantStyles[variant],
    ...style
  };

  return (
    <span className={`custom-badge ${className}`} style={baseStyle}>
      {children}
    </span>
  );
};

export interface StatusBadgeProps {
  status: 'pending_checkin' | 'checked_in' | 'cancelled' | 'no_show' | 'completed' | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'pending_checkin':
      return <Badge variant="warning">● Pending Check-in</Badge>;
    case 'checked_in':
      return <Badge variant="success">✓ Checked In</Badge>;
    case 'cancelled':
      return <Badge variant="danger">✕ Cancelled</Badge>;
    case 'completed':
      return <Badge variant="neutral">✓ Completed</Badge>;
    case 'no_show':
      return <Badge variant="danger">! No Show</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
};

export interface ScopeBadgeProps {
  scope: string;
  granted?: boolean;
}

export const ScopeBadge: React.FC<ScopeBadgeProps> = ({ scope, granted = true }) => {
  return (
    <Badge variant={granted ? 'primary' : 'neutral'}>
      {granted ? '✓ ' : ''}{scope}
    </Badge>
  );
};
