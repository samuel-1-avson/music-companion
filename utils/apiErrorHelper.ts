/**
 * API Error Helper - User-friendly error messages
 * Maps technical API errors to user-friendly messages
 */

import { useErrorStore } from '../stores/errorStore';

// Common error messages
const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  'NetworkError': 'Unable to connect. Please check your internet connection.',
  'Failed to fetch': 'Unable to connect to the server. Please try again.',
  'Load failed': 'Failed to load data. Please check your connection.',
  
  // HTTP status codes
  '400': 'Invalid request. Please try again.',
  '401': 'Session expired. Please sign in again.',
  '403': 'Access denied. You don\'t have permission for this action.',
  '404': 'Not found. The requested content doesn\'t exist.',
  '429': 'Too many requests. Please wait a moment and try again.',
  '500': 'Server error. We\'re working on fixing this.',
  '502': 'Server is temporarily unavailable. Please try again later.',
  '503': 'Service is temporarily unavailable. Please try again later.',
  
  // YouTube/Download errors
  'yt-dlp': 'Download failed. The video may be unavailable or restricted.',
  '403: Forbidden': 'YouTube blocked this request. Try uploading cookies in Settings.',
  'Video unavailable': 'This video is unavailable or has been removed.',
  'Private video': 'This video is private and cannot be accessed.',
  'Sign in to confirm': 'YouTube requires authentication. Upload cookies in Settings.',
  
  // Spotify errors
  'spotify_auth_failed': 'Spotify connection failed. Please try again.',
  'PREMIUM_REQUIRED': 'Spotify Premium is required for playback control.',
  'NO_ACTIVE_DEVICE': 'No active Spotify device found. Open Spotify and try again.',
  
  // Discord errors
  'discord_auth_failed': 'Discord connection failed. Please try again.',
  
  // Supabase errors
  'Invalid login credentials': 'Invalid email or password. Please try again.',
  'Email not confirmed': 'Please check your email to confirm your account.',
  'User already registered': 'This email is already registered. Try signing in.',
  
  // Generic
  'default': 'Something went wrong. Please try again.',
};

/**
 * Get a user-friendly error message from an error object or string
 */
export function getUserFriendlyError(error: unknown): string {
  const errorString = error instanceof Error ? error.message : String(error);
  
  // Check for exact matches first
  if (ERROR_MESSAGES[errorString]) {
    return ERROR_MESSAGES[errorString];
  }
  
  // Check for partial matches
  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (errorString.toLowerCase().includes(key.toLowerCase())) {
      return message;
    }
  }
  
  // Check for HTTP status codes
  const statusMatch = errorString.match(/\b(4\d{2}|5\d{2})\b/);
  if (statusMatch && ERROR_MESSAGES[statusMatch[1]]) {
    return ERROR_MESSAGES[statusMatch[1]];
  }
  
  // Return the original error if it's already somewhat user-friendly
  if (errorString.length < 100 && !errorString.includes('Error:') && !errorString.includes('at ')) {
    return errorString;
  }
  
  return ERROR_MESSAGES.default;
}

/**
 * Show a user-friendly error in the global error toast
 */
export function showApiError(error: unknown, context?: string): void {
  const message = getUserFriendlyError(error);
  const { addError } = useErrorStore.getState();
  addError(message, 'error', context);
  console.error(`[API Error] ${context || 'Unknown'}:`, error);
}

/**
 * Wrapper for async API calls with automatic error handling
 */
export async function withErrorHandling<T>(
  asyncFn: () => Promise<T>,
  context: string
): Promise<T | null> {
  try {
    return await asyncFn();
  } catch (error) {
    showApiError(error, context);
    return null;
  }
}
