import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchSecurityEvents } from '../api/client';
import type { SecurityEvent } from '../types';
import { Badge } from '../components/Badge';
import { TableSkeleton } from '../components/LoadingSkeleton';
import {
  Activity,
  ShieldCheck,
  RotateCw,
  Search,
  Filter,
  AlertTriangle,
  FileText,
  Fingerprint
} from 'lucide-react';

export const AuditDemo: React.FC = () => {
  const { hasScope, activePersonaKey } = useAuth();

  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterResult, setFilterResult] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);

  const canViewAuditLogs = hasScope('admin:manage');

  const loadEvents = async () => {
    try {
      const res = await fetchSecurityEvents(100);
      setEvents(res.events || []);
    } catch (err: any) {
      // In non-admin cases, will be 403
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadEvents();
  }, [activePersonaKey]);

  useEffect(() => {
    if (!autoRefresh || !canViewAuditLogs) return;

    const timer = setInterval(() => {
      loadEvents();
    }, 3000);

    return () => clearInterval(timer);
  }, [autoRefresh, canViewAuditLogs]);

  const filteredEvents = events.filter((ev) => {
    const matchesType = filterType === 'all' || ev.event === filterType;
    const matchesResult = filterResult === 'all' || ev.result === filterResult;
    const matchesSearch =
      searchTerm === '' ||
      ev.event.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.requestId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.principal?.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.resource?.reservationId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.resource?.roomId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.detail?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesType && matchesResult && matchesSearch;
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Real-Time Security & Audit Event Stream</h1>
          <p className="page-subtitle">
            Structured JSON audit records with credential redaction, correlation IDs (<code>X-Request-ID</code>),
            and administrative oversight (<code>admin:manage</code>).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              disabled={!canViewAuditLogs}
            />
            Auto-Refresh (3s)
          </label>

          <button
            onClick={() => loadEvents()}
            disabled={!canViewAuditLogs || loading}
            className="btn btn-secondary"
          >
            <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Security Context & Guarantees Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.03) 0%, rgba(30, 58, 138, 0.05) 100%)',
          borderColor: 'var(--slate-200)',
          marginBottom: '20px',
          padding: '16px 20px'
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <ShieldCheck size={18} color="var(--accent-emerald)" />
              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Credential Redaction</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Raw Bearer tokens, passwords, and private keys are strictly stripped before reaching the log stream.
              Only masked SHA-256 / JWT fingerprints are recorded.
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Fingerprint size={18} color="var(--primary-600)" />
              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>End-to-End Correlation</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Every incoming request receives or carries an <code>X-Request-ID</code> header, tying HTTP client errors directly to security audit events.
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Activity size={18} color="var(--accent-amber)" />
              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Access Control</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              The audit event feed endpoint (<code>/v1/security/events</code>) is protected by Layer 2 and requires the <code>admin:manage</code> scope.
            </p>
          </div>
        </div>
      </div>

      {/* Access Denied Warning if Not Staff/Admin */}
      {!canViewAuditLogs ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <AlertTriangle size={48} color="var(--accent-amber)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
            Access Restricted to Administrators
          </h3>
          <p style={{ maxWidth: '520px', margin: '0 auto 20px', color: 'var(--text-secondary)' }}>
            Your active persona (<strong>{activePersonaKey}</strong>) does not have the <code>admin:manage</code> scope
            required to inspect the central audit stream.
          </p>
          <div style={{ background: 'var(--slate-100)', padding: '12px', borderRadius: '6px', maxWidth: '440px', margin: '0 auto 20px', fontSize: '0.85rem' }}>
            Tip: Switch to the <strong>Staff / Admin</strong> persona using the dropdown at the top right to view live logs.
          </div>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div
            className="card"
            style={{
              padding: '12px 18px',
              marginBottom: '20px',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                <Filter size={15} color="var(--text-muted)" />
                <span style={{ fontWeight: 600 }}>Event:</span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="form-select"
                  style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }}
                >
                  <option value="all">All Events</option>
                  <option value="AUTH_SUCCESS">AUTH_SUCCESS</option>
                  <option value="SCOPE_DENIED">SCOPE_DENIED</option>
                  <option value="OBJECT_DENIED">OBJECT_DENIED</option>
                  <option value="UNAUTHENTICATED">UNAUTHENTICATED</option>
                  <option value="RESERVATION_CREATED">RESERVATION_CREATED</option>
                  <option value="RESERVATION_CANCELLED">RESERVATION_CANCELLED</option>
                  <option value="RESERVATION_CHECKED_IN">RESERVATION_CHECKED_IN</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600 }}>Result:</span>
                <select
                  value={filterResult}
                  onChange={(e) => setFilterResult(e.target.value)}
                  className="form-select"
                  style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }}
                >
                  <option value="all">All Results</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="DENIED">DENIED</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>
            </div>

            <div style={{ position: 'relative', minWidth: '240px' }}>
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px', fontSize: '0.82rem', padding: '6px 10px 6px 32px' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search requestId, user, room..."
              />
            </div>
          </div>

          {/* Events Table */}
          {loading ? (
            <TableSkeleton rows={6} />
          ) : filteredEvents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <Activity size={40} color="var(--slate-300)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontWeight: 600 }}>No audit events found</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Try switching personas or performing operations in the Security Matrix to generate audit traffic.
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event Type</th>
                    <th>Result</th>
                    <th>Principal</th>
                    <th>Target Resource</th>
                    <th>Request ID</th>
                    <th style={{ textAlign: 'right' }}>Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((ev, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>{ev.event}</span>
                      </td>
                      <td>
                        <Badge variant={ev.result === 'SUCCESS' ? 'success' : ev.result === 'DENIED' ? 'danger' : 'warning'}>
                          {ev.result}
                        </Badge>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: 'var(--slate-100)', padding: '2px 6px', borderRadius: '4px' }}>
                          {ev.principal?.subject || 'anonymous'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {ev.resource?.reservationId || ev.resource?.roomId || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {ev.requestId ? ev.requestId.substring(0, 16) + '...' : '—'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedEvent(ev)}
                          className="btn btn-sm btn-secondary"
                          title="View raw JSON audit record"
                        >
                          <FileText size={13} />
                          JSON
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Raw JSON Inspection Modal */}
      {selectedEvent && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000
          }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '680px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} color="var(--primary-600)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                  Audit Event Record: {selectedEvent.event}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="btn btn-sm btn-secondary"
              >
                Close
              </button>
            </div>

            <div style={{ marginBottom: '12px', fontSize: '0.82rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
              ✓ Audit Verification: Plaintext credentials have been redacted. Request correlation ID matched.
            </div>

            <pre
              style={{
                margin: 0,
                background: 'var(--slate-900)',
                color: '#38bdf8',
                padding: '14px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                overflowX: 'auto',
                lineHeight: 1.5
              }}
            >
              {JSON.stringify(selectedEvent, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
