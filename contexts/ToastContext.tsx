import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ICONS } from '../constants';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, options?: Partial<Toast>) => string;
  removeToast: (id: string) => void;
  success: (message: string, options?: Partial<Toast>) => string;
  error: (message: string, options?: Partial<Toast>) => string;
  warning: (message: string, options?: Partial<Toast>) => string;
  info: (message: string, options?: Partial<Toast>) => string;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Hook to use toast
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

// Toast Provider
interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children, maxToasts = 5 }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((
    message: string, 
    type: ToastType = 'info',
    options: Partial<Toast> = {}
  ): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const duration = options.duration ?? (type === 'error' ? 5000 : 3000);
    
    const newToast: Toast = {
      id,
      message,
      type,
      duration,
      ...options,
    };

    setToasts(prev => {
      const updated = [...prev, newToast];
      // Limit max toasts
      return updated.slice(-maxToasts);
    });

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, [maxToasts, removeToast]);

  // Convenience methods
  const success = useCallback((message: string, options?: Partial<Toast>) => 
    addToast(message, 'success', options), [addToast]);
  
  const error = useCallback((message: string, options?: Partial<Toast>) => 
    addToast(message, 'error', options), [addToast]);
  
  const warning = useCallback((message: string, options?: Partial<Toast>) => 
    addToast(message, 'warning', options), [addToast]);
  
  const info = useCallback((message: string, options?: Partial<Toast>) => 
    addToast(message, 'info', options), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

// Toast Container Component
interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

// Individual Toast Item
interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const config = {
    success: {
      bg: 'bg-green-500',
      border: 'border-green-700',
      icon: ICONS.CheckCircle,
    },
    error: {
      bg: 'bg-red-500',
      border: 'border-red-700',
      icon: ICONS.Close,
    },
    warning: {
      bg: 'bg-yellow-500',
      border: 'border-yellow-700',
      icon: ICONS.AlertTriangle,
    },
    info: {
      bg: 'bg-blue-500',
      border: 'border-blue-700',
      icon: ICONS.Info,
    },
  };

  const { bg, border, icon: Icon } = config[toast.type];

  return (
    <div
      className={`${bg} ${border} border-2 shadow-retro p-3 flex items-start gap-3 animate-in slide-in-from-right-5 text-white min-w-[280px]`}
      role="alert"
    >
      <Icon size={18} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono font-bold">{toast.message}</p>
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="text-xs underline mt-1 hover:opacity-80"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 hover:bg-white/20 rounded flex-shrink-0"
        aria-label="Close"
      >
        <ICONS.Close size={14} />
      </button>
    </div>
  );
};

export default ToastProvider;
