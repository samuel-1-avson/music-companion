import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ICONS } from '../constants';

interface AuthPageProps {
  onSuccess?: () => void;
  onBack?: () => void;
}

/**
 * AuthPage - Full-page authentication with login/register
 */
const AuthPage: React.FC<AuthPageProps> = ({ onSuccess, onBack }) => {
  const { signIn, signUp, signInWithGoogle, isAuthenticated, isLoading } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && onSuccess) {
      onSuccess();
    }
  }, [isAuthenticated, onSuccess]);

  // Email validation
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Client-side validation
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
    
    setLoading(true);

    try {
      let result;
      
      if (mode === 'login') {
        result = await signIn(email, password);
      } else {
        result = await signUp(email, password, displayName);
      }

      if (result.success) {
        if (result.error) {
          setSuccess(result.error);
        } else {
          onSuccess?.();
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-main)] via-[#0a0a0a] to-[var(--bg-main)] flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center gap-4">
        {onBack && (
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 font-mono text-sm hover:bg-[var(--bg-hover)] transition-colors border border-theme"
          >
            <ICONS.ChevronLeft size={16} />
            Back
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎵</span>
          <span className="font-mono font-bold text-lg">Music Companion</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-[var(--bg-card)] border-2 border-theme shadow-2xl">
            {/* Card Header */}
            <div className="p-6 text-center border-b-2 border-theme bg-gradient-to-r from-green-500/20 to-emerald-500/20">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <ICONS.User size={40} className="text-white" />
              </div>
              <h1 className="font-mono font-bold text-2xl uppercase">
                {mode === 'login' ? 'Welcome Back' : 'Join Us'}
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Google OAuth */}
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading || loading}
                className="w-full py-3.5 bg-white text-gray-800 font-mono font-bold flex items-center justify-center gap-3 hover:bg-gray-100 transition-all border-2 border-gray-300 disabled:opacity-50 shadow-md hover:shadow-lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-[var(--border-color)]" />
                <span className="text-xs text-[var(--text-muted)] font-mono uppercase">or use email</span>
                <div className="flex-1 h-px bg-[var(--border-color)]" />
              </div>

              {/* Email Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-muted)] uppercase mb-2 tracking-wider">
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
                  <label className="block text-xs font-mono text-[var(--text-muted)] uppercase mb-2 tracking-wider">
                    Email Address
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

                <div>
                  <label className="block text-xs font-mono text-[var(--text-muted)] uppercase mb-2 tracking-wider">
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
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-[var(--primary)] hover:underline mt-2 block"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                {error && (
                  <div className="p-4 bg-red-500/20 border-2 border-red-500 text-red-400 text-sm font-mono flex items-center gap-2">
                    <ICONS.Close size={16} />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="p-4 bg-green-500/20 border-2 border-green-500 text-green-400 text-sm font-mono flex items-center gap-2">
                    <ICONS.Check size={16} />
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || isLoading}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-mono font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50 shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Please wait...
                    </span>
                  ) : (
                    mode === 'login' ? '🚀 Sign In' : '✨ Create Account'
                  )}
                </button>
              </form>

              {/* Toggle mode */}
              <p className="text-center text-sm text-[var(--text-muted)] pt-4 border-t border-theme">
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
                ) : (
                  <>
                    Already have an account?{' '}
                    <button 
                      onClick={() => { setMode('login'); setError(''); setSuccess(''); }} 
                      className="text-[var(--primary)] font-bold hover:underline"
                    >
                      Login
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-[var(--text-muted)] mt-6">
            By signing in, you agree to our Terms of Service
          </p>
        </div>
      </main>
    </div>
  );
};

export default AuthPage;
