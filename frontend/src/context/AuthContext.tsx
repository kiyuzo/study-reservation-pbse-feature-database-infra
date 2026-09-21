import React, { createContext, useContext, useState, useEffect } from 'react';
import type { DemoPersona, Principal } from '../types';
import { setAuthToken, fetchDemoTokens, fetchCurrentPrincipal } from '../api/client';

interface AuthContextType {
  activePersonaKey: string;
  activePersona: DemoPersona | null;
  personas: Record<string, DemoPersona>;
  principal: Principal | null;
  tokenFingerprint: string;
  scopes: string[];
  selectPersona: (key: string) => Promise<void>;
  hasScope: (scope: string) => boolean;
  refreshPrincipal: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [personas, setPersonas] = useState<Record<string, DemoPersona>>({});
  const [activePersonaKey, setActivePersonaKey] = useState<string>('student-a');
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [tokenFingerprint, setTokenFingerprint] = useState<string>('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize demo tokens from backend
  useEffect(() => {
    async function init() {
      try {
        const demoData = await fetchDemoTokens();
        setPersonas(demoData);

        // Default to student-a
        if (demoData['student-a']?.token) {
          setAuthToken(demoData['student-a'].token);
          setTokenFingerprint(demoData['student-a'].tokenFingerprint || 'masked-token');
          setScopes(demoData['student-a'].scopes || []);
          setActivePersonaKey('student-a');
        }

        const me = await fetchCurrentPrincipal();
        if (me.authenticated && me.principal) {
          setPrincipal(me.principal);
        }
      } catch (err) {
        console.error('Failed to load demo tokens from backend:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const selectPersona = async (key: string) => {
    setActivePersonaKey(key);

    if (key === 'unauthenticated') {
      setAuthToken(null);
      setTokenFingerprint('None (Unauthenticated)');
      setScopes([]);
      setPrincipal(null);
      return;
    }

    if (key === 'malformed') {
      setAuthToken('malformed.untrusted.token');
      setTokenFingerprint('malformed...token');
      setScopes([]);
      setPrincipal(null);
      return;
    }

    const target = personas[key];
    if (target && target.token) {
      setAuthToken(target.token);
      setTokenFingerprint(target.tokenFingerprint || 'masked');
      setScopes(target.scopes || []);

      try {
        const me = await fetchCurrentPrincipal();
        if (me.authenticated && me.principal) {
          setPrincipal(me.principal);
        } else {
          setPrincipal(null);
        }
      } catch {
        setPrincipal(null);
      }
    }
  };

  const refreshPrincipal = async () => {
    try {
      const me = await fetchCurrentPrincipal();
      if (me.authenticated && me.principal) {
        setPrincipal(me.principal);
        setScopes(me.principal.scopes);
      } else {
        setPrincipal(null);
      }
    } catch {
      setPrincipal(null);
    }
  };

  const hasScope = (scope: string): boolean => {
    if (scopes.includes('admin:manage')) return true;
    return scopes.includes(scope);
  };

  const activePersona = personas[activePersonaKey] || (
    activePersonaKey === 'unauthenticated'
      ? {
          name: 'Anonymous (No Token)',
          subject: 'anonymous',
          role: 'Public / Guest',
          scopes: [],
          description: 'No Authorization header sent. Triggers 401 Unauthorized on protected routes.'
        }
      : activePersonaKey === 'malformed'
      ? {
          name: 'Malformed Token',
          subject: 'invalid',
          role: 'Untrusted',
          scopes: [],
          description: 'Invalid Bearer token signature. Triggers 401 Invalid Token.'
        }
      : null
  );

  return (
    <AuthContext.Provider
      value={{
        activePersonaKey,
        activePersona,
        personas,
        principal,
        tokenFingerprint,
        scopes,
        selectPersona,
        hasScope,
        refreshPrincipal,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
