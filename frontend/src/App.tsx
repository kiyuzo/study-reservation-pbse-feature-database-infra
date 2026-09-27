import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { Navbar } from './components/Navbar';

import { Dashboard } from './pages/Dashboard';
import { Rooms } from './pages/Rooms';
import { RoomDetail } from './pages/RoomDetail';
import { MyReservations } from './pages/MyReservations';
import { SecurityDemo } from './pages/SecurityDemo';
import { AuditDemo } from './pages/AuditDemo';

import { ShieldCheck, BookOpen } from 'lucide-react';

const AppContent: React.FC = () => {
  const navigate = useNavigate();

  const handleNavigate = (tab: string, entityId?: string) => {
    switch (tab) {
      case 'dashboard':
        navigate('/');
        break;

      case 'rooms':
        navigate('/rooms');
        break;

      case 'room-detail':
        if (entityId) {
          navigate(`/rooms/${entityId}`);
        }
        break;

      case 'reservations':
        navigate('/reservations');
        break;

      case 'security':
        navigate('/security');
        break;

      case 'audit':
        navigate('/audit');
        break;

      default:
        navigate('/');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-app)'
      }}
    >
      <Navbar />

      <main style={{ flex: 1, padding: '24px 0' }}>
        <div className="container">
          <Routes>
            <Route
              path="/"
              element={<Dashboard onNavigate={handleNavigate} />}
            />

            <Route
              path="/rooms"
              element={<Rooms onNavigate={handleNavigate} />}
            />

            <Route
              path="/rooms/:roomId"
              element={<RoomDetailRoute onNavigate={handleNavigate} />}
            />

            <Route
              path="/reservations"
              element={<MyReservations onNavigate={handleNavigate} />}
            />

            <Route
              path="/security"
              element={<SecurityDemo />}
            />

            <Route
              path="/audit"
              element={<AuditDemo />}
            />

            {/* Fallback */}
            <Route
              path="*"
              element={<Dashboard onNavigate={handleNavigate} />}
            />
          </Routes>
        </div>
      </main>

      <footer
        style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          padding: '24px 0',
          marginTop: 'auto'
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            fontSize: '0.84rem',
            color: 'var(--text-muted)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="var(--primary-700)" />
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              University Library Study Room Reservation System
            </span>
            <span>&bull; PBSE Feature Step 7–9 Security Layer</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={16} color="var(--accent-amber)" />
              Protected by Token, Scope & Object Checkers
            </span>
            <span>RFC 9457 Problem Details</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

/**
 * Gets roomId directly from the URL:
 * /rooms/:roomId
 */
const RoomDetailRoute: React.FC<{
  onNavigate: (tab: string, entityId?: string) => void;
}> = ({ onNavigate }) => {
  const { roomId } = useParams<{ roomId: string }>();

  return (
    <RoomDetail
      roomId={roomId ?? null}
      onNavigate={onNavigate}
    />
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}