import React from 'react';
import { ICONS } from '../constants';
import { useErrorStore, AppError } from '../stores/errorStore';

const ErrorToast: React.FC = () => {
  const allErrors = useErrorStore(state => state.errors);
  const dismissError = useErrorStore(state => state.dismissError);

  const errors = React.useMemo(() => 
    allErrors.filter(e => !e.dismissed), 
    [allErrors]
  );

  if (errors.length === 0) return null;

  const getIcon = (type: AppError['type']) => {
    switch (type) {
      case 'error':
        return <ICONS.AlertTriangle className="text-red-500" size={20} />;
      case 'warning':
        return <ICONS.AlertTriangle className="text-yellow-500" size={20} />;
      case 'info':
        return <ICONS.CheckCircle className="text-blue-500" size={20} />;
    }
  };

  const getBorderColor = (type: AppError['type']) => {
    switch (type) {
      case 'error':
        return 'border-red-500';
      case 'warning':
        return 'border-yellow-500';
      case 'info':
        return 'border-blue-500';
    }
  };

  const getBgColor = (type: AppError['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-md">
      {errors.slice(0, 5).map((error) => (
        <div
          key={error.id}
          className={`
            flex items-start gap-3 p-4 border-2 shadow-retro 
            ${getBorderColor(error.type)} ${getBgColor(error.type)}
            animate-in slide-in-from-right-4 fade-in duration-300
            ${error.dismissed ? 'animate-out slide-out-to-right fade-out' : ''}
          `}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(error.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono font-medium text-[var(--text-main)]">
              {error.message}
            </p>
            {error.context && (
              <p className="text-xs font-mono text-[var(--text-muted)] mt-1 uppercase">
                {error.context}
              </p>
            )}
          </div>
          <button
            onClick={() => dismissError(error.id)}
            className="flex-shrink-0 p-1 hover:bg-[var(--bg-hover)] rounded transition-colors"
          >
            <ICONS.X size={16} className="text-[var(--text-muted)]" />
          </button>
        </div>
      ))}
      
      {errors.length > 5 && (
        <p className="text-xs font-mono text-[var(--text-muted)] text-center">
          +{errors.length - 5} more errors
        </p>
      )}
    </div>
  );
};

export default ErrorToast;
