import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { fetchReservations, cancelReservation, checkInReservation } from '../api/client';
import type { Reservation } from '../types';
import { Badge, StatusBadge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { TableSkeleton } from '../components/LoadingSkeleton';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Info,
  UserCheck
} from 'lucide-react';

interface MyReservationsProps {
  onNavigate: (tab: string, entityId?: string) => void;
}

export const MyReservations: React.FC<MyReservationsProps> = ({ onNavigate }) => {
  const { activePersonaKey, principal, hasScope } = useAuth();
  const { showSuccess, showError } = useToast();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // Cancellation modal state
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [targetReservation, setTargetReservation] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelling, setCancelling] = useState<boolean>(false);

  // Checkin state
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const canReadReservations = hasScope('reservations:read') || hasScope('admin:manage');
  const canCancel = hasScope('reservations:cancel') || hasScope('reservations:write') || hasScope('admin:manage');
  const canCheckIn = hasScope('reservations:checkin') || hasScope('admin:manage');

  const loadReservations = async () => {
    if (!canReadReservations) {
      setReservations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const filter = statusFilter === 'all' ? undefined : statusFilter;
      const res = await fetchReservations(filter);
      setReservations(res.items || []);
    } catch (err: any) {
      showError(err);
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, [activePersonaKey, statusFilter]);

  const handleOpenCancel = (r: Reservation) => {
    setTargetReservation(r);
    setCancelReason('Schedule conflict / Exam completed early');
    setCancelModalOpen(true);
  };

  const handleExecuteCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetReservation) return;

    setCancelling(true);
    try {
      const cancellation = await cancelReservation(targetReservation.id, cancelReason);
      showSuccess(
        'Reservation Cancelled',
        `Reservation ${targetReservation.id} was successfully cancelled at ${new Date(cancellation.cancelledAt).toLocaleTimeString()}.`
      );
      setCancelModalOpen(false);
      setTargetReservation(null);
      await loadReservations();
    } catch (err: any) {
      showError(err);
    } finally {
      setCancelling(false);
    }
  };

  const handleExecuteCheckIn = async (r: Reservation) => {
    setCheckingInId(r.id);
    try {
      const updated = await checkInReservation(r.id);
      showSuccess('Checked In Successfully', `You have checked in for ${updated.id}. Your desk is ready!`);
      await loadReservations();
    } catch (err: any) {
      showError(err);
    } finally {
      setCheckingInId(null);
    }
  };

  const isOwner = (r: Reservation) => {
    if (!principal) return false;
    if (principal.kind === 'staff' || principal.scopes.includes('admin:manage')) return true;
    return r.userId === principal.subject;
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">My Room Reservations</h1>
          <p className="page-subtitle">
            View, check-in, or cancel your active study room bookings. Protected by Layer 3 Object Ownership verification.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => loadReservations()}
            className="btn btn-secondary"
            title="Refresh list from backend"
          >
            <RotateCcw size={16} />
            Refresh
          </button>
          <button
            onClick={() => onNavigate('rooms')}
            className="btn btn-primary"
          >
            <Calendar size={16} />
            Book a Study Room
          </button>
        </div>
      </div>

      {/* Layer 3 Security Callout Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.04) 0%, rgba(14, 165, 233, 0.06) 100%)',
          borderColor: 'var(--primary-200)',
          marginBottom: '24px',
          padding: '16px 20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'var(--primary-100)',
              color: 'var(--primary-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-900)' }}>
                Active Security Context: {principal ? principal.subject : activePersonaKey}
              </span>
              <Badge variant={canReadReservations ? 'success' : 'danger'}>
                {canReadReservations ? 'Layer 2: Scope Authorized' : 'Layer 2: Scope Missing'}
              </Badge>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Layer 3 (Object Ownership) ensures you only have access to your own reservation records.
              Staff and administrators have supervisory access across all student records.
            </p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div
        className="card"
        style={{
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Status Filter:
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'pending_checkin', 'checked_in', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
                style={{ textTransform: 'capitalize' }}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing <strong>{reservations.length}</strong> reservation{reservations.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Main Content Area */}
      {!canReadReservations ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <AlertTriangle size={48} color="var(--accent-amber)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
            Access Denied: Insufficient Scopes (Layer 2)
          </h3>
          <p style={{ maxWidth: '520px', margin: '0 auto 20px', color: 'var(--text-secondary)' }}>
            Your current persona (<strong>{activePersonaKey}</strong>) lacks the <code>reservations:read</code> scope
            required to query the reservation database.
          </p>
          <button
            onClick={() => onNavigate('security')}
            className="btn btn-primary"
            style={{ margin: '0 auto' }}
          >
            <ShieldCheck size={16} />
            Test Permissions in Security Matrix
          </button>
        </div>
      ) : loading ? (
        <TableSkeleton rows={4} />
      ) : reservations.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Calendar size={48} color="var(--primary-300)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>
            No Reservations Found
          </h3>
          <p style={{ maxWidth: '420px', margin: '0 auto 20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            There are currently no {statusFilter !== 'all' ? statusFilter.replace('_', ' ') : ''} reservations matching your active filter.
          </p>
          <button onClick={() => onNavigate('rooms')} className="btn btn-primary" style={{ margin: '0 auto' }}>
            Browse Study Rooms
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Reservation ID</th>
                <th>Room</th>
                <th>Date & Schedule</th>
                <th>Owner (Layer 3)</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => {
                const ownerMatch = isOwner(r);
                return (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-800)' }}>
                        {r.id}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.roomId}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                          <Calendar size={13} color="var(--text-muted)" />
                          <span>{r.date}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <Clock size={13} color="var(--text-muted)" />
                          <span>{r.startTime} – {r.endTime}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.82rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: ownerMatch ? 'var(--primary-50)' : 'var(--slate-100)',
                            color: ownerMatch ? 'var(--primary-800)' : 'var(--slate-700)',
                            fontWeight: 600
                          }}
                        >
                          {r.userId || 'student-a'}
                        </span>
                        {ownerMatch && (
                          <span title="You own this resource" style={{ color: 'var(--accent-emerald)', display: 'flex' }}>
                            <UserCheck size={14} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        {/* Check In Action */}
                        {(r.canCheckIn || r.status === 'pending_checkin') && (
                          <button
                            onClick={() => handleExecuteCheckIn(r)}
                            disabled={!canCheckIn || checkingInId === r.id || !ownerMatch}
                            className="btn btn-sm btn-outline"
                            style={{
                              borderColor: 'var(--accent-emerald)',
                              color: 'var(--accent-emerald)'
                            }}
                            title={
                              !canCheckIn
                                ? 'Missing reservations:checkin scope'
                                : !ownerMatch
                                  ? 'Layer 3 Object Restriction: You are not the owner'
                                  : 'Check in to your reserved desk'
                            }
                          >
                            <CheckCircle2 size={14} />
                            {checkingInId === r.id ? 'Checking In...' : 'Check-In'}
                          </button>
                        )}

                        {/* Cancel Action */}
                        {(r.cancellable || r.status !== 'cancelled') && (
                          <button
                            onClick={() => handleOpenCancel(r)}
                            disabled={!canCancel || !ownerMatch}
                            className="btn btn-sm btn-outline"
                            style={{
                              borderColor: 'var(--accent-rose)',
                              color: 'var(--accent-rose)'
                            }}
                            title={
                              !canCancel
                                ? 'Missing reservations:cancel scope'
                                : !ownerMatch
                                  ? 'Layer 3 Object Restriction: You are not the owner'
                                  : 'Cancel reservation'
                            }
                          >
                            <XCircle size={14} />
                            Cancel
                          </button>
                        )}

                        {/* Inspect Action */}
                        <button
                          onClick={() => setSelectedReservation(r)}
                          className="btn btn-sm btn-secondary"
                          title="View representation links & details"
                        >
                          <Info size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reservation Details Modal */}
      {selectedReservation && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedReservation(null)}
          title={`Reservation Details: ${selectedReservation.id}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div className="card" style={{ padding: '12px', background: 'var(--slate-50)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Room ID
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-900)' }}>
                  {selectedReservation.roomId}
                </div>
              </div>
              <div className="card" style={{ padding: '12px', background: 'var(--slate-50)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Current Status
                </span>
                <div style={{ marginTop: '4px' }}>
                  <StatusBadge status={selectedReservation.status} />
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Booking Schedule
              </h4>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem' }}>
                <div>Date: <strong>{selectedReservation.date}</strong></div>
                <div>Time: <strong>{selectedReservation.startTime} – {selectedReservation.endTime}</strong></div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Security Ownership Metadata (Layer 3)
              </h4>
              <div style={{ background: 'var(--slate-100)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem' }}>
                <div>Owner Principal ID: <code>{selectedReservation.userId}</code></div>
                <div>Your Active Persona: <code>{principal ? principal.subject : activePersonaKey}</code></div>
                <div style={{ marginTop: '4px', color: isOwner(selectedReservation) ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: 600 }}>
                  {isOwner(selectedReservation) ? '✓ Ownership Verified (Access Granted)' : '✕ Object Access Denied by Layer 3'}
                </div>
              </div>
            </div>

            {selectedReservation._links && (
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  HATEOAS Representation Links
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Object.entries(selectedReservation._links).map(([rel, linkObj]) => (
                    <div key={rel} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', background: 'var(--slate-50)', padding: '6px 10px', borderRadius: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--primary-700)' }}>{rel}</span>
                      <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{linkObj.href}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancelModalOpen && targetReservation && (
        <Modal
          isOpen={true}
          onClose={() => setCancelModalOpen(false)}
          title="Confirm Reservation Cancellation"
        >
          <form onSubmit={handleExecuteCancel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '12px 16px',
                color: 'var(--accent-rose)',
                fontSize: '0.88rem'
              }}
            >
              <strong>Warning:</strong> You are about to cancel booking <code>{targetReservation.id}</code> for room{' '}
              <strong>{targetReservation.roomId}</strong> on {targetReservation.date} ({targetReservation.startTime}–{targetReservation.endTime}).
              This action is permanent and frees the room for other students.
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cancelReasonInput">
                Cancellation Reason (Required by Library Policy)
              </label>
              <textarea
                id="cancelReasonInput"
                className="form-input"
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please state why you are cancelling..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCancelModalOpen(false)}
                disabled={cancelling}
              >
                Keep Reservation
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={cancelling || !cancelReason.trim()}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
