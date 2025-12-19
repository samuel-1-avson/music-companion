import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ICONS } from '../constants';

interface LoginFormProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

/**
 * LoginForm - Modal overlay with login/register/reset password form
 * Fixed z-index to appear on top of all content
 */
const LoginForm: React.FC<LoginFormProps> = ({ onClose, onSuccess }) => {
  const { signIn, signUp, signInWithGoogle, signInWithSpotify, resetPassword, isLoading } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Email validation
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Client-side validation (skip for reset mode)
    if (mode !== 'reset') {
      if (!email.trim()) {
        setError('Email is required');
        return;
      }
      if (!isValidEmail(email)) {
        setError('Please enter a valid email address');
        return;
      }
      if (!password || password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);

    try {
      let result;
      
      if (mode === 'reset') {
        result = await resetPassword(email);
        if (result.success) {
          setSuccess('Password reset email sent! Check your inbox.');
          setLoading(false);
          return;
        }
      } else if (mode === 'login') {
        result = await signIn(email, password);
      } else {
        result = await signUp(email, password, displayName);
      }

      if (result.success) {
        if (result.error) {
          setSuccess(result.error);
        } else {
          onSuccess?.();
          onClose?.();
        }
      } else {
        // Make error messages more user-friendly
        let errorMsg = result.error || 'An error occurred';
        if (errorMsg.includes('Invalid login credentials')) {
          errorMsg = 'Invalid email or password. Please try again.';
        } else if (errorMsg.includes('rate limit')) {
          errorMsg = 'Too many attempts. Please wait a minute and try again.';
        } else if (errorMsg.includes('already registered')) {
          errorMsg = 'This email is already registered. Try signing in instead.';
        }
        setError(errorMsg);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Google sign in failed');
    }
  };

  const handleSpotifySignIn = async () => {
    try {
      await signInWithSpotify();
    } catch (err: any) {
      setError(err.message || 'Spotify sign in failed');
    }
  };

  // Handle overlay click to close
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Welcome Back';
      case 'register': return 'Create Account';
      case 'reset': return 'Reset Password';
    }
  };

  const getEmoji = () => {
    switch (mode) {
      case 'login': return '🔐';
      case 'register': return '✨';
      case 'reset': return '🔑';
    }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ 
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(8px)'
      }}
      onClick={handleOverlayClick}
    >
      <div 
        className="bg-[var(--bg-card)] border-2 border-theme shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b-2 border-theme bg-gradient-to-r from-green-500 to-emerald-500 flex justify-between items-center">
          <h2 className="font-mono font-bold text-xl uppercase flex items-center gap-3 text-white">
            <span className="text-2xl">{getEmoji()}</span>
            {getTitle()}
          </h2>
          {onClose && (
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/20 rounded text-white transition-colors"
              aria-label="Close"
            >
              <ICONS.Close size={20} />
            </button>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Google OAuth - hide in reset mode */}
          {mode !== 'reset' && (
            <>
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading || loading}
                className="w-full py-3.5 bg-white text-gray-800 font-mono font-bold flex items-center justify-center gap-3 hover:bg-gray-100 transition-all border-2 border-gray-300 disabled:opacity-50 shadow-md"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <button
                onClick={handleSpotifySignIn}
                disabled={isLoading || loading}
                className="w-full py-3.5 bg-[#1DB954] text-white font-mono font-bold flex items-center justify-center gap-3 hover:bg-[#1ed760] transition-all border-2 border-[#1DB954] disabled:opacity-50 shadow-md"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Continue with Spotify
              </button>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-[var(--border-color)]" />
                <span className="text-xs text-[var(--text-muted)] font-mono uppercase">or</span>
                <div className="flex-1 h-px bg-[var(--border-color)]" />
              </div>
            </>
          )}

          {/* Reset password info */}
          {mode === 'reset' && (
            <p className="text-sm text-[var(--text-muted)] text-center">
              Enter your email and we'll send you a link to reset your password.
            </p>
          )}

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-mono text-[var(--text-muted)] uppercase mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-3 bg-[var(--bg-main)] border-2 border-theme font-mono focus:border-[var(--primary)] outline-none transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-[var(--text-muted)] uppercase mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 bg-[var(--bg-main)] border-2 border-theme font-mono focus:border-[var(--primary)] outline-none transition-all"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-xs font-mono text-[var(--text-muted)] uppercase mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full px-4 py-3 pr-12 bg-[var(--bg-main)] border-2 border-theme font-mono focus:border-[var(--primary)] outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <ICONS.EyeOff size={20} /> : <ICONS.Eye size={20} />}
                  </button>
                </div>
                {mode === 'register' && (
                  <p className="text-xs text-[var(--text-muted)] mt-2">Minimum 6 characters</p>
                )}
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
                    className="text-xs text-[var(--primary)] hover:underline mt-2"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-500/20 border-2 border-red-500 text-red-400 text-sm font-mono">
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-500/20 border-2 border-green-500 text-green-400 text-sm font-mono">
                ✓ {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || isLoading}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-mono font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50"
            >
              {loading ? '⏳ Please wait...' : (
                mode === 'login' ? '🚀 Sign In' : 
                mode === 'register' ? '✨ Create Account' :
                '📧 Send Reset Link'
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <p className="text-center text-sm text-[var(--text-muted)]">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button 
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); }} 
                  className="text-[var(--primary)] font-bold hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : mode === 'register' ? (
              <>
                Already have an account?{' '}
                <button 
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }} 
                  className="text-[var(--primary)] font-bold hover:underline"
                >
                  Login
                </button>
              </>
            ) : (
              <>
                Remember your password?{' '}
                <button 
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }} 
                  className="text-[var(--primary)] font-bold hover:underline"
                >
                  Back to login
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
