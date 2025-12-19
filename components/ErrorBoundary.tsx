import React, { Component, ReactNode } from 'react';
import { ICONS } from '../constants';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary catches JavaScript errors in child component tree,
 * logs them, and displays a fallback UI instead of crashing.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="bg-[var(--bg-card)] border-2 border-[var(--border)] shadow-retro p-8 max-w-md w-full text-center">
            {/* Error Icon */}
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <ICONS.Close className="w-8 h-8 text-red-500" />
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold font-mono mb-2 text-[var(--text-main)]">
              {this.props.fallbackTitle || 'Something went wrong'}
            </h2>

            {/* Error Message */}
            <p className="text-sm text-[var(--text-muted)] mb-4">
              An unexpected error occurred. Don't worry, your data is safe.
            </p>

            {/* Error Details (dev only) */}
            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-xs text-[var(--text-muted)] hover:text-[var(--primary)]">
                  Show error details
                </summary>
                <pre className="mt-2 p-3 bg-[var(--bg-hover)] rounded text-xs overflow-auto max-h-32 text-red-400">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-[var(--primary)] text-white font-bold text-sm rounded hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-2"
              >
                <ICONS.ArrowRight className="w-4 h-4 rotate-180" />
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-[var(--bg-hover)] text-[var(--text-main)] font-bold text-sm rounded hover:bg-[var(--border)] transition-colors flex items-center gap-2"
              >
                <ICONS.Loader className="w-4 h-4" />
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
