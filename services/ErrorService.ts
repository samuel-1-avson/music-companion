/**
 * ErrorService - Centralized Error Logging and Reporting
 * 
 * Provides:
 * - Structured error reports
 * - Console logging with context
 * - Error ID generation for tracking
 * - Future: Integration with external services (Sentry, LogRocket)
 */

export interface ErrorReport {
  id: string;
  error: Error;
  componentStack?: string;
  timestamp: Date;
  context: {
    userId?: string;
    route: string;
    action?: string;
    metadata?: Record<string, any>;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorContext {
  userId?: string;
  action?: string;
  metadata?: Record<string, any>;
}

// Error storage for debugging
const errorLog: ErrorReport[] = [];
const MAX_ERROR_LOG_SIZE = 50;

/**
 * Generate a unique error ID for tracking
 */
function generateErrorId(): string {
  return `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
}

/**
 * Determine error severity based on error type and message
 */
function determineSeverity(error: Error): ErrorReport['severity'] {
  const message = error.message.toLowerCase();
  
  // Critical: auth, data loss, security
  if (message.includes('auth') || message.includes('token') || message.includes('permission')) {
    return 'critical';
  }
  
  // High: API failures, network issues
  if (message.includes('network') || message.includes('fetch') || message.includes('api')) {
    return 'high';
  }
  
  // Medium: render errors, state issues
  if (message.includes('render') || message.includes('state') || message.includes('undefined')) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Format error for console output
 */
function formatForConsole(report: ErrorReport): void {
  const severityColors: Record<ErrorReport['severity'], string> = {
    low: '#666',
    medium: '#f59e0b',
    high: '#ef4444',
    critical: '#dc2626',
  };

  console.group(
    `%c[ErrorService] ${report.severity.toUpperCase()} - ${report.id}`,
    `color: ${severityColors[report.severity]}; font-weight: bold;`
  );
  console.error('Error:', report.error);
  console.info('Route:', report.context.route);
  console.info('Timestamp:', report.timestamp.toISOString());
  if (report.context.userId) {
    console.info('User:', report.context.userId);
  }
  if (report.context.action) {
    console.info('Action:', report.context.action);
  }
  if (report.componentStack) {
    console.info('Component Stack:', report.componentStack);
  }
  if (report.context.metadata) {
    console.info('Metadata:', report.context.metadata);
  }
  console.groupEnd();
}

/**
 * Report an error with full context
 */
export function reportError(
  error: Error,
  componentStack?: string,
  context?: ErrorContext
): ErrorReport {
  const report: ErrorReport = {
    id: generateErrorId(),
    error,
    componentStack,
    timestamp: new Date(),
    context: {
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      ...context,
    },
    severity: determineSeverity(error),
  };

  // Log to console
  formatForConsole(report);

  // Store in memory for debugging
  errorLog.unshift(report);
  if (errorLog.length > MAX_ERROR_LOG_SIZE) {
    errorLog.pop();
  }

  // Store in sessionStorage for persistence across refreshes
  try {
    sessionStorage.setItem('last_error', JSON.stringify({
      id: report.id,
      message: error.message,
      timestamp: report.timestamp.toISOString(),
      route: report.context.route,
    }));
  } catch (e) {
    // Ignore storage errors
  }

  // TODO: Send to external service (Sentry, LogRocket)
  // if (process.env.NODE_ENV === 'production') {
  //   sendToExternalService(report);
  // }

  return report;
}

/**
 * Report a non-Error exception (e.g., thrown string)
 */
export function reportException(
  exception: unknown,
  context?: ErrorContext
): ErrorReport {
  const error = exception instanceof Error 
    ? exception 
    : new Error(String(exception));
  
  return reportError(error, undefined, context);
}

/**
 * Get recent errors for debugging
 */
export function getRecentErrors(): ErrorReport[] {
  return [...errorLog];
}

/**
 * Clear error log
 */
export function clearErrorLog(): void {
  errorLog.length = 0;
  try {
    sessionStorage.removeItem('last_error');
  } catch (e) {
    // Ignore
  }
}

/**
 * Get last error from session (survives page refresh)
 */
export function getLastErrorFromSession(): { id: string; message: string; timestamp: string; route: string } | null {
  try {
    const stored = sessionStorage.getItem('last_error');
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Setup global error handlers
 * Call this once at app initialization
 */
export function setupGlobalErrorHandlers(): void {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(`Unhandled Promise Rejection: ${event.reason}`);
    
    reportError(error, undefined, { action: 'unhandledrejection' });
  });

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    // Ignore errors from browser extensions
    if (event.filename?.includes('extension://')) {
      return;
    }

    const error = event.error instanceof Error
      ? event.error
      : new Error(event.message || 'Unknown error');
    
    reportError(error, undefined, {
      action: 'uncaught_error',
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  console.log('[ErrorService] Global error handlers installed');
}

