import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { ProblemDetails } from '../types';
import { domainMessageFromProblem } from '../lib/formErrors';

interface ViewErrorPanelProps {
  problem: ProblemDetails;
  willRetry?: boolean;
  onRetry?: () => void;
  title?: string;
}

/** Distinct error state for list/detail views (not empty, not content). */
export const ViewErrorPanel: React.FC<ViewErrorPanelProps> = ({
  problem,
  willRetry = true,
  onRetry,
  title
}) => {
  const message = domainMessageFromProblem(problem);
  const heading = title || problem.title || 'Could not load data';

  return (
    <div
      className="card"
      style={{
        textAlign: 'center',
        padding: '40px 24px',
        borderColor: 'var(--accent-amber-border)',
        background: 'var(--accent-amber-light)'
      }}
      role="alert"
    >
      <AlertTriangle size={40} color="var(--accent-amber)" style={{ margin: '0 auto 12px' }} />
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', color: 'var(--primary-900)' }}>
        {heading}
      </h3>
      <p style={{ maxWidth: '480px', margin: '0 auto 8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        {message}
      </p>
      {willRetry ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          You can retry this request manually.
        </p>
      ) : (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Automatic retry is not available for this error.
        </p>
      )}
      {onRetry && willRetry && (
        <button type="button" className="btn btn-primary" onClick={onRetry} style={{ margin: '0 auto' }}>
          <RotateCcw size={16} />
          Retry
        </button>
      )}
      {problem.requestId && (
        <p style={{ marginTop: '14px', fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
          Request-ID: {problem.requestId}
        </p>
      )}
    </div>
  );
};

interface FieldErrorProps {
  message?: string;
}

export const FieldError: React.FC<FieldErrorProps> = ({ message }) => {
  if (!message) return null;
  return (
    <p
      style={{
        marginTop: '6px',
        fontSize: '0.78rem',
        color: 'var(--rose-600)',
        fontWeight: 600
      }}
      role="alert"
    >
      {message}
    </p>
  );
};

interface FormErrorBannerProps {
  message?: string;
}

export const FormErrorBanner: React.FC<FormErrorBannerProps> = ({ message }) => {
  if (!message) return null;
  return (
    <div
      style={{
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        marginBottom: '12px',
        fontSize: '0.85rem',
        color: '#991b1b'
      }}
      role="alert"
    >
      {message}
    </div>
  );
};
