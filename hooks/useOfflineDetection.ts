import { useEffect, useState } from 'react';
import { useErrorStore } from '../stores/errorStore';

/**
 * Hook to detect offline status and show appropriate errors
 */
export function useOfflineDetection() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const addError = useErrorStore(state => state.addError);
  const clearByContext = useErrorStore(state => state.clearByContext);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      clearByContext('offline');
      addError('You are back online!', 'info', 'connection');
    };

    const handleOffline = () => {
      setIsOffline(true);
      addError('You are offline. Some features may not work.', 'warning', 'offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      addError('You are offline. Some features may not work.', 'warning', 'offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addError, clearByContext]);

  return { isOffline };
}
