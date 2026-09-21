import React, { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>('rm_1a2B3cD');

  const handleNavigate = (tab: string, entityId?: string) => {
    setActiveTab(tab);
    if (entityId) {
      setSelectedRoomId(entityId);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      {/* Top Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Page Area */}
      <main style={{ flex: 1, padding: '24px 0' }}>
        <div className="container">
          {activeTab === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
          {activeTab === 'rooms' && <Rooms onNavigate={handleNavigate} />}
          {activeTab === 'room-detail' && <RoomDetail roomId={selectedRoomId} onNavigate={handleNavigate} />}
          {activeTab === 'reservations' && <MyReservations onNavigate={handleNavigate} />}
          {activeTab === 'security' && <SecurityDemo />}
          {activeTab === 'audit' && <AuditDemo />}
        </div>
      </main>

      {/* University Library System Footer */}
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

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
