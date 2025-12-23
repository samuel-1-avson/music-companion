/**
 * useApiQuery - React Query wrapper hook for API calls
 * Provides caching, retry, and error handling integration with Zustand stores
 */
import { useQuery, useMutation, UseQueryOptions, UseMutationOptions, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useErrorStore } from '../stores/errorStore';
import api from '../utils/apiClient';

// Create a QueryClient with default options
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (previously cacheTime)
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    }
  }
});

// Re-export QueryClientProvider for use in App
export { QueryClientProvider } from '@tanstack/react-query';

/**
 * Generic API query hook with error handling
 */
export function useApiQuery<TData>(
  key: string[],
  endpoint: string,
  options?: Omit<UseQueryOptions<TData, Error>, 'queryKey' | 'queryFn'> & {
    errorContext?: string;
  }
) {
  const addError = useErrorStore(state => state.addError);
  const { errorContext, ...queryOptions } = options || {};

  return useQuery<TData, Error>({
    queryKey: key,
    queryFn: async () => {
      const response = await api.get(endpoint);
      if (!response.success) {
        throw new Error(response.error || 'Request failed');
      }
      return response.data;
    },
    ...queryOptions,
    // Add error handling
    meta: {
      onError: (error: Error) => {
        addError(error.message, 'error', errorContext);
      }
    }
  });
}

/**
 * Generic API mutation hook with error handling
 */
export function useApiMutation<TData, TVariables>(
  endpoint: string,
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'> & {
    errorContext?: string;
    method?: 'POST' | 'PUT' | 'DELETE';
  }
) {
  const addError = useErrorStore(state => state.addError);
  const { errorContext, method = 'POST', ...mutationOptions } = options || {};

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      const response = method === 'POST' 
        ? await api.post(endpoint, variables)
        : method === 'DELETE'
          ? await api.delete(endpoint)
          : await api.post(endpoint, variables);
          
      if (!response.success) {
        throw new Error(response.error || 'Request failed');
      }
      return response.data;
    },
    onError: (error) => {
      addError(error.message, 'error', errorContext);
    },
    ...mutationOptions
  });
}

/**
 * Prefetch query helper
 */
export function usePrefetch() {
  return useCallback(async (key: string[], endpoint: string) => {
    await queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const response = await api.get(endpoint);
        return response.success ? response.data : null;
      }
    });
  }, []);
}

/**
 * Invalidate queries helper for cache busting
 */
export function useInvalidateQueries() {
  return useCallback((key: string[]) => {
    queryClient.invalidateQueries({ queryKey: key });
  }, []);
}
