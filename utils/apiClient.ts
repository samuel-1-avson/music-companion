/**
 * API Client - Centralized Backend Communication
 * 
 * Single source of truth for backend URL and common request handling.
 * Eliminates hardcoded URLs throughout the codebase.
 */

// Backend URL from environment or default
const BACKEND_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Request options
 */
interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Get the backend URL
 */
export function getBackendUrl(): string {
  return BACKEND_URL;
}

/**
 * Build full URL for an API endpoint
 */
export function buildUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${BACKEND_URL}${cleanPath}`;
}

/**
 * Make a GET request to the backend
 */
export async function get<T = any>(
  path: string, 
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(buildUrl(path), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error(`[API] GET ${path} failed:`, error);
    return { success: false, error: error.message || 'Request failed' };
  }
}

/**
 * Make a POST request to the backend
 */
export async function post<T = any>(
  path: string,
  body?: any,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(buildUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error(`[API] POST ${path} failed:`, error);
    return { success: false, error: error.message || 'Request failed' };
  }
}

/**
 * Make a DELETE request to the backend
 */
export async function del<T = any>(
  path: string,
  body?: any,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(buildUrl(path), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error(`[API] DELETE ${path} failed:`, error);
    return { success: false, error: error.message || 'Request failed' };
  }
}

/**
 * Redirect to an OAuth endpoint
 */
export function redirectToOAuth(provider: string, userId: string, userEmail: string): void {
  const url = buildUrl(`/auth/${provider}?user_id=${userId}&user_email=${encodeURIComponent(userEmail)}`);
  window.location.href = url;
}

// Export as default object for convenient imports
const api = {
  getBackendUrl,
  buildUrl,
  get,
  post,
  delete: del,
  redirectToOAuth,
};

export default api;
