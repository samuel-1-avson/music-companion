import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// Mock ICONS
vi.mock('../../constants', () => ({
  ICONS: {
    CheckCircle: () => <span data-testid="icon-check">✓</span>,
    Close: () => <span data-testid="icon-close">✕</span>,
    AlertTriangle: () => <span data-testid="icon-warning">⚠</span>,
    Info: () => <span data-testid="icon-info">ℹ</span>,
  }
}));

import { ToastProvider, useToast } from '../../contexts/ToastContext';

// Test component that uses the toast hook
const TestComponent: React.FC = () => {
  const { success, error, warning, info, toasts, removeToast } = useToast();
  
  return (
    <div>
      <button onClick={() => success('Success!')}>Add Success</button>
      <button onClick={() => error('Error!')}>Add Error</button>
      <button onClick={() => warning('Warning!')}>Add Warning</button>
      <button onClick={() => info('Info!')}>Add Info</button>
      <div data-testid="toast-count">{toasts.length}</div>
      {toasts.map(t => (
        <div key={t.id} data-testid={`toast-${t.type}`}>
          {t.message}
          <button onClick={() => removeToast(t.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
};

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderWithProvider = () => {
    return render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
  };

  describe('Toast Creation', () => {
    // TODO: Fix timing issue with fake timers and success toast 
    it.skip('should add success toast', () => {
      renderWithProvider();
      
      fireEvent.click(screen.getByText('Add Success'));
      
      expect(screen.getByTestId('toast-success')).toBeInTheDocument();
      expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    it('should add error toast', () => {
      renderWithProvider();
      
      fireEvent.click(screen.getByText('Add Error'));
      
      expect(screen.getByTestId('toast-error')).toBeInTheDocument();
    });

    it('should add warning toast', () => {
      renderWithProvider();
      
      fireEvent.click(screen.getByText('Add Warning'));
      
      expect(screen.getByTestId('toast-warning')).toBeInTheDocument();
    });

    it('should add info toast', () => {
      renderWithProvider();
      
      fireEvent.click(screen.getByText('Add Info'));
      
      expect(screen.getByTestId('toast-info')).toBeInTheDocument();
    });
  });

  describe('Toast Removal', () => {
    it('should remove toast when clicking remove', () => {
      renderWithProvider();
      
      fireEvent.click(screen.getByText('Add Success'));
      expect(screen.getByTestId('toast-count').textContent).toBe('1');
      
      fireEvent.click(screen.getByText('Remove'));
      expect(screen.getByTestId('toast-count').textContent).toBe('0');
    });

    it('should auto-remove toast after duration', () => {
      renderWithProvider();
      
      fireEvent.click(screen.getByText('Add Success'));
      expect(screen.getByTestId('toast-count').textContent).toBe('1');
      
      act(() => {
        vi.advanceTimersByTime(3500); // Default duration is 3000ms
      });
      
      expect(screen.getByTestId('toast-count').textContent).toBe('0');
    });
  });

  describe('Multiple Toasts', () => {
    it('should handle multiple toasts', () => {
      renderWithProvider();
      
      fireEvent.click(screen.getByText('Add Success'));
      fireEvent.click(screen.getByText('Add Error'));
      fireEvent.click(screen.getByText('Add Info'));
      
      expect(screen.getByTestId('toast-count').textContent).toBe('3');
    });

    it('should limit max toasts', () => {
      render(
        <ToastProvider maxToasts={2}>
          <TestComponent />
        </ToastProvider>
      );
      
      fireEvent.click(screen.getByText('Add Success'));
      fireEvent.click(screen.getByText('Add Error'));
      fireEvent.click(screen.getByText('Add Info'));
      
      expect(screen.getByTestId('toast-count').textContent).toBe('2');
    });
  });
});
