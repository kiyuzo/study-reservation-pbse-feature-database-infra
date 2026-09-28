import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap,
  User,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Terminal,
  KeyRound,
  ChevronDown,
  ChevronUp,
  Layers,
  Lock,
  Sparkles
} from 'lucide-react';

interface PersonaCardConfig {
  key: string;
  name: string;
  subject: string;
  role: string;
  badgeBg: string;
  badgeColor: string;
  avatarBg: string;
  avatarColor: string;
  icon: React.ReactNode;
  description: string;
  keyFeature: string;
  ownedEntities?: string[];
  scopes: string[];
  buttonStyle: {
    background: string;
    color: string;
  };
}

const PERSONA_CONFIGS: PersonaCardConfig[] = [
  {
    key: 'student-a',
    name: 'Student A (Full Access)',
    subject: 'student-a',
    role: 'STUDENT',
    badgeBg: '#dbeafe',
    badgeColor: '#1e40af',
    avatarBg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    avatarColor: '#ffffff',
    icon: <GraduationCap size={24} />,
    description:
      'Primary student persona for standard workflows, active bookings, check-ins, and 2-window concurrency demo.',
    keyFeature:
      '💡 Demo Concurrency (A.8): Open two browser windows to trigger 412 Precondition Failed upon concurrent cancellation.',
    ownedEntities: ['rsv_9X8y7Z', 'rsv_Cc3Dd4'],
    scopes: [
      'rooms:read',
      'reservations:read',
      'reservations:create',
      'reservations:cancel',
      'reservations:checkin',
      'reservations:write'
    ],
    buttonStyle: {
      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      color: '#ffffff'
    }
  },
  {
    key: 'student-b',
    name: 'Student B (Alternate Student)',
    subject: 'student-b',
    role: 'STUDENT',
    badgeBg: '#ede9fe',
    badgeColor: '#5b21b6',
    avatarBg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    avatarColor: '#ffffff',
    icon: <User size={24} />,
    description:
      'Secondary student persona for verifying Layer 3 object authorization and zero ownership disclosure.',
    keyFeature:
      '🛡️ Demo Object Denial (A.9): Requesting rsv_9X8y7Z yields 404 Not Found without leaking ownership metadata.',
    ownedEntities: ['rsv_Aa1Bb2'],
    scopes: [
      'rooms:read',
      'reservations:read',
      'reservations:create',
      'reservations:cancel',
      'reservations:write'
    ],
    buttonStyle: {
      background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
      color: '#ffffff'
    }
  },
  {
    key: 'student-limited',
    name: 'Student Limited (Read Only)',
    subject: 'student-limited',
    role: 'RESTRICTED',
    badgeBg: '#fef3c7',
    badgeColor: '#92400e',
    avatarBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    avatarColor: '#ffffff',
    icon: <ShieldAlert size={24} />,
    description:
      'Restricted student account with rooms:read scope only. Forbidden from creating or mutating reservations.',
    keyFeature:
      '🚫 Demo Scope Denial (A.9): Direct API or console requests to /v1/reservations return 403 Forbidden (never 200).',
    scopes: ['rooms:read'],
    buttonStyle: {
      background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      color: '#ffffff'
    }
  },
  {
    key: 'staff-admin',
    name: 'Library Staff / Admin',
    subject: 'admin-user',
    role: 'ADMINISTRATOR',
    badgeBg: '#d1fae5',
    badgeColor: '#065f46',
    avatarBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    avatarColor: '#ffffff',
    icon: <ShieldCheck size={24} />,
    description:
      'Elevated administrative authority with universal management scopes across all reservations, rooms, and audit trails.',
    keyFeature:
      '⚡ Full Authority: Access to Security & Access events (/security), audit trails (/audit), and cross-outlet sweeps.',
    ownedEntities: ['rsv_Ee5Ff6'],
    scopes: [
      'rooms:read',
      'reservations:read',
      'reservations:create',
      'reservations:cancel',
      'reservations:checkin',
      'reservations:cleanup',
      'admin:manage'
    ],
    buttonStyle: {
      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      color: '#ffffff'
    }
  }
];

