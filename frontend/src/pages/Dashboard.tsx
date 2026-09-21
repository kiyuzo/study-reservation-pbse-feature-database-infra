import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { fetchRooms, fetchReservations, checkInReservation } from '../api/client';
import type { Room, Reservation } from '../types';
import { StatusBadge } from '../components/Badge';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { Clock, ShieldCheck, MapPin, Users, ArrowRight, CheckCircle } from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: string, entityId?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { principal, scopes, activePersona } = useAuth();
  const { showSuccess, showError } = useToast();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [roomsData, resData] = await Promise.allSettled([
          fetchRooms(),
          fetchReservations()
        ]);

        if (mounted) {
          if (roomsData.status === 'fulfilled') {
            setRooms(roomsData.value);
          }
          if (resData.status === 'fulfilled') {
            setReservations(resData.value.items || []);
          }
        }
      } catch (err: any) {
        if (mounted) showError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [principal]);

  const activeReservation = reservations.find(
    (r) => r.status === 'pending_checkin' || r.status === 'checked_in'
  );

  const handleCheckIn = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await checkInReservation(id);
      showSuccess('Checked In Successfully', `Reservation ${id} is now active.`);
      setReservations((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err: any) {
      showError(err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Welcome back, {principal ? principal.subject : 'Guest'}</h1>
          <p className="page-subtitle">
            {activePersona ? activePersona.description : 'Explore library study spaces and manage your bookings.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('rooms')}>
          Reserve a Room <ArrowRight size={16} />
        </button>
      </div>

      {/* Security Status Banner */}
      <div
        className="card"
        style={{
          marginBottom: '28px',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          border: 'none',
          padding: '24px 28px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <ShieldCheck size={20} color="#fbbf24" />
              <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                Layer 2 & Layer 3 Security Active
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', maxWidth: '640px', margin: 0 }}>
              Backend is strictly enforcing OAuth2 Scope Checking (L2) and Resource Ownership Checking (L3).
              Your actions are authenticated as <strong style={{ color: '#ffffff' }}>{principal ? principal.subject : 'Anonymous'}</strong>.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-white" onClick={() => onNavigate('security')}>
              Security Demo
            </button>
            <button className="btn btn-sm btn-white" onClick={() => onNavigate('audit')}>
              Audit Logs
            </button>
          </div>
        </div>

        <div className="security-banner-scopes" style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 700, letterSpacing: '0.04em' }}>GRANTED SCOPES:</span>
          {scopes.length > 0 ? (
            scopes.map((s) => (
              <span key={s} className="scope-pill-white">
                ✓ {s}
              </span>
            ))
          ) : (
            <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600 }}>None (Public caller)</span>
          )}
        </div>
      </div>

      <div className="grid-2 mb-xl">
        {/* Current Active Reservation */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-900)' }}>
              Current Reservation
            </h2>
            {activeReservation && <StatusBadge status={activeReservation.status} />}
          </div>

          {loading ? (
            <CardSkeleton />
          ) : activeReservation ? (
            <div>
              <div style={{ padding: '16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary-900)', marginBottom: '4px' }}>
                  {activeReservation.roomId}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={15} /> {activeReservation.date || 'Today'} &bull; {activeReservation.startTime || '14:00'} – {activeReservation.endTime || '16:00'}
                  </span>
                  <span className="font-mono" style={{ fontSize: '0.75rem' }}>
                    ID: {activeReservation.id}
                  </span>
                </div>
              </div>

              {activeReservation.status === 'pending_checkin' && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    className="btn btn-accent"
                    onClick={() => handleCheckIn(activeReservation.id)}
                    disabled={actionLoading === activeReservation.id || !activeReservation.canCheckIn}
                  >
                    <CheckCircle size={16} />
                    {actionLoading === activeReservation.id ? 'Checking in...' : 'Check-in Now'}
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => onNavigate('reservations')}
                  >
                    View Details
                  </button>
                </div>
              )}

              {activeReservation.status === 'checked_in' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--emerald-800)', fontSize: '0.85rem', fontWeight: 600 }}>
                  <CheckCircle size={16} color="var(--emerald-600)" /> Room is currently checked in and active.
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <Clock className="empty-icon" size={32} />
              <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                No Active Reservation
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                You do not have any room reserved right now.
              </p>
              <button className="btn btn-sm btn-primary" onClick={() => onNavigate('rooms')}>
                Browse Study Rooms
              </button>
            </div>
          )}
        </div>

        {/* Room Availability Quick Stats */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-900)' }}>
              Room Spaces Overview
            </h2>
            <button className="btn btn-sm btn-outline" onClick={() => onNavigate('rooms')}>
              View All
            </button>
          </div>

          {loading ? (
            <CardSkeleton />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rooms.slice(0, 3).map((room) => (
                <div
                  key={room.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary-900)' }}>
                      {room.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={14} /> Up to {room.capacity}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={14} /> {room.location}
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => onNavigate('room-detail', room.id)}
                  >
                    Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
