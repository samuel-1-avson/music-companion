import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from './LoginForm';
import { ICONS } from '../constants';

interface UserMenuProps {
  onAuthPageRequested?: () => void;
  onProfileClick?: () => void;
}

/**
 * UserMenu - Shows login button or user profile dropdown
 * Fixed z-index and improved visibility
 */
const UserMenu: React.FC<UserMenuProps> = ({ onAuthPageRequested, onProfileClick }) => {
  const { user, profile, isAuthenticated, isLoading, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut();
    setShowDropdown(false);
  };

  const handleSignInClick = () => {
    if (onAuthPageRequested) {
      onAuthPageRequested();
    } else {
      setShowLoginForm(true);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="w-10 h-10 bg-[var(--bg-hover)] animate-pulse rounded-full" />
    );
  }

  // Not authenticated - show login button
  if (!isAuthenticated) {
    return (
      <>
        <button
          onClick={handleSignInClick}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-mono font-bold text-sm hover:opacity-90 transition-all shadow-lg hover:shadow-xl rounded-sm"
          style={{ position: 'relative', zIndex: 100 }}
        >
          <ICONS.User size={18} />
          <span>Sign In</span>
        </button>

        {showLoginForm && (
          <LoginForm 
            onClose={() => setShowLoginForm(false)} 
            onSuccess={() => setShowLoginForm(false)}
          />
        )}
      </>
    );
  }

  // Authenticated - show user menu
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const email = user?.email || '';

  return (
    <div className="relative" ref={dropdownRef} style={{ zIndex: 100 }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-hover)] rounded-sm transition-colors border border-transparent hover:border-theme"
      >
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt={displayName}
            className="w-9 h-9 rounded-full border-2 border-[var(--primary)]"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center border-2 border-[var(--primary)]">
            <span className="font-mono font-bold text-white text-sm">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span className="font-mono text-sm hidden sm:block">{displayName}</span>
        <ICONS.ChevronDown size={16} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div 
          className="absolute right-0 top-full mt-2 w-72 bg-[var(--bg-card)] border-2 border-theme shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ zIndex: 9999 }}
        >
          {/* User info */}
          <div className="p-4 border-b-2 border-theme bg-gradient-to-r from-green-500/10 to-emerald-500/10">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt={displayName}
                  className="w-14 h-14 rounded-full border-2 border-[var(--primary)]"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center border-2 border-[var(--primary)]">
                  <span className="font-mono font-bold text-white text-xl">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-mono font-bold truncate">{displayName}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{email}</p>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="p-2">
            <button
              onClick={() => {
                setShowDropdown(false);
                onProfileClick?.();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left font-mono text-sm hover:bg-[var(--bg-hover)] transition-colors rounded"
            >
              <ICONS.User size={18} />
              Profile Settings
            </button>

            <div className="my-2 h-px bg-theme" />

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-left font-mono text-sm text-red-400 hover:bg-red-500/10 transition-colors rounded"
            >
              <ICONS.Power size={18} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
