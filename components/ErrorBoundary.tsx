import React, { Component, ReactNode } from 'react';
import { ICONS } from '../constants';
import { reportError, ErrorReport } from '../services/ErrorService';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  /** Optional name to identify which boundary caught the error */
  boundaryName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorReport: ErrorReport | null;
}

/**
 * ErrorBoundary catches JavaScript errors in child component tree,
 * logs them with full context via ErrorService, and displays a 
 * fallback UI with error ID for tracking.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorReport: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Report to ErrorService with full context
    const report = reportError(
      error,
      errorInfo.componentStack || undefined,
      {
        action: 'component_error',
        metadata: {
          boundaryName: this.props.boundaryName || 'unnamed',
        },
      }
    );
    
    this.setState({ errorReport: report });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorReport: null });
    this.props.onReset?.();
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleCopyErrorId = (): void => {
    if (this.state.errorReport?.id) {
      navigator.clipboard.writeText(this.state.errorReport.id);
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { errorReport } = this.state;
      
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
            <p className="text-sm text-[var(--text-muted)] mb-3">
              An unexpected error occurred. Don't worry, your data is safe.
            </p>

            {/* Error ID Badge */}
            {errorReport && (
              <div 
                className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 bg-[var(--bg-hover)] rounded-full cursor-pointer hover:bg-[var(--border)] transition-colors group"
                onClick={this.handleCopyErrorId}
                title="Click to copy error ID"
              >
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  Error ID: <span className="text-[var(--primary)]">{errorReport.id}</span>
                </span>
                <ICONS.Copy className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}

            {/* Error Details (expandable) */}
            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-xs text-[var(--text-muted)] hover:text-[var(--primary)]">
                  Show error details
                </summary>
                <pre className="mt-2 p-3 bg-[var(--bg-hover)] rounded text-xs overflow-auto max-h-32 text-red-400">
                  {this.state.error.toString()}
                  {this.state.error.stack && (
                    <>
                      {'\n\nStack trace:\n'}
                      {this.state.error.stack}
                    </>
                  )}
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

            {/* Support hint */}
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              If this persists, please share the error ID with support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