export const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectPersona } = useAuth();

  const [hoveredPersona, setHoveredPersona] = useState<string>('student-a');
  const [inspectOpen, setInspectOpen] = useState<boolean>(false);
  const [signingInKey, setSigningInKey] = useState<string | null>(null);

  const returnPath =
    new URLSearchParams(location.search).get('returnTo') ||
    sessionStorage.getItem('authReturnPath') ||
    '/';

  const handleSignIn = async (personaKey: string) => {
    setSigningInKey(personaKey);
    try {
      await selectPersona(personaKey);
      sessionStorage.removeItem('authReturnPath');
      navigate(returnPath);
    } finally {
      setSigningInKey(null);
    }
  };

  const currentPreviewPersona =
    PERSONA_CONFIGS.find((p) => p.key === hoveredPersona) || PERSONA_CONFIGS[0];

  return (
    <div className="signin-portal-wrapper">
      <div className="signin-hero-card">
        {/* Top Status & Gateway Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div className="signin-top-badge">
            <Sparkles size={14} />
            PBSE Session 7 Production Gateway
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              color: '#334155'
            }}
          >
            <span className="status-pulse-dot" />
            <span style={{ fontWeight: 600 }}>Unified Full Stack</span>
            <span style={{ color: '#94a3b8' }}>•</span>
            <span className="font-mono" style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
              FE + BE Same Origin
            </span>
          </div>
        </div>

        <h1 className="signin-title">Identity & Access Gateway</h1>
        <p className="signin-subtitle">
          Select a pre-configured OIDC persona to simulate role-based authorization,
          HTTP conditional requests (<span className="font-mono" style={{ color: '#2563eb' }}>ETag / 304</span> and{' '}
          <span className="font-mono" style={{ color: '#d97706' }}>If-Match / 412</span>), and multi-layer security enforcement.
        </p>

        {/* 2x2 Persona Cards Grid */}
        <div className="persona-grid">
          {PERSONA_CONFIGS.map((p) => {
            const isHovered = hoveredPersona === p.key;
            const isProcessing = signingInKey === p.key;

            return (
              <div
                key={p.key}
                className="persona-card"
                onMouseEnter={() => setHoveredPersona(p.key)}
                onClick={() => handleSignIn(p.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSignIn(p.key);
                  }
                }}
                style={{
                  borderColor: isHovered ? '#3b82f6' : '#e2e8f0',
                  boxShadow: isHovered
                    ? '0 16px 32px -8px rgba(37, 99, 235, 0.16), 0 4px 8px -2px rgba(15, 23, 42, 0.06)'
                    : '0 2px 8px rgba(15, 23, 42, 0.04)'
                }}
              >
                <div>
                  <div className="persona-card-header">
                    <div
                      className="persona-avatar-box"
                      style={{ background: p.avatarBg, color: p.avatarColor }}
                    >
                      {p.icon}
                    </div>
                    <span
                      className="persona-role-badge"
                      style={{ background: p.badgeBg, color: p.badgeColor }}
                    >
                      {p.role}
                    </span>
                  </div>

                  <h3 className="persona-card-title">{p.name}</h3>
                  <div className="persona-card-subject">
                    sub: &quot;{p.subject}&quot;
                  </div>

                  <p className="persona-card-desc">{p.description}</p>

                  <div className="persona-key-feature">{p.keyFeature}</div>

                  {p.ownedEntities && p.ownedEntities.length > 0 && (
                    <div style={{ marginBottom: '14px', fontSize: '0.78rem', color: '#475569' }}>
                      <span style={{ fontWeight: 600 }}>Owned Reservations: </span>
                      {p.ownedEntities.map((id) => (
                        <span
                          key={id}
                          className="font-mono"
                          style={{
                            background: '#f1f5f9',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginRight: '4px',
                            border: '1px solid #e2e8f0'
                          }}
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="persona-scopes-wrapper">
                    {p.scopes.map((s) => (
                      <span key={s} className="persona-scope-tag">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className="persona-action-btn"
                  style={p.buttonStyle}
                  disabled={isProcessing}
                >
                  <span>
                    {isProcessing ? 'Authenticating...' : `Continue as ${p.name.split(' (')[0]}`}
                  </span>
                  <ArrowRight size={16} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Live Token Inspector Drawer */}
        <div style={{ marginTop: '12px' }}>
          <button
            type="button"
            onClick={() => setInspectOpen(!inspectOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <KeyRound size={16} color="#2563eb" />
            <span>
              {inspectOpen ? 'Hide Simulated JWT Preview' : 'Inspect Active Persona JWT Payload'}
            </span>
            {inspectOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {inspectOpen && (
            <div className="token-inspector-container">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  borderBottom: '1px solid #1e293b',
                  paddingBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal size={16} color="#60a5fa" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>
                    Simulated JWT for persona: &quot;{currentPreviewPersona.subject}&quot;
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    background: '#1e293b',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    color: '#94a3b8'
                  }}
                >
                  Algorithm: HS256 (HMAC-SHA256)
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '16px'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                    HEADER (Decoded)
                  </div>
                  <pre
                    className="font-mono"
                    style={{
                      background: '#020617',
                      padding: '10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      color: '#a5f3fc',
                      overflowX: 'auto'
                    }}
                  >
{JSON.stringify(
  {
    alg: 'HS256',
    typ: 'JWT'
  },
  null,
  2
)}
                  </pre>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                    PAYLOAD (Claims & Scopes)
                  </div>
                  <pre
                    className="font-mono"
                    style={{
                      background: '#020617',
                      padding: '10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      color: '#bef264',
                      overflowX: 'auto'
                    }}
                  >
{JSON.stringify(
  {
    iss: 'http://localhost:8080/realms/study-reservation',
    aud: 'study-reservation-api',
    sub: currentPreviewPersona.subject,
    scope: currentPreviewPersona.scopes.join(' '),
    client_id: 'web-client',
    kind: 'user',
    exp: Math.floor(Date.now() / 1000) + 86400
  },
  null,
  2
)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Demo Quick-Reference Cards for Session 7 Presentation */}
        <div className="demo-tips-grid">
          <div className="demo-tip-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#1d4ed8', marginBottom: '6px' }}>
              <Layers size={16} />
              A.7 Conditional Reads (304)
            </div>
            Sign in as <strong>Student A</strong>. Go to <em>Study Rooms</em>. The client polls every 12s with <span className="font-mono">If-None-Match</span>. Unchanged data receives 304 Not Modified without flashing or wiping data.
          </div>

          <div className="demo-tip-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#b45309', marginBottom: '6px' }}>
              <Lock size={16} />
              A.8 Concurrency Demo (412)
            </div>
            Open the app in two windows as <strong>Student A</strong>. Navigate to <em>My Reservations</em>. Cancel in Window 1; then cancel in Window 2. Window 2 receives <strong>412 Precondition Failed</strong> with domain-level banner.
          </div>

          <div className="demo-tip-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#047857', marginBottom: '6px' }}>
              <Terminal size={16} />
              A.9 Console Attack Test
            </div>
            Sign in as <strong>Student B</strong> or <strong>Limited Student</strong>. Open DevTools (F12) Console. Fetch protected endpoints directly: verify <strong>403</strong> (scope) or <strong>404</strong> (foreign object) — never 200.
          </div>
        </div>
      </div>
    </div>
  );
};