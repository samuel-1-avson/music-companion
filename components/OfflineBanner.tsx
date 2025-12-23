import React from 'react';
import { ICONS } from '../constants';

interface OfflineBannerProps {
  isOffline: boolean;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({ isOffline }) => {
  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-yellow-500 text-black py-2 px-4 flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
      <ICONS.AlertTriangle size={16} />
      <span className="font-mono text-sm font-bold">
        You're offline - Some features may not work
      </span>
    </div>
  );
};

export default OfflineBanner;
