import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { fetchRoomById, createReservation, fetchReservations, ProblemError } from '../api/client';
import type { Room, Reservation, ViewState } from '../types';
import { StatusBadge } from '../components/Badge';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { ViewErrorPanel, FieldError, FormErrorBanner } from '../components/ViewErrorPanel';
import {
  validateBookingInput,
  mapProblemToBookingFields,
  domainMessageFromProblem,
  problemFromUnknown,
  hasFieldErrors,
  type BookingFieldErrors
} from '../lib/formErrors';
import {
  ArrowLeft,
  Users,
  MapPin,
  Calendar,
  AlertTriangle,
  Zap,
  Wifi,
  Monitor,
  VolumeX,
  Check,
  KeyRound
} from 'lucide-react';

interface RoomDetailProps {
  roomId: string | null;
  onNavigate: (tab: string, entityId?: string) => void;
}

interface RoomDetailData {
  room: Room;
  reservations: Reservation[];
}

function defaultBookingDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const RoomDetail: React.FC<RoomDetailProps> = ({ roomId, onNavigate }) => {
  const { hasScope, activePersonaKey } = useAuth();
  const { showSuccess, showError } = useToast();

  const [view, setView] = useState<ViewState<RoomDetailData>>({ kind: 'loading' });

  const [date, setDate] = useState<string>(defaultBookingDate);
  const [startTime, setStartTime] = useState<string>('14:00');
  const [endTime, setEndTime] = useState<string>('16:00');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [booking, setBooking] = useState<boolean>(false);
  const [bookedSuccess, setBookedSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<BookingFieldErrors>({});

  const canReserve = hasScope('reservations:create') || hasScope('reservations:write');

  const loadRoom = useCallback(async () => {
    if (!roomId) {
      setView({
        kind: 'error',
        problem: {
          type: 'https://api.library.example/problems/not-found',
          title: 'Room Not Found',
          status: 404,
          detail: 'No study room was selected. Choose a room from the catalogue.'
        },
        willRetry: false
      });
      return;
    }

    setView({ kind: 'loading' });
    try {
      const roomData = await fetchRoomById(roomId);
      let reservations: Reservation[] = [];
      if (hasScope('reservations:read')) {
        try {
          const rsvData = await fetchReservations();
          reservations = (rsvData.items || []).filter((r) => r.roomId === roomId);
        } catch {
          // Room still loads; bookings list is optional context.
          reservations = [];
        }
      }
      setView({
        kind: 'content',
        data: { room: roomData, reservations },
        fetchedAt: new Date()
      });
      setIdempotencyKey(crypto.randomUUID());
      setFieldErrors({});
      setBookedSuccess(null);
    } catch (err: unknown) {
      const problem = problemFromUnknown(err);
      showError(err instanceof ProblemError ? err : new ProblemError(problem, problem.requestId || ''));
      setView({
        kind: 'error',
        problem,
        willRetry: problem.status !== 403
      });
    }
  }, [roomId, hasScope, showError]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom, activePersonaKey]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view.kind !== 'content') return;
    const room = view.data.room;

    const clientErrors = validateBookingInput({
      roomId: room.id,
      date,
      startTime,
      endTime
    });
    if (hasFieldErrors(clientErrors)) {
      setFieldErrors(clientErrors);
      return;
    }

    setFieldErrors({});
    setBooking(true);
    setBookedSuccess(null);
    try {
      const result = await createReservation(
        {
          roomId: room.id,
          date,
          startTime,
          endTime
        },
        idempotencyKey
      );

      setBookedSuccess(result.id);
      showSuccess(
        'Room Reserved Successfully',
        `Booking ${result.id} confirmed for ${room.name} on ${date} (${startTime}–${endTime}).`
      );
      setIdempotencyKey(crypto.randomUUID());

      if (hasScope('reservations:read')) {
        try {
          const rsvData = await fetchReservations();
          setView({
            kind: 'content',
            data: {
              room,
              reservations: rsvData.items.filter((r) => r.roomId === room.id)
            },
            fetchedAt: new Date()
          });
        } catch {
          // Keep prior content on refresh failure.
        }
      }
    } catch (err: unknown) {
      const problem = problemFromUnknown(err);
      const mapped = mapProblemToBookingFields(problem);
      if (hasFieldErrors(mapped)) {
        setFieldErrors(mapped);
      } else {
        setFieldErrors({ form: domainMessageFromProblem(problem) });
      }
      showError(err instanceof ProblemError ? err : new ProblemError(problem, problem.requestId || ''));
    } finally {
      setBooking(false);
    }
  };

  if (view.kind === 'loading') {
    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <button className="btn btn-sm btn-outline" onClick={() => onNavigate('rooms')}>
            <ArrowLeft size={16} /> Back to Rooms
          </button>
        </div>
        <div className="grid-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (view.kind === 'error') {
    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <button className="btn btn-sm btn-outline" onClick={() => onNavigate('rooms')}>
            <ArrowLeft size={16} /> Back to Rooms
          </button>
        </div>
        <ViewErrorPanel
          problem={view.problem}
          willRetry={view.willRetry}
          onRetry={loadRoom}
          title="Could not load this study room"
        />
      </div>
    );
  }

  if (view.kind === 'empty') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <AlertTriangle size={48} color="var(--accent-amber)" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Room Not Found</h2>
        <button className="btn btn-primary" onClick={() => onNavigate('rooms')}>
          <ArrowLeft size={16} /> Return to Study Rooms
        </button>
      </div>
    );
  }

  const { room, reservations } = view.data;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <button className="btn btn-sm btn-outline" onClick={() => onNavigate('rooms')}>
          <ArrowLeft size={16} /> Back to Study Rooms
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-sm btn-secondary" onClick={() => onNavigate('reservations')}>
            My Reservations
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => {
            const form = document.getElementById('booking-section');
            if (form) form.scrollIntoView({ behavior: 'smooth' });
          }}>
            Reserve Now
          </button>
        </div>
      </div>

      <div
        className="card mb-lg"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          border: 'none',
          padding: '32px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#93c5fd'
                }}
              >
                {room.id}
              </span>
              <span
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Users size={14} /> {room.capacity} seats capacity
              </span>
            </div>

            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0', letterSpacing: '-0.03em' }}>
              {room.name}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '0.95rem' }}>
              <MapPin size={18} color="#f59e0b" />
              <span>{room.location}</span>
              <span>&bull;</span>
              <span>Central Library Building</span>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.12)', textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
              Operating Hours
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
              08:00 – 22:00
            </div>
            <div style={{ fontSize: '0.78rem', color: '#34d399', marginTop: '4px', fontWeight: 600 }}>
              ● Open for Daily Reservations
            </div>
          </div>
        </div>
      </div>

      <div className="grid-12 gap-lg mb-xl">
        <div className="col-span-7" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card">
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary-900)', marginBottom: '16px' }}>
              Equipped Amenities & Hardware
            </h2>
            <div className="grid-2 gap-md">
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--primary-900)' }}>Power Outlets</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dedicated 220V AC & USB-C fast charging at each desk.</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Wifi size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--primary-900)' }}>High-Speed Campus WiFi</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Low-latency gigabit wireless network with Eduroam support.</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Monitor size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--primary-900)' }}>Presentation Screen</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>55" 4K UHD display with HDMI cable and AirPlay/Miracast.</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <VolumeX size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--primary-900)' }}>Acoustic Soundproofing</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Double-glazed STC 45 acoustic glass for distraction-free focus.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary-900)', marginBottom: '16px' }}>
              Library Reservation & Security Policy
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                <Check size={16} color="var(--emerald-600)" />
                <span><strong>Maximum 2 Hours:</strong> Single session length is capped at 2 hours per student.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                <Check size={16} color="var(--emerald-600)" />
                <span><strong>Check-in Requirement:</strong> Students must check in within 15 minutes of scheduled start.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                <Check size={16} color="var(--emerald-600)" />
                <span><strong>Layer 3 Ownership Protection:</strong> Only the student who reserved this room can check in or cancel.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                <Check size={16} color="var(--emerald-600)" />
                <span><strong>Idempotent Booking:</strong> Network dropouts will never cause duplicate reservations or fees.</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary-900)', marginBottom: '14px' }}>
              Current Bookings for {room.name}
            </h2>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              As of {view.fetchedAt.toLocaleTimeString()}.
            </p>
            {reservations.length === 0 ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                No active bookings recorded for this space. The room is open to reserve.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {reservations.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'var(--bg-subtle)',
                      borderRadius: '8px',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Calendar size={14} color="var(--text-muted)" />
                      <span>{r.date} &bull; {r.startTime} – {r.endTime}</span>
                      <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ({r.id})
                      </span>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-5" id="booking-section">
          <div className="card" style={{ position: 'sticky', top: '96px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-900)', marginBottom: '6px' }}>
              Reserve This Room
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Select your date and time slot to secure this space instantly.
            </p>

            {bookedSuccess && (
              <div
                style={{
                  background: '#d1fae5',
                  border: '1px solid #a7f3d0',
                  padding: '14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  color: '#065f46',
                  fontSize: '0.85rem'
                }}
              >
                <strong>Booking Confirmed!</strong> Reservation ID: <code>{bookedSuccess}</code>.
                <div style={{ marginTop: '8px' }}>
                  <button
                    className="btn btn-sm btn-white"
                    onClick={() => onNavigate('reservations')}
                  >
                    View in My Reservations
                  </button>
                </div>
              </div>
            )}

            {!canReserve ? (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  padding: '14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  color: '#991b1b',
                  fontSize: '0.85rem'
                }}
              >
                <strong>Missing Scope (Layer 2):</strong> Your active identity (<code>{activePersonaKey}</code>) lacks the
                <code>reservations:create</code> scope. Switch to <strong>Student A</strong> or <strong>Staff</strong> to reserve.
              </div>
            ) : null}

            <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} noValidate>
              <FormErrorBanner message={fieldErrors.form} />

              <div className="form-group">
                <label className="form-label" htmlFor="reserveDate">
                  Booking Date
                </label>
                <input
                  id="reserveDate"
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, date: undefined, form: undefined }));
                  }}
                  aria-invalid={Boolean(fieldErrors.date)}
                />
                <FieldError message={fieldErrors.date} />
              </div>

              <div className="grid-2 gap-md">
                <div className="form-group">
                  <label className="form-label" htmlFor="reserveStartTime">
                    Start Time
                  </label>
                  <input
                    id="reserveStartTime"
                    type="time"
                    className="form-input"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, startTime: undefined, endTime: undefined, form: undefined }));
                    }}
                    aria-invalid={Boolean(fieldErrors.startTime)}
                  />
                  <FieldError message={fieldErrors.startTime} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reserveEndTime">
                    End Time
                  </label>
                  <input
                    id="reserveEndTime"
                    type="time"
                    className="form-input"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, endTime: undefined, form: undefined }));
                    }}
                    aria-invalid={Boolean(fieldErrors.endTime)}
                  />
                  <FieldError message={fieldErrors.endTime} />
                </div>
              </div>

              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-subtle)',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'monospace',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Idempotency-Key: {idempotencyKey}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={booking}
                  onClick={() => setIdempotencyKey(crypto.randomUUID())}
                >
                  <KeyRound size={12} /> New key
                </button>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
                disabled={booking || !canReserve}
              >
                {booking ? 'Confirming with Backend...' : 'Confirm & Reserve Space'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
