/**
 * Error Store - Zustand state management for centralized error handling
 * Provides global error state management with toast-like notifications
 */
import { create } from 'zustand';

export interface AppError {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  timestamp: number;
  dismissed: boolean;
  context?: string; // e.g., 'download', 'spotify', 'search'
}

interface ErrorState {
  errors: AppError[];
  
  // Actions
  addError: (message: string, type?: 'error' | 'warning' | 'info', context?: string) => string;
  dismissError: (id: string) => void;
  clearAllErrors: () => void;
  clearByContext: (context: string) => void;
  
  // Getters
  hasErrors: () => boolean;
  getActiveErrors: () => AppError[];
}

function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const useErrorStore = create<ErrorState>((set, get) => ({
  errors: [],
  
  addError: (message, type = 'error', context) => {
    const id = generateErrorId();
    const error: AppError = {
      id,
      message,
      type,
      timestamp: Date.now(),
      dismissed: false,
      context
    };
    
    set(state => ({
      errors: [...state.errors, error]
    }));
    
    // Auto-dismiss after 10 seconds for non-error types
    if (type !== 'error') {
      setTimeout(() => {
        get().dismissError(id);
      }, 10000);
    }
    
    console.log(`[ErrorStore] Added ${type}: ${message}`, context ? `(${context})` : '');
    return id;
  },
  
  dismissError: (id) => {
    set(state => ({
      errors: state.errors.map(e => 
        e.id === id ? { ...e, dismissed: true } : e
      )
    }));
    
    // Remove from array after animation delay
    setTimeout(() => {
      set(state => ({
        errors: state.errors.filter(e => e.id !== id)
      }));
    }, 300);
  },
  
  clearAllErrors: () => set({ errors: [] }),
  
  clearByContext: (context) => {
    set(state => ({
      errors: state.errors.filter(e => e.context !== context)
    }));
  },
  
  hasErrors: () => get().errors.some(e => !e.dismissed),
  
  getActiveErrors: () => get().errors.filter(e => !e.dismissed)
}));
