import React from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, ShieldCheck, Activity, Calendar, LayoutDashboard, UserCheck } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { activePersonaKey, selectPersona, principal } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <a href="#dashboard" onClick={() => setActiveTab('dashboard')} className="brand">
          <div className="brand-icon">
            <BookOpen size={22} />
          </div>
          <div className="brand-text">
            <div className="brand-title">University Library</div>
            <div className="brand-subtitle">Study Room Reservation System</div>
          </div>
        </a>

        <nav className="nav-links" aria-label="Main Navigation">
          <button
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button
            className={`nav-link ${activeTab === 'rooms' ? 'active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            <BookOpen size={18} />
            Study Rooms
          </button>
          <button
            className={`nav-link ${activeTab === 'reservations' ? 'active' : ''}`}
            onClick={() => setActiveTab('reservations')}
          >
            <Calendar size={18} />
            My Reservations
          </button>
          <button
            className={`nav-link ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <ShieldCheck size={18} color="#d97706" />
            Security & Access
          </button>
          <button
            className={`nav-link ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <Activity size={18} />
            Audit Logs
          </button>
        </nav>

        <div className="role-switcher-container">
          <div className="role-meta">
            <span className="role-meta-label">Active Persona</span>
            <span className="role-meta-val">{principal ? principal.subject : activePersonaKey}</span>
          </div>

          <div className="role-selector-wrap">
            <UserCheck size={16} color="var(--accent-amber)" />
            <select
              aria-label="Select Demo Persona"
              value={activePersonaKey}
              onChange={(e) => selectPersona(e.target.value)}
              className="role-dropdown"
            >
              <optgroup label="Valid Students">
                <option value="student-a">Student A (Owns rsv_9X8y7Z)</option>
                <option value="student-b">Student B (Owns rsv_Aa1Bb2)</option>
              </optgroup>
              <optgroup label="Restricted / Elevated">
                <option value="student-limited">Student Limited (rooms:read only)</option>
                <option value="staff-admin">Library Staff / Admin</option>
              </optgroup>
              <optgroup label="Negative Security Testing">
                <option value="unauthenticated">Anonymous (No Token → 401)</option>
                <option value="malformed">Malformed Token (→ 401)</option>
              </optgroup>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
