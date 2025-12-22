
import React from 'react';
import { ICONS } from '../constants';
import { AppView, SpotifyProfile } from '../types';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  spotifyProfile?: SpotifyProfile | null;
  userProfile?: { display_name: string; avatar_url?: string } | null;
  isListeningForWakeWord?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, spotifyProfile, userProfile, isListeningForWakeWord }) => {
  const navItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: ICONS.Dashboard },
    { id: AppView.CHAT, label: 'Chat Assistant', icon: ICONS.MessageSquare },
    { id: AppView.LIVE, label: 'Live Mode', icon: ICONS.Live },
    { id: AppView.PROFILE, label: 'My Profile', icon: ICONS.User }, 
    { id: AppView.COLLAB, label: 'Shared Playlists', icon: ICONS.User },
    { id: AppView.OFFLINE, label: 'Offline Hub', icon: ICONS.Offline },
    { id: AppView.ARCADE, label: 'Retro Arcade', icon: ICONS.Game },
    { id: AppView.LAB, label: 'Sonic Lab', icon: ICONS.Sliders },
    { id: AppView.EXTENSIONS, label: 'Integrations', icon: ICONS.Box }, // Renamed from Extensions
    { id: AppView.SETTINGS, label: 'Settings', icon: ICONS.Settings },
  ];

  const profileToShow = spotifyProfile 
    ? { name: spotifyProfile.display_name, image: spotifyProfile.images?.[0]?.url, type: 'SPOTIFY' }
    : userProfile 
      ? { name: userProfile.display_name || 'User', image: userProfile.avatar_url, type: 'APP' }
      : null;

  return (
    <div className="w-64 bg-[var(--bg-card)] border-r-2 border-theme flex flex-col h-screen fixed left-0 top-0 z-10 transition-colors duration-300">
      <div className="p-6 flex items-center space-x-3 border-b-2 border-theme relative overflow-hidden">
        {isListeningForWakeWord && (
            <div className="absolute top-0 right-0 p-1">
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--primary-hover)]"></span>
                </span>
            </div>
        )}
        <div className="w-10 h-10 bg-black rounded-none flex items-center justify-center shadow-retro-sm border-2 border-black">
          <ICONS.Music className="text-white w-5 h-5" />
        </div>
        <div>
            <h1 className="text-xl font-bold tracking-tight font-mono leading-none text-[var(--text-main)]">Music<span className="text-[var(--primary)]">Comp</span></h1>
            {isListeningForWakeWord && <p className="text-[9px] font-mono text-[var(--text-muted)]">LISTENING: "MELODY"</p>}
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-3 mt-6 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 border-2 transition-all duration-200 ${
              currentView === item.id 
                ? 'bg-[var(--primary)] text-[var(--text-on-primary)] border-theme shadow-retro-sm translate-x-[-2px] translate-y-[-2px]' 
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-transparent hover:border-theme hover:shadow-retro-sm hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <item.icon size={20} strokeWidth={2.5} />
            <span className="font-bold font-mono">{item.label}</span>
          </button>
        ))}
        
        {/* Focus Mode Button */}
        <button
            onClick={() => onChangeView(AppView.FOCUS)}
            className={`w-full flex items-center space-x-3 px-4 py-3 border-2 transition-all duration-200 mt-8 ${
              currentView === AppView.FOCUS
                ? 'bg-black text-white border-black shadow-retro-sm' 
                : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-transparent hover:border-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <div className="relative">
                <ICONS.Play size={20} strokeWidth={2.5} />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--primary)] rounded-full animate-pulse"></span>
            </div>
            <span className="font-bold font-mono">Focus Mode</span>
        </button>
      </nav>

      <div className="p-4 border-t-2 border-theme bg-[var(--bg-hover)] space-y-4">
        {profileToShow ? (
           <div 
             className="bg-[var(--bg-card)] p-3 border-2 border-theme shadow-retro-sm flex items-center space-x-3 cursor-pointer hover:bg-gray-50 transition-colors"
             onClick={() => onChangeView(AppView.PROFILE)}
           >
             <div className="w-10 h-10 bg-gray-200 border border-black overflow-hidden flex-shrink-0">
               {profileToShow.image ? (
                 <img src={profileToShow.image} alt="Profile" className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center bg-gray-300">
                    <ICONS.User size={20} className="text-gray-500" />
                 </div>
               )}
             </div>
             <div className="overflow-hidden">
               <p className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase">
                 {profileToShow.type === 'SPOTIFY' ? 'CONNECTED_AS' : 'SIGNED_IN_AS'}
               </p>
               <p className="text-sm font-bold truncate text-[var(--text-main)]">{profileToShow.name}</p>
             </div>
           </div>
        ) : (
          <div 
            className="bg-[var(--bg-card)] p-4 border-2 border-theme shadow-retro-sm cursor-pointer hover:bg-gray-50"
            onClick={() => onChangeView(AppView.PROFILE)}
          >
            <div className="flex items-center space-x-2">
                <ICONS.User size={16} />
                <span className="text-sm font-bold text-[var(--text-main)]">View Profile</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
