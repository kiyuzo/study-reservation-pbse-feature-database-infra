import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import {
  BookOpen,
  ShieldCheck,
  Activity,
  Calendar,
  LayoutDashboard,
  UserCheck
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    activePersonaKey,
    selectPersona,
    principal,
    hasScope
  } = useAuth();

  /*
   * Role-based navigation.
   *
   * reservations:read
   *   -> Student / Staff / Admin with reservation access
   *
   * admin:manage
   *   -> Staff / Admin
   *
   * Dashboard and Study Rooms remain available as the
   * general library navigation.
   */
  const canViewReservations = hasScope('reservations:read');
  const canViewAdminPages = hasScope('admin:manage');

  return (
    <header className="navbar">
      <div className="navbar-inner">

        {/* =========================================================
            BRAND
        ========================================================= */}
        <NavLink
          to="/"
          className="brand"
          aria-label="Go to Dashboard"
        >
          <div className="brand-icon">
            <BookOpen size={22} />
          </div>

          <div className="brand-text">
            <div className="brand-title">
              University Library
            </div>

            <div className="brand-subtitle">
              Study Room Reservation System
            </div>
          </div>
        </NavLink>

        {/* =========================================================
            MAIN NAVIGATION
        ========================================================= */}
        <nav
          className="nav-links"
          aria-label="Main Navigation"
        >

          {/* Dashboard - available to all personas */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>

          {/* Study Rooms - available to all personas */}
          <NavLink
            to="/rooms"
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            <BookOpen size={18} />
            Study Rooms
          </NavLink>

          {/* My Reservations - reservation scope */}
          {canViewReservations && (
            <NavLink
              to="/reservations"
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <Calendar size={18} />
              My Reservations
            </NavLink>
          )}

          {/* Security & Access - admin scope */}
          {canViewAdminPages && (
            <NavLink
              to="/security"
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <ShieldCheck
                size={18}
                color="#d97706"
              />
              Security & Access
            </NavLink>
          )}

          {/* Audit Logs - admin scope */}
          {canViewAdminPages && (
            <NavLink
              to="/audit"
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <Activity size={18} />
              Audit Logs
            </NavLink>
          )}

        </nav>

        {/* =========================================================
            PERSONA SWITCHER
        ========================================================= */}
        <div className="role-switcher-container">

          <div className="role-meta">
            <span className="role-meta-label">
              Active Persona
            </span>

            <span className="role-meta-val">
              {principal
                ? principal.subject
                : activePersonaKey}
            </span>
          </div>

          <div className="role-selector-wrap">

            <UserCheck
              size={16}
              color="var(--accent-amber)"
            />

            <select
              aria-label="Select Demo Persona"
              value={activePersonaKey}
              onChange={(e) =>
                selectPersona(e.target.value)
              }
              className="role-dropdown"
            >

              <optgroup label="Valid Students">

                <option value="student-a">
                  Student A (Owns rsv_9X8y7Z)
                </option>

                <option value="student-b">
                  Student B (Owns rsv_Aa1Bb2)
                </option>

              </optgroup>

              <optgroup label="Restricted / Elevated">

                <option value="student-limited">
                  Student Limited (rooms:read only)
                </option>

                <option value="staff-admin">
                  Library Staff / Admin
                </option>

              </optgroup>

              <optgroup label="Negative Security Testing">

                <option value="unauthenticated">
                  Anonymous (No Token → 401)
                </option>

                <option value="malformed">
                  Malformed Token (→ 401)
                </option>

              </optgroup>

            </select>

          </div>

        </div>

      </div>
    </header>
  );
};