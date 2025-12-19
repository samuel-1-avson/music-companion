import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      return; // Don't show for 7 days after dismiss
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa_install_dismissed', String(Date.now()));
    setShowPrompt(false);
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-80 z-50 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-[var(--bg-card)] border-2 border-theme p-4 shadow-retro">
        <div className="flex items-start gap-3">
          <div className="bg-[var(--primary)] text-black p-2 flex-shrink-0">
            <ICONS.Download size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-mono font-bold text-sm uppercase text-[var(--text-main)]">
              Install App
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Add Music Companion to your home screen for the best experience.
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleDismiss}
            className="flex-1 px-3 py-2 text-xs font-mono font-bold border-2 border-theme hover:bg-[var(--bg-hover)]"
          >
            Later
          </button>
          <button
            onClick={handleInstall}
            className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-[var(--primary)] text-black border-2 border-theme hover:opacity-90"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
