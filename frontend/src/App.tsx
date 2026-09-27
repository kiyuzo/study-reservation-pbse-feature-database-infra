import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams
} from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
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
  const { hasScope } = useAuth();

  /*
   * Central navigation handler.
   *
   * Every page can call:
   *   onNavigate('dashboard')
   *   onNavigate('rooms')
   *   onNavigate('room-detail', roomId)
   *   onNavigate('reservations')
   *   onNavigate('security')
   *   onNavigate('audit')
   *
   * React Router is responsible for the actual URL.
   */
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
          navigate(`/rooms/${encodeURIComponent(entityId)}`);
        } else {
          navigate('/rooms');
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

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  /*
   * Role / scope based access.
   *
   * Backend authorization is still the source of truth.
   * These checks only control which frontend routes/navigation
   * are available to the active demo persona.
   */
  const canViewReservations = hasScope('reservations:read');
  const canViewAdminPages = hasScope('admin:manage');

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

      <main
        style={{
          flex: 1,
          padding: '24px 0'
        }}
      >
        <div className="container">
          <Routes>

            {/* =========================================================
                DASHBOARD
                URL: /
            ========================================================= */}
            <Route
              path="/"
              element={
                <Dashboard
                  onNavigate={handleNavigate}
                />
              }
            />

            {/* =========================================================
                STUDY ROOMS
                URL: /rooms
            ========================================================= */}
            <Route
              path="/rooms"
              element={
                <Rooms
                  onNavigate={handleNavigate}
                />
              }
            />

            {/* =========================================================
                ROOM DETAIL
                URL: /rooms/:roomId
                Example: /rooms/rm_1a2B3cD
            ========================================================= */}
            <Route
              path="/rooms/:roomId"
              element={
                <RoomDetailRoute
                  onNavigate={handleNavigate}
                />
              }
            />

            {/* =========================================================
                MY RESERVATIONS
                URL: /reservations

                Requires reservations:read.
            ========================================================= */}
            <Route
              path="/reservations"
              element={
                canViewReservations ? (
                  <MyReservations
                    onNavigate={handleNavigate}
                  />
                ) : (
                  <Navigate
                    to="/"
                    replace
                  />
                )
              }
            />

            {/* =========================================================
                SECURITY & ACCESS
                URL: /security

                Admin/staff only.
            ========================================================= */}
            <Route
              path="/security"
              element={
                canViewAdminPages ? (
                  <SecurityDemo />
                ) : (
                  <Navigate
                    to="/"
                    replace
                  />
                )
              }
            />

            {/* =========================================================
                AUDIT LOGS
                URL: /audit

                Admin/staff only.
            ========================================================= */}
            <Route
              path="/audit"
              element={
                canViewAdminPages ? (
                  <AuditDemo />
                ) : (
                  <Navigate
                    to="/"
                    replace
                  />
                )
              }
            />

            {/* =========================================================
                FALLBACK
                Unknown URL -> Dashboard
            ========================================================= */}
            <Route
              path="*"
              element={
                <Dashboard
                  onNavigate={handleNavigate}
                />
              }
            />

          </Routes>
        </div>
      </main>

      {/* =============================================================
          FOOTER
      ============================================================= */}
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <BookOpen
              size={18}
              color="var(--primary-700)"
            />

            <span
              style={{
                fontWeight: 600,
                color: 'var(--text-main)'
              }}
            >
              University Library Study Room Reservation System
            </span>

            <span>
              &bull; PBSE Feature Step 7–9 Security Layer
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <ShieldCheck
                size={16}
                color="var(--accent-amber)"
              />

              Protected by Token, Scope & Object Checkers
            </span>

            <span>
              RFC 9457 Problem Details
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

/**
 * Gets roomId directly from the URL:
 *
 * /rooms/:roomId
 *
 * Example:
 * /rooms/rm_1a2B3cD
 */
const RoomDetailRoute: React.FC<{
  onNavigate: (tab: string, entityId?: string) => void;
}> = ({ onNavigate }) => {
  const { roomId } = useParams<{
    roomId: string;
  }>();

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