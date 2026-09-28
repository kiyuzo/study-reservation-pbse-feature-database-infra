import React, { createContext, useContext, useState, useCallback } from 'react';
import { ProblemError } from '../api/client';
import { AlertCircle, CheckCircle, AlertTriangle, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning';
  title: string;
  message?: string;
  status?: number;
  requestId?: string;
}

interface ToastContextType {
  toasts: ToastItem[];
  showSuccess: (title: string, message?: string) => void;
  showError: (error: ProblemError | Error | string) => void;
  showWarning: (title: string, message?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9);
    const newToast: ToastItem = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      removeToast(id);
    }, 6000);
  }, [removeToast]);

  const showSuccess = useCallback((title: string, message?: string) => {
    addToast({ type: 'success', title, message });
  }, [addToast]);

  const showError = useCallback((error: ProblemError | Error | string) => {
    if (error instanceof ProblemError) {
      addToast({
        type: 'error',
        title: `${error.status ? `[${error.status}] ` : ''}${error.problem.title || 'Error'}`,
        message: error.problem.detail || error.message,
        status: error.status,
        requestId: error.requestId
      });
    } else if (error instanceof Error) {
      addToast({
        type: 'error',
        title: error.name || 'Error',
        message: error.message
      });
    } else {
      addToast({
        type: 'error',
        title: 'Error',
        message: String(error)
      });
    }
  }, [addToast]);

  const showWarning = useCallback((title: string, message?: string) => {
    addToast({ type: 'warning', title, message });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, showSuccess, showError, showWarning, removeToast }}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div style={{ paddingTop: '2px' }}>
              {toast.type === 'success' && <CheckCircle size={20} color="#059669" />}
              {toast.type === 'error' && <AlertCircle size={20} color="#e11d48" />}
              {toast.type === 'warning' && <AlertTriangle size={20} color="#d97706" />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>
                {toast.title}
              </div>
              {toast.message && (
                <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.4 }}>
                  {toast.message}
                </div>
              )}
              {toast.requestId && (
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px', fontFamily: 'monospace' }}>
                  Request ID: {toast.requestId}
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              aria-label="Close notification"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
