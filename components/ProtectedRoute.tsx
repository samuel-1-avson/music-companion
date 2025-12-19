import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSkeleton } from './LazyLoad';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * ProtectedRoute - Wraps content that requires authentication
 * Shows fallback content if user is not authenticated
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  fallback 
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingSkeleton type="card" />
      </div>
    );
  }

  // Show fallback if not authenticated
  if (!isAuthenticated) {
    return <>{fallback || null}</>;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
