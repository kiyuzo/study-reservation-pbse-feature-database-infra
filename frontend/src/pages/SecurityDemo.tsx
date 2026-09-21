import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  fetchReservationById,
  checkInReservation,
  cancelReservation,
  getLastRequestId,
  ProblemError
} from '../api/client';
import { Badge } from '../components/Badge';
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  CheckCircle2,
  XCircle,
  Play,
  RefreshCw,
  Layers,
  Fingerprint
} from 'lucide-react';

export const SecurityDemo: React.FC = () => {
  const {
    activePersonaKey,
    activePersona,
    personas,
    principal,
    tokenFingerprint,
    scopes,
    selectPersona,
    hasScope
  } = useAuth();

  const { showSuccess } = useToast();

  // Test bench state for Layer 3 Object Access
  const [targetReservationId, setTargetReservationId] = useState<string>('rsv_Aa1Bb2');
  const [testingObject, setTestingObject] = useState<boolean>(false);
  const [objectTestResult, setObjectTestResult] = useState<{
    status: number;
    statusText: string;
    action: string;
    requestId: string;
    payload: any;
    isError: boolean;
  } | null>(null);

  // Test bench state for Layer 2 Scope Checking
  const [testingScope, setTestingScope] = useState<string | null>(null);
  const [scopeTestResult, setScopeTestResult] = useState<{
    scope: string;
    endpoint: string;
    status: number;
    granted: boolean;
    problem?: any;
    requestId: string;
  } | null>(null);

  // Idempotency Sandbox State
  const [idempotencyKey, setIdempotencyKey] = useState<string>(crypto.randomUUID());
  const [idempotencyLoading, setIdempotencyLoading] = useState<boolean>(false);
  const [idempotencyLogs, setIdempotencyLogs] = useState<
    Array<{ step: string; status: number; result: any; time: string }>
  >([]);

  // -------------------------------------------------------------------------
  // Handlers for Layer 3 Object Ownership Test
  // -------------------------------------------------------------------------
  const runObjectAccessTest = async (action: 'read' | 'checkin' | 'cancel') => {
    setTestingObject(true);
    setObjectTestResult(null);

    const actionDescriptions = {
      read: `GET /v1/reservations/${targetReservationId}`,
      checkin: `POST /v1/reservations/${targetReservationId}/checkin`,
      cancel: `POST /v1/reservations/${targetReservationId}/cancellation`
    };

    try {
      let res: any;
      if (action === 'read') {
        res = await fetchReservationById(targetReservationId);
      } else if (action === 'checkin') {
        res = await checkInReservation(targetReservationId);
      } else {
        res = await cancelReservation(targetReservationId, 'Security test cancellation');
      }

      setObjectTestResult({
        status: action === 'cancel' ? 200 : 200,
        statusText: 'OK',
        action: actionDescriptions[action],
        requestId: getLastRequestId(),
        payload: res,
        isError: false
      });
      showSuccess('Access Granted', `${actionDescriptions[action]} authorized for ${principal?.subject || activePersonaKey}`);
    } catch (err: any) {
      if (err instanceof ProblemError) {
        setObjectTestResult({
          status: err.status,
          statusText: err.problem.title || 'Error',
          action: actionDescriptions[action],
          requestId: err.requestId,
          payload: err.problem,
          isError: true
        });
      } else {
        setObjectTestResult({
          status: 500,
          statusText: 'Client Error',
          action: actionDescriptions[action],
          requestId: getLastRequestId(),
          payload: { detail: err.message },
          isError: true
        });
      }
    } finally {
      setTestingObject(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers for Layer 2 Scope Check Test
  // -------------------------------------------------------------------------
  const runScopeTest = async (testType: 'rooms' | 'reservations_read' | 'reservations_write' | 'admin') => {
    setTestingScope(testType);
    setScopeTestResult(null);

    let endpoint = '';
    let requiredScope = '';

    try {
      if (testType === 'rooms') {
        endpoint = 'GET /v1/rooms';
        requiredScope = 'rooms:read';
        const res = await fetch('/v1/rooms', {
          headers: activePersona?.token ? { Authorization: `Bearer ${activePersona.token}` } : {}
        });
        const reqId = res.headers.get('X-Request-ID') || '';
        const body = await res.json();

        setScopeTestResult({
          scope: requiredScope,
          endpoint,
          status: res.status,
          granted: res.ok,
          problem: res.ok ? body : body,
          requestId: reqId
        });
      } else if (testType === 'reservations_read') {
        endpoint = 'GET /v1/reservations';
        requiredScope = 'reservations:read';
        const res = await fetch('/v1/reservations', {
          headers: activePersona?.token ? { Authorization: `Bearer ${activePersona.token}` } : {}
        });
        const reqId = res.headers.get('X-Request-ID') || '';
        const body = await res.json();

        setScopeTestResult({
          scope: requiredScope,
          endpoint,
          status: res.status,
          granted: res.ok,
          problem: res.ok ? body : body,
          requestId: reqId
        });
      } else if (testType === 'reservations_write') {
        endpoint = 'POST /v1/reservations';
        requiredScope = 'reservations:create';
        const res = await fetch('/v1/reservations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
            ...(activePersona?.token ? { Authorization: `Bearer ${activePersona.token}` } : {})
          },
          body: JSON.stringify({
            roomId: 'room-101',
            date: '2026-11-20',
            startTime: '14:00',
            endTime: '15:00'
          })
        });
        const reqId = res.headers.get('X-Request-ID') || '';
        const body = await res.json();

        setScopeTestResult({
          scope: requiredScope,
          endpoint,
          status: res.status,
          granted: res.ok,
          problem: res.ok ? body : body,
          requestId: reqId
        });
      } else if (testType === 'admin') {
        endpoint = 'GET /v1/security/events';
        requiredScope = 'admin:manage';
        const res = await fetch('/v1/security/events', {
          headers: activePersona?.token ? { Authorization: `Bearer ${activePersona.token}` } : {}
        });
        const reqId = res.headers.get('X-Request-ID') || '';
        const body = await res.json();

        setScopeTestResult({
          scope: requiredScope,
          endpoint,
          status: res.status,
          granted: res.ok,
          problem: res.ok ? body : body,
          requestId: reqId
        });
      }
    } catch (err: any) {
      setScopeTestResult({
        scope: requiredScope,
        endpoint,
        status: 0,
        granted: false,
        problem: { detail: err.message },
        requestId: ''
      });
    } finally {
      setTestingScope(null);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers for Idempotency Sandbox
  // -------------------------------------------------------------------------
  const runIdempotencyReplay = async (conflict: boolean) => {
    setIdempotencyLoading(true);
    const key = idempotencyKey;

    try {
      const payload = conflict
        ? { roomId: 'room-202', date: '2026-12-01', startTime: '16:00', endTime: '18:00' }
        : { roomId: 'room-101', date: '2026-11-25', startTime: '09:00', endTime: '11:00' };

      const res = await fetch('/v1/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
          ...(activePersona?.token ? { Authorization: `Bearer ${activePersona.token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const body = await res.json();
      setIdempotencyLogs((prev) => [
        {
          step: conflict ? 'Conflict Request (Different Body)' : 'Replay Request (Identical Body)',
          status: res.status,
          result: body,
          time: new Date().toLocaleTimeString()
        },
        ...prev
      ]);
    } catch (err: any) {
      setIdempotencyLogs((prev) => [
        {
          step: 'Network Error',
          status: 0,
          result: { error: err.message },
          time: new Date().toLocaleTimeString()
        },
        ...prev
      ]);
    } finally {
      setIdempotencyLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Security Architecture & Access Matrix Demo</h1>
        <p className="page-subtitle">
          Interactive verification playground for <strong>Step 7–9 Security Layers</strong>:
          Token Security, Scope-based Authorization (Layer 2), Instance Object Ownership (Layer 3), and Idempotency.
        </p>
      </div>

      {/* Layer 1: Token Authentication & Identity Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Key size={22} color="var(--primary-600)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Layer 1: Identity & Token Security
            </h2>
          </div>
          <Badge variant={principal ? 'success' : 'danger'}>
            {principal ? 'Authenticated (200 OK)' : 'Unauthenticated (401 Unauthorized)'}
          </Badge>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div style={{ background: 'var(--slate-50)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Subject Principal (sub)
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-900)', marginTop: '4px' }}>
              {principal ? principal.subject : 'Anonymous (No Token)'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Kind: <code>{principal ? principal.kind : 'none'}</code> | Persona: <code>{activePersonaKey}</code>
            </div>
          </div>

          <div style={{ background: 'var(--slate-50)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Token Fingerprint (Redacted)
            </div>
            <div style={{ fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--slate-700)', marginTop: '6px' }}>
              <Fingerprint size={14} style={{ display: 'inline', marginRight: '6px' }} />
              {tokenFingerprint || 'None'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', marginTop: '6px', fontWeight: 500 }}>
              ✓ Sensitive bearer secrets are never leaked to logs or client errors.
            </div>
          </div>

          <div style={{ background: 'var(--slate-50)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Granted Scopes (Layer 2)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {scopes.length > 0 ? (
                scopes.map((s) => (
                  <Badge key={s} variant="primary">
                    {s}
                  </Badge>
                ))
              ) : (
                <span style={{ fontSize: '0.82rem', color: 'var(--accent-rose)', fontWeight: 600 }}>
                  No scopes granted
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Persona Switcher in Page */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: 'var(--primary-50)', padding: '12px 16px', borderRadius: '8px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-900)' }}>
            Switch Persona:
          </span>
          {Object.entries(personas).map(([key, p]) => (
            <button
              key={key}
              onClick={() => selectPersona(key)}
              className={`btn btn-sm ${activePersonaKey === key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem' }}
            >
              {p.name || p.label || key}
            </button>
          ))}
          <button
            onClick={() => selectPersona('unauthenticated')}
            className={`btn btn-sm ${activePersonaKey === 'unauthenticated' ? 'btn-danger' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem' }}
          >
            Anonymous (401)
          </button>
          <button
            onClick={() => selectPersona('malformed')}
            className={`btn btn-sm ${activePersonaKey === 'malformed' ? 'btn-danger' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem' }}
          >
            Malformed (401)
          </button>
        </div>
      </div>

      {/* Layer 2: Scope-Based Authorization Sandbox */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={22} color="var(--accent-amber)" />
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Layer 2: Scope Checking (`requireScope`)
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Verifies caller possesses required OAuth scopes before route execution. Rejects with 403 `insufficient_scope`.
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div className="card" style={{ padding: '14px', background: 'var(--slate-50)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>rooms:read</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Allows viewing room catalogs
            </div>
            <button
              onClick={() => runScopeTest('rooms')}
              disabled={testingScope !== null}
              className="btn btn-sm btn-secondary"
              style={{ width: '100%' }}
            >
              Test `GET /v1/rooms`
            </button>
          </div>

          <div className="card" style={{ padding: '14px', background: 'var(--slate-50)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>reservations:read</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Allows listing active reservations
            </div>
            <button
              onClick={() => runScopeTest('reservations_read')}
              disabled={testingScope !== null}
              className="btn btn-sm btn-secondary"
              style={{ width: '100%' }}
            >
              Test `GET /v1/reservations`
            </button>
          </div>

          <div className="card" style={{ padding: '14px', background: 'var(--slate-50)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>reservations:create</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Allows creating new room booking
            </div>
            <button
              onClick={() => runScopeTest('reservations_write')}
              disabled={testingScope !== null}
              className="btn btn-sm btn-secondary"
              style={{ width: '100%' }}
            >
              Test `POST /v1/reservations`
            </button>
          </div>

          <div className="card" style={{ padding: '14px', background: 'var(--slate-50)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>admin:manage</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Supervisory access to audit logs
            </div>
            <button
              onClick={() => runScopeTest('admin')}
              disabled={testingScope !== null}
              className="btn btn-sm btn-secondary"
              style={{ width: '100%' }}
            >
              Test `GET /v1/security/events`
            </button>
          </div>
        </div>

        {/* Scope Test Output */}
        {scopeTestResult && (
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: scopeTestResult.granted ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${scopeTestResult.granted ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {scopeTestResult.granted ? (
                  <CheckCircle2 size={18} color="var(--accent-emerald)" />
                ) : (
                  <XCircle size={18} color="var(--accent-rose)" />
                )}
                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                  {scopeTestResult.endpoint} &rarr; Status {scopeTestResult.status}
                </span>
                <Badge variant={scopeTestResult.granted ? 'success' : 'danger'}>
                  {scopeTestResult.granted ? 'Scope Allowed' : '403 Forbidden'}
                </Badge>
              </div>
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                X-Request-ID: {scopeTestResult.requestId}
              </span>
            </div>

            <pre
              style={{
                margin: 0,
                background: 'var(--slate-900)',
                color: '#e2e8f0',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                overflowX: 'auto',
                maxHeight: '180px'
              }}
            >
              {JSON.stringify(scopeTestResult.problem, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Layer 3: Object-Level Checking (Instance Ownership) Sandbox */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={22} color="var(--accent-emerald)" />
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Layer 3: Object Ownership Checking (`enforceReservationOwnership`)
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Enforces instance-level boundary: Students can only access their own reservations. Prevents IDOR vulnerabilities.
              </span>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--slate-50)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '14px' }}>
            <div style={{ flex: '1 1 240px' }}>
              <label className="form-label" htmlFor="targetReservationInput">
                Target Reservation ID to Access:
              </label>
              <input
                id="targetReservationInput"
                type="text"
                className="form-input"
                value={targetReservationId}
                onChange={(e) => setTargetReservationId(e.target.value)}
                placeholder="e.g. rsv_9X8y7Z or rsv_Aa1Bb2"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setTargetReservationId('rsv_9X8y7Z')}
                className="btn btn-sm btn-secondary"
                title="Owned by student-a"
              >
                Use Student A's (`rsv_9X8y7Z`)
              </button>
              <button
                type="button"
                onClick={() => setTargetReservationId('rsv_Aa1Bb2')}
                className="btn btn-sm btn-secondary"
                title="Owned by student-b"
              >
                Use Student B's (`rsv_Aa1Bb2`)
              </button>
              <button
                type="button"
                onClick={() => setTargetReservationId('rsv_Cc3Dd4')}
                className="btn btn-sm btn-secondary"
                title="Owned by student-c"
              >
                Use Student C's (`rsv_Cc3Dd4`)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => runObjectAccessTest('read')}
              disabled={testingObject}
              className="btn btn-primary"
            >
              <Play size={15} />
              Test Read (GET /v1/reservations/:id)
            </button>

            <button
              onClick={() => runObjectAccessTest('checkin')}
              disabled={testingObject}
              className="btn btn-secondary"
            >
              <CheckCircle2 size={15} color="var(--accent-emerald)" />
              Test Check-In (POST :id/checkin)
            </button>

            <button
              onClick={() => runObjectAccessTest('cancel')}
              disabled={testingObject}
              className="btn btn-secondary"
            >
              <XCircle size={15} color="var(--accent-rose)" />
              Test Cancel (POST :id/cancellation)
            </button>
          </div>
        </div>

        {/* Object Test Result Display */}
        {objectTestResult && (
          <div
            style={{
              padding: '18px',
              borderRadius: '8px',
              background: objectTestResult.isError ? 'rgba(239, 68, 68, 0.07)' : 'rgba(16, 185, 129, 0.07)',
              border: `1px solid ${objectTestResult.isError ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {objectTestResult.isError ? (
                  <ShieldAlert size={22} color="var(--accent-rose)" />
                ) : (
                  <ShieldCheck size={22} color="var(--accent-emerald)" />
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {objectTestResult.action}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Caller: <strong>{principal?.subject || activePersonaKey}</strong> &bull; Response: <strong>{objectTestResult.status} {objectTestResult.statusText}</strong>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <Badge variant={objectTestResult.isError ? 'danger' : 'success'}>
                  {objectTestResult.status === 403
                    ? '403 Forbidden (Layer 3 Blocked)'
                    : objectTestResult.status === 200
                    ? '200 OK (Authorized)'
                    : `${objectTestResult.status}`}
                </Badge>
                <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '4px' }}>
                  X-Request-ID: {objectTestResult.requestId}
                </div>
              </div>
            </div>

            {/* Invariant Explanation Callout */}
            {objectTestResult.status === 403 && (
              <div
                style={{
                  background: 'white',
                  border: '1px solid var(--accent-rose)',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  fontSize: '0.84rem',
                  marginBottom: '12px',
                  color: 'var(--accent-rose)'
                }}
              >
                <strong>Security Invariant Verified:</strong> Notice the detail message states:{' '}
                <em>"You do not have permission to access or modify this reservation."</em>{' '}
                The response <strong>never discloses who actually owns the reservation</strong> to prevent student enumeration.
              </div>
            )}

            <pre
              style={{
                margin: 0,
                background: 'var(--slate-900)',
                color: '#e2e8f0',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                overflowX: 'auto',
                maxHeight: '220px'
              }}
            >
              {JSON.stringify(objectTestResult.payload, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Idempotency Sandbox */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RefreshCw size={22} color="var(--primary-600)" />
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Idempotency & Replay Protection Sandbox
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Verifies RFC-compliant handling: identical key replays cached response, mismatched body returns 409 Conflict.
              </span>
            </div>
          </div>
          <button
            onClick={() => setIdempotencyKey(crypto.randomUUID())}
            className="btn btn-sm btn-secondary"
          >
            Generate New Key
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', background: 'var(--slate-100)', padding: '6px 12px', borderRadius: '4px' }}>
            Current Key: <strong>{idempotencyKey}</strong>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => runIdempotencyReplay(false)}
              disabled={idempotencyLoading || !hasScope('reservations:create')}
              className="btn btn-sm btn-primary"
            >
              Send Request with Key
            </button>
            <button
              onClick={() => runIdempotencyReplay(true)}
              disabled={idempotencyLoading || !hasScope('reservations:create')}
              className="btn btn-sm btn-danger"
              title="Sends same key but with different room/time to trigger 409 Conflict"
            >
              Send Conflicting Body (Triggers 409)
            </button>
          </div>
        </div>

        {idempotencyLogs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {idempotencyLogs.map((log, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--slate-50)',
                  border: '1px solid var(--border-color)',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{log.step}</span>
                  <span style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>({log.time})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Badge variant={log.status === 201 ? 'success' : log.status === 409 ? 'warning' : 'neutral'}>
                    HTTP {log.status}
                  </Badge>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {log.result.id || log.result.title || 'ok'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
