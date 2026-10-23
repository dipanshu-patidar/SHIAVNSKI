import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => string;
  success: (message: string, title?: string, duration?: number) => string;
  error: (message: string, title?: string, duration?: number) => string;
  warning: (message: string, title?: string, duration?: number) => string;
  info: (message: string, title?: string, duration?: number) => string;
  dismissToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const toastsRef = useRef<ToastItem[]>([]);
  toastsRef.current = toasts;

  const dismissToast = useCallback((id: string) => {
    // Clear any pending timer
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4000): string => {
      // Deduplicate: avoid creating identical duplicate toast if already active with same message & type
      const isDuplicate = toastsRef.current.some((t) => t.type === type && t.message === message);
      if (isDuplicate) {
        const existing = toastsRef.current.find((t) => t.type === type && t.message === message);
        return existing ? existing.id : '';
      }

      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismissToast]
  );

  const success = useCallback(
    (message: string, title = 'Success', duration = 4000) => {
      return showToast('success', message, title, duration);
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, title = 'Error', duration = 5000) => {
      return showToast('error', message, title, duration);
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, title = 'Warning', duration = 4500) => {
      return showToast('warning', message, title, duration);
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, title = 'Notice', duration = 4000) => {
      return showToast('info', message, title, duration);
    },
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        success,
        error,
        warning,
        info,
        dismissToast,
        clearAll,
      }}
    >
      {children}
      {/* Toast Viewport Container: Top-Right on desktop, centered within viewport on mobile */}
      <div
        className="fixed top-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => {
          const config = getToastConfig(toast.type);
          const Icon = config.icon;

          return (
            <div
              key={toast.id}
              role={toast.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto w-full p-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out flex items-start gap-3.5 bg-[#0e1626]/95 ${config.borderClass} ${config.shadowClass}`}
            >
              <div className={`p-1.5 rounded-xl shrink-0 ${config.iconBgClass} ${config.iconColorClass}`}>
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                {toast.title && (
                  <h4 className="text-sm font-semibold text-white tracking-tight leading-snug">
                    {toast.title}
                  </h4>
                )}
                <p className="text-xs text-slate-300 leading-relaxed mt-0.5 break-words">
                  {toast.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

function getToastConfig(type: ToastType) {
  switch (type) {
    case 'success':
      return {
        icon: CheckCircle2,
        iconColorClass: 'text-emerald-400',
        iconBgClass: 'bg-emerald-500/10 border border-emerald-500/20',
        borderClass: 'border-emerald-500/30',
        shadowClass: 'shadow-emerald-950/40',
      };
    case 'error':
      return {
        icon: AlertCircle,
        iconColorClass: 'text-rose-400',
        iconBgClass: 'bg-rose-500/10 border border-rose-500/20',
        borderClass: 'border-rose-500/30',
        shadowClass: 'shadow-rose-950/40',
      };
    case 'warning':
      return {
        icon: AlertTriangle,
        iconColorClass: 'text-amber-400',
        iconBgClass: 'bg-amber-500/10 border border-amber-500/20',
        borderClass: 'border-amber-500/30',
        shadowClass: 'shadow-amber-950/40',
      };
    case 'info':
    default:
      return {
        icon: Info,
        iconColorClass: 'text-blue-400',
        iconBgClass: 'bg-blue-500/10 border border-blue-500/20',
        borderClass: 'border-blue-500/30',
        shadowClass: 'shadow-blue-950/40',
      };
  }
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
