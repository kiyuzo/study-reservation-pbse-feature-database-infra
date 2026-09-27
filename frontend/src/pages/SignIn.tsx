import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectPersona } = useAuth();

  const returnPath =
    new URLSearchParams(location.search).get('returnTo') ||
    sessionStorage.getItem('authReturnPath') ||
    '/';

  const handleSignIn = async (persona: string) => {
    await selectPersona(persona);
    sessionStorage.removeItem('authReturnPath');
    navigate(returnPath);
  };

  return (
    <div style={{ maxWidth: '520px', margin: '60px auto' }}>
      <h1>Sign In</h1>

      <p>
        Select a demo account to continue to the Study Room Reservation
        System.
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginTop: '24px'
        }}
      >
        <button
          type="button"
          onClick={() => handleSignIn('student-a')}
        >
          Sign in as Student A
        </button>

        <button
          type="button"
          onClick={() => handleSignIn('student-b')}
        >
          Sign in as Student B
        </button>

        <button
          type="button"
          onClick={() => handleSignIn('student-limited')}
        >
          Sign in as Limited Student
        </button>

        <button
          type="button"
          onClick={() => handleSignIn('staff-admin')}
        >
          Sign in as Library Staff / Admin
        </button>
      </div>
    </div>
  );
};