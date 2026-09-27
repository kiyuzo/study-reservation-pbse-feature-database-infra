import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { fetchRooms, createReservation, ProblemError } from '../api/client';
import type { Room, ViewState } from '../types';
import { Modal } from '../components/Modal';
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
import { Users, MapPin, Search, ShieldAlert, KeyRound } from 'lucide-react';

interface RoomsProps {
  onNavigate: (tab: string, entityId?: string) => void;
}

function defaultBookingDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const Rooms: React.FC<RoomsProps> = ({ onNavigate }) => {
  const { hasScope } = useAuth();
  const { showSuccess, showError } = useToast();

  const [view, setView] = useState<ViewState<Room[]>>({ kind: 'loading' });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [capacityFilter, setCapacityFilter] = useState<string>('all');

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [date, setDate] = useState<string>(defaultBookingDate);
  const [startTime, setStartTime] = useState<string>('10:00');
  const [endTime, setEndTime] = useState<string>('12:00');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [activeIdempotencyKey, setActiveIdempotencyKey] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<BookingFieldErrors>({});

  const canReserve = hasScope('reservations:create') || hasScope('reservations:write');

  const loadRooms = useCallback(async () => {
    setView({ kind: 'loading' });
    try {
      const data = await fetchRooms();
      if (!data.length) {
        setView({ kind: 'empty' });
      } else {
        setView({ kind: 'content', data, fetchedAt: new Date() });
      }
    } catch (err: unknown) {
      const problem = problemFromUnknown(err);
      showError(err instanceof ProblemError ? err : new ProblemError(problem, problem.requestId || ''));
      setView({
        kind: 'error',
        problem,
        willRetry: problem.status !== 403
      });
    }
  }, [showError]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const openReserveModal = (room: Room) => {
    setSelectedRoom(room);
    setActiveIdempotencyKey(crypto.randomUUID());
    setFieldErrors({});
    setDate(defaultBookingDate());
    setStartTime('10:00');
    setEndTime('12:00');
  };

  const closeReserveModal = () => {
    if (submitting) return;
    setSelectedRoom(null);
    setFieldErrors({});
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;

    const clientErrors = validateBookingInput({
      roomId: selectedRoom.id,
      date,
      startTime,
      endTime
    });
    if (hasFieldErrors(clientErrors)) {
      setFieldErrors(clientErrors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const result = await createReservation(
        {
          roomId: selectedRoom.id,
          date,
          startTime,
          endTime
        },
        activeIdempotencyKey
      );

      showSuccess('Reservation Confirmed', `Successfully reserved ${selectedRoom.name} (${result.id})`);
      setActiveIdempotencyKey(crypto.randomUUID());
      setSelectedRoom(null);
      onNavigate('reservations');
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
      setSubmitting(false);
    }
  };

  const rooms = view.kind === 'content' ? view.data : [];
  const filteredRooms = rooms.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCapacity =
      capacityFilter === 'all' ||
      (capacityFilter === 'small' && r.capacity <= 2) ||
      (capacityFilter === 'medium' && r.capacity > 2 && r.capacity <= 4) ||
      (capacityFilter === 'large' && r.capacity > 4);

    return matchesSearch && matchesCapacity;
  });

  const showFilterEmpty = view.kind === 'content' && filteredRooms.length === 0;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Study Rooms & Pods</h1>
          <p className="page-subtitle">
            Browse quiet, group, and presentation study spaces available in the library.
          </p>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: '28px',
          padding: '16px 20px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '38px' }}
            placeholder="Search by room name or wing..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={view.kind === 'loading' || view.kind === 'error'}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Capacity:</span>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '8px 12px' }}
            value={capacityFilter}
            onChange={(e) => setCapacityFilter(e.target.value)}
            disabled={view.kind === 'loading' || view.kind === 'error'}
          >
            <option value="all">All Sizes</option>
            <option value="small">Small Pod (1–2 persons)</option>
            <option value="medium">Medium Room (3–4 persons)</option>
            <option value="large">Large Group (5+ persons)</option>
          </select>
        </div>
      </div>

      {view.kind === 'loading' && (
        <div className="grid-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {view.kind === 'error' && (
        <ViewErrorPanel
          problem={view.problem}
          willRetry={view.willRetry}
          onRetry={loadRooms}
          title="Could not load study rooms"
        />
      )}

      {view.kind === 'empty' && (
        <div className="empty-state">
          <Search className="empty-icon" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>No study rooms available</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            The library has no rooms in the catalogue right now.
          </p>
          <button type="button" className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={loadRooms}>
            Retry
          </button>
        </div>
      )}

      {showFilterEmpty && (
        <div className="empty-state">
          <Search className="empty-icon" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>No Rooms Match Your Search</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Try clearing the search query or capacity filter.</p>
        </div>
      )}

      {view.kind === 'content' && filteredRooms.length > 0 && (
        <div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Showing rooms as of {view.fetchedAt.toLocaleTimeString()}.
          </p>
          <div className="grid-3">
            {filteredRooms.map((room) => (
              <div key={room.id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                      {room.name}
                    </h3>
                    <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {room.id}
                    </span>
                  </div>
                  <span className="badge badge-scope">
                    <Users size={12} /> {room.capacity} seats
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  <MapPin size={15} />
                  <span>{room.location}</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '24px' }}>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--bg-subtle)', borderRadius: '4px', color: 'var(--text-muted)' }}>
                    Power Outlets
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--bg-subtle)', borderRadius: '4px', color: 'var(--text-muted)' }}>
                    High-Speed WiFi
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--bg-subtle)', borderRadius: '4px', color: 'var(--text-muted)' }}>
                    Presentation Screen
                  </span>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => openReserveModal(room)}
                  >
                    Reserve Space
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => onNavigate('room-detail', room.id)}
                  >
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={Boolean(selectedRoom)}
        onClose={closeReserveModal}
        title={selectedRoom ? `Reserve ${selectedRoom.name}` : 'Reserve Room'}
      >
        <form onSubmit={handleCreateReservation} noValidate>
          {!canReserve && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: '16px',
                display: 'flex',
                gap: '10px',
                alignItems: 'center'
              }}
            >
              <ShieldAlert size={20} color="#dc2626" />
              <div style={{ fontSize: '0.82rem', color: '#991b1b' }}>
                <strong>Scope Notice:</strong> Your current persona lacks <code>reservations:create</code> scope.
                Submitting this request will trigger a <strong>403 Forbidden</strong> response from the backend.
              </div>
            </div>
          )}

          <FormErrorBanner message={fieldErrors.form} />

          <div className="form-group">
            <label className="form-label">Selected Room</label>
            <input
              type="text"
              className="form-input"
              value={selectedRoom ? `${selectedRoom.name} (${selectedRoom.id})` : ''}
              disabled
              style={{ background: 'var(--bg-subtle)' }}
            />
            <FieldError message={fieldErrors.roomId} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rooms-reserve-date">Reservation Date</label>
            <input
              id="rooms-reserve-date"
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="rooms-reserve-start">Start Time</label>
              <input
                id="rooms-reserve-start"
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
              <label className="form-label" htmlFor="rooms-reserve-end">End Time</label>
              <input
                id="rooms-reserve-end"
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
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginBottom: '12px',
              fontFamily: 'monospace',
              background: 'var(--bg-subtle)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap'
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Idempotency-Key: {activeIdempotencyKey}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              disabled={submitting}
              onClick={() => setActiveIdempotencyKey(crypto.randomUUID())}
              title="Generate a new Idempotency-Key"
            >
              <KeyRound size={12} /> New key
            </button>
          </div>

          {submitting && (
            <div style={{ textAlign: 'center', padding: '12px', color: 'var(--accent-amber)', fontSize: '0.9rem', fontWeight: 600 }}>
              Confirming your reservation... Please don't close this page.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={closeReserveModal}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-accent" disabled={submitting}>
              {submitting ? 'Confirming...' : 'Confirm Reservation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
